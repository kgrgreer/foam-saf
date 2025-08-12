/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAFBOX',
  extends: 'foam.box.saf.SAF',
  implements: [ 'foam.box.Box' ],

  javaImports: [
    'foam.lang.FObject',
    'foam.box.Box',
    'foam.box.Envelope'
  ],
  
  properties: [
    {
      class: 'String',
      name: 'delegateCspecId',
    },
    {
      class: 'Proxy',
      of: 'foam.box.Box',
      name: 'delegate',
      transient: true
    }
  ],

  methods: [
    {
      name: 'send',
      javaCode: `
        this.storeAndForward((FObject) envelope);
      `
    },
    {
      name: 'submit',
      args: 'Context x, SAFEntry entry',
      javaCode: `
        getDelegate().send((foam.box.Envelope)entry.getObject());
      `
    },
    {
      name: 'createDelegate',
      documentation: 'creating delegate when start up',
      javaCode: `
        Box box = (Box) getX().get(getDelegateCspecId());
        if (  box == null ) throw new RuntimeException("Cspec not found (box): " + getDelegateCspecId());
        setDelegate(box);
      `
    },
  ]
});
