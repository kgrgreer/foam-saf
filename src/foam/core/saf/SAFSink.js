/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFSink',
  extends: 'foam.core.saf.SAF',
  implements: [ 'foam.dao.Sink' ],

  javaImports: [
    'foam.lang.FObject',
    'foam.dao.HTTPSink',
    'foam.dao.Sink'
  ],

  properties: [
    {
      class: 'String',
      name: 'delegateCspecId',
    },
    {
      class: 'Proxy',
      of: 'foam.dao.Sink',
      name: 'delegate',
      transient: true
    }
  ],

  methods: [
    {
      name: 'put',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: `
        this.storeAndForward((FObject) obj);
      `
    },
    {
      name: 'submit',
      args: 'Context x, SAFEntry entry',
      javacode: `
        getDelegate().put(entry.getObject(), null);
      `
    },
    {
      name: 'createDelegate',
      documentation: 'creating delegate when start up',
      javaCode: `
        Sink sink = (Sink) getX().get(getDelegateCspecId());
        if ( sink == null ) throw new RuntimeException("CspecId not found (sink): " + getDelegateCspecId());
        setDelegate(sink);
      `
    },
    {
      name: 'remove',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: `
      throw new UnsupportedOperationException("SAFSink do not implement 'remove' method");
      `
    },
    {
      name: 'eof',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: `
      throw new UnsupportedOperationException("SAFSink do not implement 'remove' method");
      `
    },
    {
      name: 'reset',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: `
      throw new UnsupportedOperationException("SAFSink do not implement 'remove' method");
      `
    }
  ]
})
