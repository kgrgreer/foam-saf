/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'EasyDAORefines',
  refines: 'foam.dao.EasyDAO',

  properties: [
    {
      // FScript predicate; when set, only objects it matches are store-and-
      // forwarded. Empty (the default) forwards everything, preserving prior
      // behaviour. Consumed by SAFBroadcastDAO, installed in getClusterDelegate.
      class: 'String',
      name: 'safBroadcastPredicate',
      documentation: 'FScript predicate; an object is store-and-forwarded only when it matches. Empty = forward all.'
    }
  ],

  methods: [
    {
      name: 'getClusterDelegate',
      args: 'foam.dao.DAO delegate',
      type: 'foam.dao.DAO',
      javaCode: `
        if ( /* getMdao() != null &&*/
             getSaf() ) {
          return new foam.core.saf.SAFBroadcastDAO.Builder(getX())
            .setCSpec(getCSpec())
            .setSafBroadcastPredicate(getSafBroadcastPredicate())
            .setDelegate(delegate)
            .build();
        }
        return delegate;
      `
    }
  ]
});
