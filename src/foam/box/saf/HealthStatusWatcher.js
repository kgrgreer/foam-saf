/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'HealthStatusWatcher',
  extends: 'foam.core.fs.Watcher',

  documentation: 'Monitor for HealthStatus change request',

  javaImports: [
    'foam.core.app.Health',
    'foam.core.app.HealthStatus',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.SafetyUtil'
  ],

  methods: [
    {
      name: 'acceptRequest',
      javaCode: `
      HealthStatus status = HealthStatus.valueOf(request);
      return status != null;
      `
    },
    {
      name: 'handleRequest',
      javaCode: `
        Logger logger = Loggers.logger(x, this);
        HealthStatus status = HealthStatus.valueOf(request);
        DAO dao = (DAO) x.get("healthDAO");
        Health health = (Health) x.get("Health");
        logger.warning("HealtStatus", health.getStatus(), status);
        health.setStatus(status);
        dao.put_(x, health);
      `
    }
  ]
});
