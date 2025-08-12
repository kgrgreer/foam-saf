/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'EasyDAORefinement',
  refines: 'foam.dao.EasyDAO',

  methods: [
    {
      name: 'getClusterDelegate',
      args: 'foam.dao.DAO delegate',
      type: 'foam.dao.DAO',
      javaCode: `
        if ( getMdao() != null &&
             getSaf() ) {
          return new foam.box.saf.SAFBroadcastDAO.Builder(getX())
            .setCSpec(getCSpec())
            .setDelegate(delegate)
            .build();
        }
        return delegate;
      `
    }
  ]
});
