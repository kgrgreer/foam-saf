/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFBroadcastDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `DAO decorator which wraps 'put' object in an SAFEntry
for processing by a remote client specific agent.
  See SAF and SAFManager for more info.

Objects that implement HealthAware are assigned this instances
healthId so they can be distinguised on the server for client/server
saf setups where the server is acting as a monitor.
NOTE: This is incompatible with DAOs using SeqNo.`,

  javaImports: [
    'foam.core.saf.SAFEntry',
    'foam.core.saf.SAFManager',
    'foam.core.app.Health',
    'foam.core.app.HealthAware',
    'foam.core.app.HealthStatus',
    'foam.core.app.HealthSupport',
    'foam.core.logger.StdoutLogger',
    'foam.dao.DAO',
    'foam.dao.DOP',
    'foam.dao.Sink',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'foam.lib.parse.PStream',
    'foam.lib.parse.ParserContextImpl',
    'foam.lib.parse.StringPStream',
    'foam.mlang.predicate.Predicate',
    'foam.parse.FScriptParser',
    'java.util.List'
  ],

  properties: [
    {
      name: 'cSpec',
      class: 'FObjectProperty',
      of: 'foam.core.boot.CSpec'
    },
    {
      name: 'threadPoolName',
      class: 'String',
      value: 'threadPool'
    },
    {
      // FScript predicate deciding whether an object is broadcast. Empty (the
      // default) broadcasts everything, exactly as before this property existed.
      // It is parsed once against the forwarded object's class and cached (see
      // javaExtras). Example: "severity == foam.log.LogLevel.WARN".
      name: 'safBroadcastPredicate',
      class: 'String'
    }
  ],

  javaCode: `
    // Parsed form of safBroadcastPredicate, built once on the first broadcast
    // and reused (the DAO is not cloned per put, so instance fields are safe).
    // parsed_ guards against re-parsing -- and re-warning about -- a script that
    // did not parse; predicate_ left null then means "broadcast all".
    protected volatile foam.mlang.predicate.Predicate predicate_;
    protected volatile boolean parsed_ = false;
  `,

  methods: [
    {
      name: 'put_',
      javaCode: `
      FObject o = getDelegate().put_(x, obj);
      if ( o instanceof HealthAware ) {
        HealthAware ha = (HealthAware) o;
        Health health = (Health) x.get("Health");
        if ( health != null &&
             ( ha.getHealth() == null ||
               SafetyUtil.isEmpty(ha.getHealth().toString()) ) )
          ha.setHealth(health.getId().toSummary());
      }
      if ( shouldBroadcast(o) ) broadcast(x, o, DOP.PUT);
      return o;
      `
    },
    {
      name: 'remove_',
      javaCode: `
      FObject o = getDelegate().remove_(x, obj);
      // Gate removes by the same predicate: an object never forwarded on put
      // should not send a remove either, or the monitor sees an orphan delete.
      if ( shouldBroadcast(o) ) broadcast(x, o, DOP.REMOVE);
      return o;
      `
    },
    {
      // TODO: if the cloning and submission to remote specific client
      // could be delayed, or even queues per client.
      documentation: 'Broadcast to other instances',
      name: 'broadcast',
      args: 'Context x, FObject obj, DOP dop',
      javaCode: `
      final SAFManager safManager = (SAFManager) x.get("safManager");
      final List<DAO> clients = (List<DAO>) safManager.getBroadcastClients(x);

      SAFEntry entry = x.create(SAFEntry.class);
      entry.setCSpecName(getCSpec().getName());
      entry.setDop(dop);
      entry.setObject(obj);

      Agency agency = (Agency) x.get(getThreadPoolName());
      for ( DAO client : clients ) {
        agency.submit(x, new ContextAgent() {
          public void execute(X x) {
            try {
              client.put((SAFEntry) entry.fclone());
            } catch ( Throwable t ) {
              StdoutLogger.instance().error(getCSpec().getName(), "broadcast", client, t);
            }
          }
        }, this.getClass().getSimpleName());
      }
      `
    },
    {
      documentation: `Whether obj should be broadcast. An empty safBroadcastPredicate
        (the default) is always true, so SAF forwards everything as before. A set
        predicate is parsed once against obj's class and applied; a predicate that
        fails to parse is treated as true (fail open) so a config typo never
        silently drops data.`,
      name: 'shouldBroadcast',
      args: 'FObject obj',
      type: 'Boolean',
      javaCode: `
      if ( SafetyUtil.isEmpty(getSafBroadcastPredicate()) ) return true;
      Predicate predicate = getBroadcastPredicate(obj);
      if ( predicate == null ) return true;
      return predicate.f(obj);
      `
    },
    {
      documentation: `Parse safBroadcastPredicate (an FScript string) once against
        the forwarded object's class and cache it. Parsing against the class is
        what binds a bare property such as 'severity' to obj (obj.getSeverity()
        at f() time); a dotted path like 'foam.log.LogLevel.WARN' parses to that
        enum constant. Returns null, and logs once, when the script does not
        parse to a predicate -- the caller then broadcasts all.`,
      name: 'getBroadcastPredicate',
      args: 'FObject obj',
      type: 'foam.mlang.predicate.Predicate',
      javaCode: `
      if ( parsed_ ) return predicate_;
      synchronized ( this ) {
        if ( parsed_ ) return predicate_;
        Predicate predicate = null;
        try {
          FScriptParser parser = FScriptParser.create(obj.getClassInfo());
          StringPStream sps = new StringPStream();
          sps.setString(getSafBroadcastPredicate());
          PStream ps = parser.parse(sps, new ParserContextImpl());
          if ( ps != null && ps.value() instanceof Predicate ) {
            predicate = (Predicate) ps.value();
          } else {
            StdoutLogger.instance().warning(getCSpec().getName(), "safBroadcastPredicate", "did not parse to a predicate, broadcasting all", getSafBroadcastPredicate());
          }
        } catch ( Throwable t ) {
          StdoutLogger.instance().error(getCSpec().getName(), "safBroadcastPredicate", "parse error, broadcasting all", getSafBroadcastPredicate(), t);
        }
        predicate_ = predicate;
        parsed_    = true;
        return predicate_;
      }
      `
    }
  ]
});
