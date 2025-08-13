/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf.test',
  name: 'SAFBroadcastReceiverTestDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.box.saf.SAFEntry',
    'foam.core.logger.Loggers'
  ],

  properties: [
    {
      name: 'count',
      class: 'Int'
    },
    {
      name: 'lastSAFEntry',
      class: 'FObjectProperty',
      of: 'foam.box.saf.SAFEntry'
    }
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
      Loggers.logger(x, this).info("put_", obj);
      setCount(getCount() +1);
      setLastSAFEntry((SAFEntry) obj);
      return obj;
      `
    }
  ]
});
