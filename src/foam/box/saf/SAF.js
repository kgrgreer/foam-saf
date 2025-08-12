/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAF',
  abstract: true,

  javaImports: [
    'foam.box.Box',
    'foam.box.Envelope',
    'foam.core.app.Health',
    'foam.core.app.HealthStatus',
    'foam.core.app.HealthSupport',
    'foam.core.fs.Storage',
    'foam.core.fs.FileSystemStorage',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.logger.PrefixLogger',
    'foam.dao.*',
    'foam.dao.ReadOnlyF3FileJournal',
    'foam.lang.X',
    'foam.lang.ClassInfo',
    'foam.lang.FObject',
    'foam.log.LogLevel',
    'foam.lib.NetworkPropertyPredicate',
    'foam.lib.StoragePropertyPredicate',
    'foam.lib.json.Outputter',
    'foam.lib.json.OutputterMode',
    'foam.mlang.MLang',
    'foam.mlang.predicate.Predicate',
    'foam.mlang.sink.Max',
    'foam.util.retry.RetryStrategy',
    'foam.util.retry.RetryForeverStrategy',
    'foam.util.retry.NoRetryStrategy',
    'java.nio.file.*',
    'java.nio.file.attribute.*',
    'java.io.IOException',
    'java.util.concurrent.atomic.AtomicInteger',
    'java.util.concurrent.atomic.AtomicLong',
    'java.util.concurrent.atomic.AtomicBoolean',
    'java.util.concurrent.ConcurrentHashMap',
    'java.util.*',
    'org.apache.commons.lang.exception.ExceptionUtils'
  ],

  tableColumns: [
    'id',
    'filePrefix',
    'fileName',
    'fileCapacity',
    'inFlightLimit',
    'index'
  ],

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'filePrefix',
      value: '../saf/'
    },
    {
      class: 'String',
      name: 'fileName'
    },
    {
      class: 'Int',
      name: 'fileCapacity',
      value: 1024
    },
    {
      name: 'retryStrategy',
      class: 'FObjectProperty',
      of: 'foam.util.retry.RetryStrategy',
      javaFactory: `
        return (new RetryForeverStrategy.Builder(null))
          .setRetryDelay(4000)
          .build();
      `
    },
    {
      class: 'Int',
      name: 'timeWindow',
      units: 's',
      documentation: `When app starts, replay entries in timeWindow ago from now(the time that app starts).
If -1, no using timeWindow`,
      value: -1
    },
    {
      class: 'Boolean',
      name: 'ready',
      storageTransient: true,
      value: false,
      javaSetter:`
        readyIsSet_ = true;
        ready_ = val;
        isReady_.getAndSet(val);
        return;
      `,
      javaGetter: `
        return isReady_.get();
      `
    },
    {
      class: 'Int',
      name: 'inFlightLimit',
      value: 1024
    },
    {
      class: 'Long',
      name: 'index',
      javaGetter: 'return entryIndex_.get();',
      storageTransient: true,
      visibility: 'RO'
    },
    {
      class: 'Object',
      name: 'delegateObject',
      visibility: 'HIDDEN',
      transient: true,
    },
    {
      class: 'Object',
      name: 'nullDao',
      transient: true,
      visibility: 'HIDDEN',
      javaFactory: `
        return new NullDAO.Builder(getX()).setOf(SAFEntry.getOwnClassInfo()).build();
      `
    },
    {
      class: 'Object',
      name: 'manager',
      javaType: 'SAFManager',
      transient: true,
      visibility: 'HIDDEN',
      javaSetter: `
        managerIsSet_ = true;
        manager_ = val;
      `
    }
  ],

  methods: [
    {
      name: 'createWriteJournal',
      args: 'String fileName',
      documentation: 'helper function to create the SAF journal',
      javaType: 'SAFFileJournal',
      javaCode: `
        SAFFileJournal journal = new SAFFileJournal.Builder(getX())
                                  .setFilename(getFilePrefix() + fileName)
                                  .setCreateFile(false)
                                  .setDao(new foam.dao.NullDAO())
                                  .setLogger(new foam.core.logger.PrefixLogger(new Object[] { "[SAF]", fileName }, foam.core.logger.StdoutLogger.instance()))
                                  .build();
        if ( journal.getFileExist() == false ) {
          journal.createJournalFile();
          journal.setFileOffset(0);
        } else {
          journal.setFileOffset(journal.getFileSize());
        }
        return journal;
      `
    },
    {
      name: 'forward',
      args: 'SAFEntry e',
      documentation: 'Add the entry into process queue.',
      javaCode: `
        /* Assign initial time and enqueue. */
        e.setScheduledTime(System.currentTimeMillis());
        ((SAFManager) getManager()).enqueue(e);
      `
    },
    {
      name: 'storeAndForward',
      args: 'FObject fobject',
      javaType: 'FObject',
      documentation: 'write entry to journal and forward',
      javaCode: `
        X x = getX();

        HealthSupport healthSupport = (HealthSupport) x.get("healthSupport");
        Health health = healthSupport.getLocalHealth(x);
        if ( health == null ||
             ( health.getStatus() != HealthStatus.UP &&
               health.getStatus() != HealthStatus.DRAIN ) ) {
          Loggers.logger(x, this).debug("storeAndForward discard, local not UP or DRAIN");
          return fobject;
        }
        if ( ! getReady() ) {
          // REVIEW - need to through?
          throw new RuntimeException("SAF: " + getId() + " is not ready or did not initial properly");
        }

        SAFEntry entry = null;
        if ( fobject instanceof SAFEntry ) {
          entry = (SAFEntry) fobject;
        } else {
          entry = (SAFEntry) getX().get("SAFEntry");
          entry.setObject(fobject);
        }
        entry.setCreated(new Date());
        entry.setSaf(getId());
        entry.setRetryStrategy(getRetryStrategy());

        synchronized ( writeLock_ ) {
          long index = entryIndex_.incrementAndGet();
          entry.setIndex(index);
          SAFFileJournal journal = getJournal(toFileName(entry));
          entry = (SAFEntry) journal.put(getX(), "", (DAO) getNullDao(), entry);

          synchronized ( onHoldListLock_ ) {
            if ( onHoldList_.isEmpty() ) {
              onHoldList_.add(entry);
              cleanEntryInfos();
              forward(entry);
            } else {
              onHoldList_.add(entry);
            }
          }
        }
        // return fobject.fclone();
        return fobject;
      `
    },
    {
      name: 'successForward',
      args: 'SAFEntry e',
      documentation: 'handle entry when retry success',
      javaCode: `
        updateJournalOffsetAndForwardNext(e);
      `
    },
    {
      name: 'discardForward',
      args: 'SAFEntry e',
      documentation: 'Discard entry without forwarding. Used when SAF destination removed from system',
      javaCode: `
        updateJournalOffsetAndForwardNext(e);
      `
    },
    {
      name: 'updateJournalOffsetAndForwardNext',
      args: 'SAFEntry e',
      javaCode: `
        updateJournalOffset(e);

        synchronized ( onHoldListLock_ ) {
          onHoldList_.remove(0);
          if ( ! onHoldList_.isEmpty() ) {
            SAFEntry s = (SAFEntry) onHoldList_.get(0);
            cleanEntryInfos();
            forward(s);
          }
        }
      `
    },
    {
      name: 'updateJournalOffset',
      args: 'SAFEntry e',
      documentation: 'try to update byte offset to file atime',
      javaCode: `
        SAFFileJournal journal = fetchJournal(e);
        long atime = journal.getFileOffset();
        long entrySize = journal.calculateSize(e);
        long offset = atime + entrySize;
        journal.setFileOffset(offset);
      `
    },
    {
      name: 'failForward',
      args: 'SAFEntry e, Throwable t',
      documentation: 'handle entry when retry fail',
      javaCode: `
        /* Check retry attempt, then Update ScheduledTime and enqueue. */
        if ( ! e.getRetryStrategy().canRetry(getX()) )  {
          logger_.warning("Retry end: ", e.toString());
          updateJournalOffsetAndForwardNext(e);
        } else {
          updateNextScheduledTime(e);
          ((SAFManager) getManager()).enqueue(e);
        }
      `
    },
    {
      name: 'submit',
      args: 'Context x, SAFEntry entry',
      javaCode: `
        Object delegate = getDelegateObject();
        if ( delegate instanceof Box ) ((Box) delegate).send((Envelope) entry.getObject());
        else if ( delegate instanceof DAO ) ((DAO) delegate).put_(x, entry.getObject());
        else if ( delegate instanceof Sink ) ((Sink) delegate).put(entry.getObject(), null);
        else {
          Loggers.logger(getX(), this).error("DelegateObject type not supported", delegate.getClass().getName());
          throw new RuntimeException("DelegateObject type not supported");
        }
      `
    },
    {
      name: 'createDelegate',
      documentation: 'creating delegate when start up',
      javaCode: `
        return;
      `
    },
    {
      name: 'initialize',
      args: 'Context x',
      documentation: 'when system start, SAFManager will call this service to initialize re-forward',
      javaCode: `
        logger_ = Loggers.logger(x, this, getId(), getFileName());
        logger_.info("initialize");
        createDelegate();
        FileSystemStorage fileSystemStorage = getX().get(foam.core.fs.FileSystemStorage.class);
        java.io.File folder = fileSystemStorage.get(getFilePrefix());
        if ( ! folder.exists() ) folder.mkdir();
        List<String> filenames = new ArrayList<>(fileSystemStorage.getAvailableFiles(getFilePrefix(), getFileName()+".*"));

        if ( filenames.size() == 0 ) {
          isReady_.getAndSet(true);
          return;
        }

        List<String> availableFilenames = null;
        //Sort file from high index to low.
        filenames.sort((f1, f2) -> {
          int l1 = getFileSuffix(f1);
          int l2 = getFileSuffix(f2);
          return l1 > l2 ? -1 : 1;
        });

        Date timeWindow = null;
        maxFileIndex_ = getFileSuffix(filenames.get(0));

        if ( getTimeWindow() == -1 ) {
          Collections.reverse(filenames);
          availableFilenames = filenames;
        } else {
          availableFilenames = new ArrayList<>();
          Calendar rightNow = Calendar.getInstance();
          rightNow.add(Calendar.SECOND, -getTimeWindow());
          timeWindow = rightNow.getTime();

          for ( String filename : filenames ) {
            BasicFileAttributes attr = fileSystemStorage.getFileAttributes(getFilePrefix() + getSimpleFilename(filename));
            Date fileLastModifiedDate = new Date(attr.lastModifiedTime().toMillis());
            //TODO: mark journal as finished if unneed.
            if ( fileLastModifiedDate.before(timeWindow) ) break;
            availableFilenames.add(0, filename);
          }

        }

        synchronized ( onHoldListLock_ ) {

          for ( String filename : availableFilenames ) {

            SAFFileJournal journal = new SAFFileJournal.Builder(x)
                                    .setFilename(getFilePrefix() + getSimpleFilename(filename))
                                    .setCreateFile(false)
                                    .build();

            journalMap_.put(getSimpleFilename(filename), journal);
            if ( journal.getFileOffset() == journal.getFileSize() ) {
              Loggers.logger(getX(), this).info("SAF file complete", getId(), "file: " + getSimpleFilename(filename));
              continue;
            }
            if ( journal.getFileOffset() > journal.getFileSize() ) {
              Loggers.logger(getX(), this).error("SAF file error", getId(), "A-time of file: " + getSimpleFilename(filename) + " is greater than its filesize");
              journal.setFileOffset(journal.getFileSize());
              continue;
            }

            List<SAFEntry> list = new LinkedList<SAFEntry>();
            DAO tempDAO = new TempDAO(x, list);


            // Record atime, because read will change the atime.
            long offset = journal.getFileOffset();

            journal.replayFrom(x, tempDAO, offset);

            // Set back the offset.
            journal.setFileOffset(offset);

            for ( int i = 0 ; i < list.size() ; i++ ) {
              SAFEntry e = list.get(i);
              onHoldList_.add(e);
            }

            logger_.log("Successfully read " + list.size() + " entries from file: " + journal.getFilename() + " in SAF: " + getId());
          }

          if ( getTimeWindow() > -1 ) {
            for ( int i = onHoldList_.size() ; i > 0 ; i-- ) {
              SAFEntry e = onHoldList_.remove(0);
              if ( e.getCreated().before(timeWindow) ) {
                updateJournalOffset(e);
              } else {
                onHoldList_.add(0, e);
                break;
              }
            }
          }

          entryIndex_.set(maxFileIndex_ * getFileCapacity());

          if ( ! onHoldList_.isEmpty() ) {
            SAFEntry s = (SAFEntry) onHoldList_.get(0);
            cleanEntryInfos();
            forward(s);
          }
        }

        isReady_.getAndSet(true);
      `
    },
    {
      name: 'updateNextScheduledTime',
      args: 'SAFEntry e',
      javaType: 'SAFEntry',
      javaCode: `
        e.setRetryStrategy((RetryStrategy) ((FObject) e.getRetryStrategy()).fclone());

        entryCurStep_ = e.getRetryStrategy().getRetryDelay(getX());
        e.setScheduledTime(System.currentTimeMillis()+entryCurStep_);
        return e;
      `
    },
    {
      name: 'getStackTrace',
      args: 'SAFEntry e, Throwable t',
      javaType: 'String',
      javaCode:`
        String stackTrace = ExceptionUtils.getStackTrace(t);
        Outputter outputter = new Outputter(getX()).setPropertyPredicate(new NetworkPropertyPredicate());
        String entity = outputter.stringify(e.getObject());
        return entity + " \\n " + stackTrace;
      `
    },
    {
      name: 'toFileName',
      documentation: 'shot-cut help method to calculate filename from SAFEntry',
      args: 'SAFEntry entry',
      javaType: 'String',
      javaCode: `
        long index = entry.getIndex();
        long fileIndex = index / ((long) getFileCapacity());
        return getFileName() + "." + fileIndex;
      `
    },
    {
      name: 'getJournal',
      documentation: 'short-cut help method to get journal.',
      args: 'String filename',
      javaType: 'SAFFileJournal',
      javaCode: `
        return journalMap_.computeIfAbsent(filename, k -> createWriteJournal(k));
      `
    },
    {
      name: 'fetchJournal',
      args: 'SAFEntry entry',
      javaType: 'SAFFileJournal',
      javaCode: `
        return journalMap_.get(toFileName(entry));
      `
    },
    {
      name: 'getFileSuffix',
      documentation: 'help method to get suffix from file name',
      javaType: 'int',
      args: 'String filename',
      javaCode: `
        return Integer.parseInt(filename.split("\\\\.")[filename.split("\\\\.").length-1]);
      `
    },
    {
      name: 'getSimpleFilename',
      args: 'String filename',
      javaType: 'String',
      javaCode: `
        return filename.split("/")[filename.split("/").length-1];
      `
    },
    {
      name: 'cleanEntryInfos',
      javaCode: `
        entryCurStep_ = 0;
      `
    },
    {
      name: 'decommission',
      args: 'Context x',
      documentation: 'This SAF is no longer required.',
      javaCode: `
      logger_.info("decommision");
      `
    }
  ],

  axioms: [
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.extras.push(foam.java.Code.create({
          data: `
            protected Logger logger_ = null;
            protected volatile long entryCurStep_ = 0;

            final protected AtomicLong entryIndex_ = new AtomicLong(0);
            final protected Map<String, SAFFileJournal> journalMap_ = new ConcurrentHashMap<String, SAFFileJournal>();
            final protected Object writeLock_ = new Object();
            final protected Object onHoldListLock_ = new Object();
            final protected AtomicBoolean isReady_ = new AtomicBoolean(false);
            final protected List<SAFEntry> onHoldList_ = new LinkedList<SAFEntry>();
            protected volatile int maxFileIndex_ = 0;

            static private class TempDAO extends ProxyDAO {
              public foam.lang.ClassInfo getOf() {
                return SAFEntry.getOwnClassInfo();
              }
              protected List<SAFEntry> list;
              @Override
              public FObject put_(X x, FObject obj) {
                SAFEntry entry = (SAFEntry) obj;
                list.add(entry);
                return obj;
              }

              public TempDAO(X x, List<SAFEntry> l) {
                super(x, null);
                this.list = l;
              }
            }
          `
        }));
      }
    }
  ]
});
