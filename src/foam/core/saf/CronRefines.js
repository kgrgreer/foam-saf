/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'CronRefines',
  refines: 'foam.core.cron.Cron',

  methods: [
    {
      name: 'canRun',
      args: 'Context x',
      type: 'Boolean',
      javaCode: `

        if ( getClusterable() ) {
          foam.core.app.Health health = (foam.core.app.Health) x.get("Health");
          return health.getStatus() == foam.core.app.HealthStatus.UP;
        }
        if ( getReattemptRequested() )
          return getReattempts() < getMaxReattempts();

        return true;
      `
    }
  ]
});
