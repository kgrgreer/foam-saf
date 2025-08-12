/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAFEntryFactory',
  javaImplements: [ 'foam.lang.XFactory' ],

  documentation: 'Context Factory for SAFEntry instances',

  javaImports: [
    'foam.lang.X'
  ],

  methods: [
    {
      name: 'create',
      args: 'X x',
      type: 'Object',
      javaCode: 'return new SAFEntry(x);'
    }
  ]
});
