/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf.test',
  name: 'SAFTest',
  extends: 'foam.core.test.Test',

  documentation: `This test should be run indpendently of other tests
`,

  javaImports: [
    'foam.core.saf.*',
    'foam.core.COREService',
    'foam.core.app.*',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.dao.ProxyDAO',
    'foam.lang.X',
    'foam.util.SafetyUtil'
  ],

  javaCode: `
    String appName_ = "test";
    String id1_ = "safT1";
    String id2_ = "safT2";
    Health health1_;
    Health health2_;
  `,

  methods: [
    {
      name: 'setup',
      args: 'X x',
      type: 'Context',
      javaCode: `
      x.get("http");
      x.get("socketServer");

      Logger logger = Loggers.logger(x, this);
      logger.info("setup,healthHeartbeatService,stop");
      COREService cs = (COREService) x.get("healthHeartbeatService");
      cs.stop();
      logger.info("setup,healthHeartbeatMonitor,stop");
      cs = (COREService) x.get("healthHeartbeatMonitor");
      cs.stop();

      // Replace SAFConfig 1 with our real hostname as the SAF
      // system will aquire 'local' config - which uses the
      // System hostname or user.name
      health1_ = ((HealthSupport) x.get("healthSupport")).getLocalHealth(x);
      DAO safConfigDAO = (DAO) x.get("safConfigDAO");
      SAFConfig config = (SAFConfig) safConfigDAO.find(id1_);
      safConfigDAO.remove(config);
      config = (SAFConfig) config.fclone();
      config.setId(health1_.getHostname());
      safConfigDAO.put_(x, config);
      id1_ = health1_.getHostname();
      logger.info("setup,id1", id1_);
  
      Health health = (Health) x.get("Health");
      health.setAppName(appName_);
      health.setHostname(id1_);
      health1_ = (Health) ((DAO) x.get("healthDAO")).put_(x, health).fclone();
      health = (Health) health1_.fclone();
      health.setAppName(appName_);
      health.setHostname(id2_);
      health2_ = (Health) ((DAO) x.get("healthDAO")).put_(x, health).fclone();

      return x;
      `
    },
    {
      name: 'runTest',
      javaCode: `
      try {
        x = setup(x);
        Logger logger = Loggers.logger(x, this);
        DAO safConfigDAO = (DAO) x.get("safConfigDAO");
        SAFManager safManager = (SAFManager) x.get("safManager");
        DAO safTestObjectDAO = (DAO) x.get("safTestObjectDAO");
        DAO healthDAO = (DAO) x.get("healthDAO");
        SAFBroadcastReceiverTestDAO receiverDAO = (SAFBroadcastReceiverTestDAO) ((ProxyDAO) x.get("safBroadcastReceiverTestDAO")).getDelegate();

        // test system configured
        AppConfig appConfig = (AppConfig) x.get("appConfig");
        test ( appConfig.getName().equals(appName_), "AppName "+appName_+": "+appConfig.getName());

        // test safTestObjectDAO has SAF decoration
        boolean found = false;
        DAO proxy = (ProxyDAO) safTestObjectDAO;
        while ( proxy != null ) {
          if ( proxy instanceof SAFBroadcastDAO ) {
            found = true;
            break;
          }
          if ( proxy instanceof ProxyDAO ) {
            proxy = ((ProxyDAO) proxy).getDelegate();
          } else {
            break;
          }
        }
        test ( found, "safTestObjectDAO configured");
        test ( receiverDAO != null, "Test receiver DAO found");

        // initial state, both instances DOWN, instance 2 disabled.
        test ( safManager != null, "SAFManager found");
        test ( safManager.getSafs().size() == 0, "SAFManager no SAFs found: "+safManager.getSafs().size());

        // enable SAF Config
        SAFConfig config1 = (SAFConfig) safConfigDAO.find(id1_).fclone();
        config1.setEnabled(true);
        config1 = (SAFConfig) safConfigDAO.put_(x, config1);

        SAFConfig config2 = (SAFConfig) safConfigDAO.find(id2_).fclone();
        config2.setEnabled(true);
        config2 = (SAFConfig) safConfigDAO.put_(x, config2);

        // SAFManager should now have one SAF
        test ( safManager.getSafs().size() == 1, "SAFManager one SAFs found: "+safManager.getSafs().size());
        SAF saf = (SAF) safManager.getSafs().get(id2_);
        test ( saf.getId() == id2_, "SAF "+id2_+" found: "+saf.getId());
        test ( saf.getIndex() == 0, "SAF index 0: "+saf.getIndex());

        // create an update, nothing should occur
        SAFTestObject sto = new SAFTestObject();
        sto.setData("1");
        logger.info("SAFTestObject,create",sto.getData());
        sto = (SAFTestObject) safTestObjectDAO.put_(x, sto).fclone(); 
        test ( ! SafetyUtil.isEmpty( sto.getId() ), "SAFTestObject created: "+sto.getId());
        test ( saf.getIndex() == 0, "SAF index still 0: "+saf.getIndex());

        // bring local Health up
        health1_.setStatus(HealthStatus.UP);
        health1_ = (Health) healthDAO.put_(x, health1_);
        health1_ = (Health) healthDAO.find_(x, health1_);
        test ( health1_.getStatus() == HealthStatus.UP, "Health1 status UP: "+health1_.getStatus());

        // create another 
        sto = new SAFTestObject();
        sto.setData("2");
        logger.info("SAFTestObject,create",sto.getData());
        sto = (SAFTestObject) safTestObjectDAO.put_(x, sto).fclone();
        test ( ! SafetyUtil.isEmpty( sto.getId() ), "SAFTestObject created: "+sto.getId());
        try {
          Thread.currentThread().sleep(200);
        } catch (InterruptedException e) {
          // nop
        }
        test ( saf.getIndex() == 1, "SAF index 1: "+saf.getIndex());
        test ( receiverDAO.getCount() == 0, "Nothing forwarded: "+receiverDAO.getCount());

        // bring remote Health maint
        health2_.setStatus(HealthStatus.MAINT);
        health2_ = (Health) healthDAO.put_(x, health2_);
        health2_ = (Health) healthDAO.find_(x, health2_);
        test ( health2_.getStatus() == HealthStatus.MAINT, "Health2 status MAINT: "+health2_.toSummary());
        try {
          Thread.currentThread().sleep(5000);
        } catch (InterruptedException e) {
          // nop
        }
        test ( receiverDAO.getCount() == 1, "Entry forwarded: "+receiverDAO.getCount());

        // create another 
        sto = new SAFTestObject();
        sto.setData("3");
        logger.info("SAFTestObject,create",sto.getData());
        sto = (SAFTestObject) safTestObjectDAO.put_(x, sto).fclone();
        test ( ! SafetyUtil.isEmpty( sto.getId() ), "SAFTestObject created: "+sto.getId());
        try {
          Thread.currentThread().sleep(5000);
        } catch (InterruptedException e) {
          // nop
        }
        test ( saf.getIndex() == 2, "SAF index 2: "+saf.getIndex());
        test ( receiverDAO.getCount() == 1, "Entry forwarded: "+receiverDAO.getCount());
      } finally {
        teardown(x);
      }
      `
    },
    {
      name: 'teardown',
      args: 'X x',
      javaCode: `
      ((DAO) x.get("healthDAO")).removeAll();
      ((DAO) x.get("safConfigDAO")).removeAll();
      `
    }
  ]
});
