/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'HealthHeartbeatServiceRefines',
  refines: 'foam.core.app.HealthHeartbeatService',

  documentation: `Supplies the DIRECT-mode heartbeat peers from the SAF
    configuration. foam.core.app.HealthHeartbeatService.getPeers returns an
    empty list in foam3 core, since core knows nothing about SAF; this
    refinement returns one InetSocketAddress per enabled SAFConfig other than
    this instance, so a DIRECT (unicast) heartbeat reaches exactly the peers
    this instance already forwards SAF entries to. DIRECT is for environments
    such as AWS where multicast (BROADCAST / LOOPBACK) is unavailable.`,

  javaImports: [
    'foam.core.saf.SAFConfig',
    'foam.core.saf.SAFSupport',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.lang.Detachable',
    'foam.net.Host',
    'java.net.InetSocketAddress',
    'java.util.ArrayList',
    'java.util.List',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.EQ',
    'static foam.mlang.MLang.NEQ'
  ],

  methods: [
    {
      name: 'getPeers',
      args: 'X x',
      javaType: 'java.util.List',
      javaCode: `
        List peers = new ArrayList();

        SAFSupport support = (SAFSupport) x.get("safSupport");
        if ( support == null ) return peers;
        SAFConfig self = support.getLocalConfig(x);
        if ( self == null ) return peers;

        final DAO hostDAO = (DAO) x.get("hostDAO");
        // The heartbeat listens on the shared Health port, not the SAFConfig's
        // SAF socket port, so every peer is reached at getPort() (e.g. 52241).
        final int port = getPort();

        ((DAO) x.get("safConfigDAO"))
          .where(AND(
            EQ(SAFConfig.ENABLED, true),
            NEQ(SAFConfig.ID, self.getId())
          ))
          .select(new AbstractSink() {
            public void put(Object obj, Detachable sub) {
              SAFConfig c = (SAFConfig) obj;
              // Resolve the address the same way SAF resolves a forward
              // destination: hostDAO (hosts.jrl), else the config id as the
              // hostname (so it resolves via /etc/hosts or DNS).
              String address = c.getId();
              Host host = hostDAO != null ? (Host) hostDAO.find(address) : null;
              if ( host != null ) address = host.getAddress();
              peers.add(new InetSocketAddress(address, port));
            }
          });

        return peers;
      `
    }
  ]
});
