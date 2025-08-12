/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAFMonitor',
  extends: 'foam.box.saf.SAF',

  javaImports: [
    'foam.lang.X'
  ],

  tableColumns: [
    'id',
    'ready',
    'inFlightCount',
    'inFlightLimit'
  ],

  properties: [
    {
      class: 'Int',
      name: 'inFlightCount'
    },
    {
      class: 'Boolean',
      name: 'ready'
    },
    {
      class: 'Long',
      name: 'initialIndex'
    }
  ],

  javaCode: `
    public SAFMonitor(X x, SAF saf) {
      this.setX(saf.getX());
      this.setId(saf.getId());
      this.setReady(saf.getReady());
      this.setInFlightLimit(saf.getInFlightLimit());
      this.setInFlightCount(saf.onHoldList_.size());
      this.setInitialIndex(saf.maxFileIndex_*saf.getFileCapacity());
    }
  `
})
