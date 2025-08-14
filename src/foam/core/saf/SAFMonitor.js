/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFMonitor',
  extends: 'foam.core.saf.SAF',

  javaImports: [
    'foam.lang.X'
  ],

  tableColumns: [
    'id',
    'ready',
    'index',
    'onHoldListSize'
  ],

  javaCode: `
    public SAFMonitor(X x, SAF saf) {
      this.setX(saf.getX());
      this.setId(saf.getId());
      this.setReady(saf.getReady());
      this.setIndex(saf.getIndex());
      this.setOnHoldListSize(saf.getOnHoldListSize());
    }
  `
})
