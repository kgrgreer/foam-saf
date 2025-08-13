/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFManager',
  
  implements: [
    'foam.core.COREService',
  ],

  javaImports: [
    'foam.core.app.Health',
    'foam.core.app.HealthStatus',
    'foam.core.app.HealthSupport',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.Sink',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.X',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.NEQ',
    'foam.util.concurrent.AbstractAssembly',
    'foam.util.concurrent.AssemblyLine',
    'foam.util.concurrent.AsyncAssemblyLine',
    'foam.util.concurrent.SyncAssemblyLine',
    'foam.util.retry.NoRetryStrategy',
    'foam.util.retry.RetryForeverStrategy',
    'foam.util.retry.RetryStrategy',
    'java.util.ArrayList',
    'java.util.List',
    'java.util.Map',
    'java.util.PriorityQueue',
    'java.util.concurrent.TimeUnit',
    'java.util.concurrent.locks.Condition',
    'java.util.concurrent.locks.ReentrantLock'
  ],

  properties: [
    {
      documentation: 'Enable to generate debug log calls.',
      name: 'verbose',
      class: 'Boolean',
      value: false
    },
    {
      class: 'Object',
      javaType: 'PriorityQueue',
      name: 'prorityQueue',
      javaCloneProperty: '//noop',
      javaFactory: `
        return new PriorityQueue<SAFEntry>(16, (n, p) -> {
          if ( n.getScheduledTime() < p.getScheduledTime() ) {
            return -1;
          }
          if ( n.getScheduledTime() > p.getScheduledTime() ) {
            return 1;
          }
          return 0;
        });
      `,
      transient: true,
      visibility: 'HIDDEN'
    },
    {
      documentation: 'Map of all Store and Forwards',
      name: 'safs',
      class: 'Map',
      javaCloneProperty: '//noop',
      javaFactory: `return new java.util.concurrent.ConcurrentHashMap();`,
      transient: true,
      visibility: 'HIDDEN'
    }
  ],

  methods: [
    {
      name: 'enqueue',
      args: 'SAFEntry e',
      documentation: 'add entry into process queue, initForwarder method will take over the rest of job',
      javaCode: `
        PriorityQueue<SAFEntry> queue = (PriorityQueue) getProrityQueue();
        lock_.lock();
        try {
          queue.offer(e);
          notAvailable_.signal();
        } finally {
          lock_.unlock();
        }
      `
    },
    {
      name: 'initForwarder',
      args: 'Context x',
      javaThrows: [],
      documentation: 'processor that polls entries from queue and try delegate.put when there are available entries',
      javaCode: `
        Loggers.logger(x).info("SAFManager,forwarder,init");
        PriorityQueue<SAFEntry> queue = (PriorityQueue) getProrityQueue();
        SAFConfigSupport configSupport = (SAFConfigSupport) x.get("safConfigSupport");
        final HealthSupport healthSupport = (HealthSupport) x.get("healthSupport");
        Agency pool = (Agency) x.get(configSupport.getThreadPoolName());

        //TODO: use below code after finish testing.
        // final AssemblyLine assemblyLine = x.get(configSupport.getThreadPoolName()) == null ?
        //   new SyncAssemblyLine()   :
        //   new AsyncAssemblyLine(x) ;

        final AssemblyLine assemblyLine = new SyncAssemblyLine();

        pool.submit(x, new ContextAgent() {
          @Override
          public void execute(X x) {
            while ( true ) {
              if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,queue",queue.size());
              if ( queue.size() > 0 ) {
                if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,scheduled",queue.peek().getScheduledTime(), "current", System.currentTimeMillis());
                if ( queue.peek().getScheduledTime() <= System.currentTimeMillis() ) {
                  SAFEntry e = queue.peek();
                  final SAF saf = (SAF) getSafs().get(e.getSaf());
                  if ( saf == null ) {
                    // SAF removed, discard it's data.
                    try {
                       if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,discard", saf.getId(), e.getObject());
                      queue.remove(e);
                      SAF old = e.findSaf(x);
                      old.discardForward(e);
                      continue;
                    } catch ( Throwable t ) {
                      Loggers.logger(x).warning("SAFManager,forwarder,failed to discard", e.getSaf(), e);
                      throw new SAFException("Failed to discard");
                    }
                  }

                  Health health = healthSupport.getHealth(x, saf.getId());
                  if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,health", saf.getId(), health.toSummary());
                  if ( health != null &&
                       ( health.getStatus() == HealthStatus.UP ||
                         health.getStatus() == HealthStatus.MAINT ) ) {
                    assemblyLine.enqueue(new AbstractAssembly() {
                      public void executeJob() {
                        try {
                          if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,submit", saf.getId(), e.getObject());
                          queue.remove(e);
                          saf.submit(x, e);
                          try {
                            saf.successForward(e);
                          } catch ( Throwable t ) {
                            throw new SAFException(t);
                          }
                        }
                        catch ( SAFException safe ) {
                          Loggers.logger(x).error("SAFManager,forwarder,setReady,false", saf.getId(), safe.getCause());
                          saf.setReady(false);
                        }
                        catch ( Throwable t ) {
                          Loggers.logger(x).warning("SAFManager,forwarder,setReady,false", saf.getId(), t.getMessage());
                          //Loggers.logger(x).error("SAFManager,forwarder,setReady,false", saf.getId(), t);
                          try {
                            if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,failFoward", saf.getId());
                            saf.failForward(e, t);
                          } catch ( Throwable et ) {
                            Loggers.logger(x).error("SAFManager,forwarder,failFoward", saf.getId(), et);
                            saf.setReady(false);
                          }
                        }
                      }
                    });
                  }
                }
                if ( queue.size() > 0 ) {
                  long waitTime = queue.peek().getScheduledTime() - System.currentTimeMillis();
                  if ( waitTime > 0 ) {
                    lock_.lock();
                    try {
                      if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,await",waitTime);
                      notAvailable_.await(waitTime, TimeUnit.MILLISECONDS);
                    } catch ( InterruptedException e ) {
                      Loggers.logger(x).info("SAFManager,forwarder,interrupted",waitTime);
                    } finally {
                      lock_.unlock();
                    }
                  }
                } else {
                  lock_.lock();
                  try {
                    if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,await,2000");
                    notAvailable_.await(2000, TimeUnit.MILLISECONDS);
                  } catch ( InterruptedException e ) {
                    Loggers.logger(x).info("SAFManager,forwarder,interrupted");
                  } finally {
                    lock_.unlock();
                  }
                }
              } else {
                if ( getSafs().size() == 0 ) {
                  lock_.lock();
                  try {
                    // disable until SAFs available
                    if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,await");
                    notAvailable_.await();
                  } catch ( InterruptedException e ) {
                    Loggers.logger(x).info("SAFManager,forwarder,interrupted");
                  } finally {
                    lock_.unlock();
                  }
                } else {
                  lock_.lock();
                  try {
                    if ( getVerbose() ) Loggers.logger(x).debug("SAFManager,forwarder,await,2000");
                    notAvailable_.await(2000, TimeUnit.MILLISECONDS);
                  } catch ( InterruptedException e ) {
                    Loggers.logger(x).info("SAFManager,forwarder,interrupted");
                  } finally {
                    lock_.unlock();
                  }
                }
              }
            }
         } 
        }, "SAFManager");
      `
    },
    {
      name: 'start',
      documentation: 'Initialize each SAF',
      javaCode: `
        X x = getX();
        initForwarder(x);
        reload();
        ((DAO) x.get("safConfigDAO")).listen(new AbstractSink() {
          @Override
          public void put(Object obj, Detachable sub) {
            reload();
          }
        }, null);
      `
    },
    // TODO: stop - cancel forwarder, restart in reload
    {
      name: 'reload',
      javaCode: `
        X x = getX();
        Logger logger = Loggers.logger(x, this);
        List<String> ids = getBroadcastIds(x);
        Map<String, SAF> current = getSafs();
        for ( String id : current.keySet() ) {
          if ( ! ids.contains(id) ) {
            SAF saf = current.get(id);
            current.remove(id);
            saf.setRetryStrategy(new NoRetryStrategy());
            saf.setReady(false);
            saf.decommission(x);
            ((DAO) x.get("safDAO")).put_(x, saf.fclone());
          }
        }
        for ( String id : ids ) {
          try {
            SAF saf = null;
            if ( getSafs().get(id) == null ) {
              saf = createClient(x, id);
              saf.setManager(this);
              saf.setReady(true);
              saf.initialize(x);
              getSafs().put(id, saf);
              ((DAO) x.get("safDAO")).put_(x, saf);
              logger.info("SAF Initialized", id);
            }
          } catch ( Throwable t ) {
            logger.error("SAF Initialization failed", id, t); //.getMessage());
          }
        }
        lock_.lock();
        try {
          notAvailable_.signal();
        } finally {
          lock_.unlock();
        }
      `
    },
    {
      name: 'getBroadcastClients',
      args: 'X x',
      type: 'List',
      javaCode: `
        return new ArrayList(getSafs().values());
      `
    },
    {
      name: 'createClient',
      args: 'X x, String id',
      type: 'SAF',
      javaCode: `
        SAFConfigSupport support = (SAFConfigSupport) x.get("safConfigSupport");
        SAFConfig senderConfig = support.getLocalConfig(x);
        SAFConfig receiverConfig = support.getConfig(x, id);
        SAFClientDAO saf = new SAFClientDAO(x);
        saf.setId(receiverConfig.getId());
        saf.setFileName(receiverConfig.getId());
        saf.setSenderConfig(senderConfig);
        saf.setReceiverConfig(receiverConfig);
        saf.setDelegate(support.getBroadcastClientDAO(x, saf.getServiceName(), senderConfig, receiverConfig));
        return saf;
      `
    },
    {
      name: 'getBroadcastIds',
      args: 'X x',
      type: 'List',
      javaCode: `
        SAFConfigSupport support = (SAFConfigSupport) x.get("safConfigSupport");
        SAFConfig senderConfig = support.getLocalConfig(x);
        List<String> ids = new ArrayList();
        ((DAO) x.get("safConfigDAO"))
          .where(
            AND(
              EQ(SAFConfig.ENABLED, true),
              NEQ(SAFConfig.ID, senderConfig.getId())
            )
          )
          .select(new Sink() {
            public void put(Object obj, Detachable sub) {
              ids.add(((SAFConfig) obj).getId());
            }
            public void remove(Object obj, Detachable sub) {}
            public void eof() {}
            public void reset(Detachable sub) {}
          });
        return ids;
      `
    }
  ],

  axioms: [
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.extras.push(foam.java.Code.create({
          data: `
            private final ReentrantLock lock_ = new ReentrantLock();
            private final Condition notAvailable_ = lock_.newCondition();
          `
        }));
      }
    }
  ]
})
