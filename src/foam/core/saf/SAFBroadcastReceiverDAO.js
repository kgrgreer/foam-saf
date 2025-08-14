/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFBroadcastReceiverDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.DAO',
    'foam.dao.DOP',
    'foam.core.pm.PM',
    'foam.core.logger.Loggers',
    'foam.core.saf.SAFEntry'
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
      PM pm = PM.create(x, this.getClass().getSimpleName(), "put");
      SAFSupport support = (SAFSupport) x.get("safSupport");
      SAFEntry entry = (SAFEntry) obj;

      DAO dao = ((DAO) x.get(entry.getCSpecName()));
      if ( dao == null ) {
        Loggers.logger(x, this).warning("SAFBroadcastReceiverDAO,CSpec not found", entry.getCSpecName());
        return obj;
      }
      DAO mdao = (DAO) dao.cmd_(x, foam.dao.DAO.LAST_CMD);
      if ( mdao == null ) {
        Loggers.logger(x, this).error("SAFBroadcastReceiverDAO,DAO not found", entry.getCSpecName());
        // Alarm? - this may cause a feedback loop.
        return obj;
      }
      try {
        FObject nu = entry.getObject();
        if ( support.getVerbose() ) Loggers.logger(x, this).debug("SAFBroadcastReceiverDAO,receive",entry.getCSpecName(), entry.getDop(), nu);
        if ( DOP.PUT == entry.getDop() ) {
          nu = mdao.put_(x, nu);
        } else if ( DOP.REMOVE == entry.getDop() ) {
          nu = mdao.remove_(x, nu);
        } else {
          throw new UnsupportedOperationException(entry.getDop().toString());
        }
        return nu;
      } catch (Throwable t) {
        pm.error(x, entry, t);
        Loggers.logger(x, this).error("put", entry, t.getMessage(), t);
        throw t;
      } finally {
        pm.log(x);
      }
      `
    }
  ]
});
