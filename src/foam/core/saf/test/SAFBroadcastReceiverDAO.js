/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf.test',
  name: 'SAFBroadcastReceiverTestDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.core.saf.SAFEntry'
  ],

  properties: [
    {
      name: 'count',
      class: 'Int'
    },
    {
      name: 'lastSAFEntry',
      class: 'FObjectProperty',
      of: 'foam.core.saf.SAFEntry'
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
      setCount(getCount() +1);
      setLastSAFEntry((SAFEntry) obj);
      return obj;
      `
    }
  ]
});
