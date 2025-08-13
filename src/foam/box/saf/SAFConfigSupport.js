/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAFConfigSupport',

  axioms: [
    foam.pattern.Singleton.create()
  ],

  javaImports: [
    'foam.box.Box',
    'foam.box.SessionClientBox',
    'foam.box.socket.SocketClientBox',
    'foam.box.socket.SocketServer',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.core.session.Session',
    'foam.dao.DAO',
    'foam.dao.NotificationClientDAO',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.OR',
    'foam.net.Host',
    'foam.net.Port',
    'foam.lang.X',
  ],

  properties: [
    {
      name: 'threadPoolName',
      class: 'String',
      value: 'boxThreadPool'
    }
  ],

  methods: [
    {
      name: 'getLocalConfig',
      args: 'X x',
      type: 'SAFConfig',
      javaCode: `
      String hostname = System.getProperty("hostname", "localhost");
      if ( "localhost".equals(hostname) ) {
        hostname = System.getProperty("user.name");
      }
      return getConfig(x, hostname);
      `
    },
    {
      name: 'getConfig',
      args: 'X x, String id',
      type: 'SAFConfig',
      javaCode: `
      SAFConfig config = (SAFConfig) ((DAO) x.get("safConfigDAO"))
        .find(
          OR(
            EQ(SAFConfig.ID, id),
            EQ(SAFConfig.NAME, id)
          ));
      if ( config == null ) {
        Loggers.logger(x, this).warning("SAFConfig not found", id);
      }
      return config;
      `
    },
    {
      documentation: 'Notification client is send and forget, does not register a reply box.',
      name: 'getBroadcastClientDAO',
      args: 'X x, String serviceName, SAFConfig senderConfig, SAFConfig receiverConfig',
      type: 'foam.dao.DAO',
      javaCode: `
      PM pm = PM.create(x, this.getClass().getSimpleName(), "getBroadcastClientDAO");
      try {
        String sessionId = receiverConfig.getSessionId();
        Session session = (Session) x.get("session");
        if ( session != null ) {
          sessionId = session.getId();
        }
        return new NotificationClientDAO.Builder(x)
          .setOf(SAFEntry.getOwnClassInfo())
          .setDelegate(new SessionClientBox.Builder(x)
          .setSessionID(sessionId)
          .setDelegate(getSocketClientBox(x, serviceName, senderConfig, receiverConfig))
          .build())
        .build();
      } finally {
        pm.log(x);
      }
      `
    },
    {
      name: 'getSocketClientBox',
      type: 'SocketClientBox',
      args: 'X x, String serviceName, SAFConfig senderConfig, SAFConfig receiverConfig',
      javaCode: `
      PM pm = PM.create(x, this.getClass().getSimpleName(), "getSocketClientBox");
      try {
        String address = receiverConfig.getId();
        DAO hostDAO = (DAO) x.get("hostDAO");
        Host host = (Host) hostDAO.find(address);
        if ( host != null ) {
          address = host.getAddress();
        }
        int port = receiverConfig.getPort();
        if ( port == 0 ) {
          port = foam.net.Port.get(x, "SocketServer");
        }

        SocketClientBox clientBox = new SocketClientBox();
        clientBox.setX(x);
        clientBox.setHost(address);
        clientBox.setPort(port);
        clientBox.setServiceName(serviceName);
        // getLogger().debug("getSocketClientBox", serviceName, clientBox);
        return clientBox;
      } finally {
        pm.log(x);
      }
      `
    },
  ]
});
