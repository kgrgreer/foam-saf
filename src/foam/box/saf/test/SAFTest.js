/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf.test',
  name: 'SAFTest',
  extends: 'foam.core.test.Test',

  documentation: `

   Manually manage config and health
   custom SAFBroadcastReceiverDAO which counts received
   appName: test
   hosts: safT1, safT2 pointing at localhost

`,
  
  javaImports: [
    'foam.core.app.Health',
    'foam.core.app.HealthStatus',
    'foam.dao.DAO',
    'foam.box.saf.*',
    'foam.lang.COREService',
    'foam.lang.X'
  ],

  javaCode: `
    String appName_ = "test";
    String id1_ = "safT1";
    String id2_ = "safT2";
    Health health1_;
    Health health2_;
    SAFBroadcastReceiverDAO receiverDAO_;

    // Replace SAFConfig 1 with our real hostname as the SAF
    // system will aquire 'local' config - which uses the
    // System hostname
    String hostname = System.getProperty("hostname", "localhost");
    if ( ! hostname.equals("localhost") ) {
      DAO safConfigDAO = (DAO) x.get("safConfigDAO");
      SAFConfig config = (SAFConfig) safConfigDAO.find(id1_);
      safConfigDAO.remove(config);
      config = (SAFConfig) config.fclone();
      config.setHostname(hostname);
      safConfigDAO.put_(x, config);
      id1_ = hostname;
    }

    receiverDAO_ = (SAFBroadcastReceiverDAO) x.get("testSAFBroadcastReceiverDAO");

  `,

  methods: [
    {
      name: 'setup',
      args: 'X x',
      type: 'Context',
      javaCode: `
      COREService cs = (COREService) x.get("healthHeartbeatService");
      cs.stop();
      cs = (COREService) x.get("healthHeartbeatMonitor");
      cs.stop();

      Health health = (Health) x.get("Health");
      health.setAppName(appName_);
      health.setHostname(id1_);
      health1_ = (Health) ((DAO) x.get("healthDAO")).put_(x, health);
      health = (Health) health1_.fclone();
      health.setAppName(appName_);
      health.setHostname(id2_);
      health2_ = (Health) ((DAO) x.get("healthDAO")).put_(x, health);

      return x;
      `
    },
    {
      name: 'runTest',
      javaCode: `
      try {
        x = setup(x);

        // initial state, both instances DOWN, instance 2 disabled.

      } finally {
        teardown(x);
      }
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaCode: `
      ((DAO) x.get("healthDAO")).remoteAll();
      ((DAO) x.get("safConfigDAO")).remoteAll();
      `
    }
  ]
});
