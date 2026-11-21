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
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.dao.DOP',
    'foam.dao.Sink',
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.util.SafetyUtil',
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
    }
  ],

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
      broadcast(x, o, DOP.PUT);
      return o;
      `
    },
    {
      name: 'remove_',
      javaCode: `
      FObject o = getDelegate().remove_(x, obj);
      broadcast(x, o, DOP.REMOVE);
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
              Loggers.logger(x, this).error(getCSpec().getName(), "broadcast", client, t);
            }
          }
        }, this.getClass().getSimpleName());
      }
      `
    }
  ]
});
