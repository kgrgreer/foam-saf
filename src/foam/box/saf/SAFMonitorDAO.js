/**
* @license
* Copyright 2022 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAFMonitorDAO',
  extends: 'foam.dao.ProxyDAO',

  javaImports: [
    'foam.dao.Sink',
    'foam.dao.ArraySink',
    'java.util.Map'
  ],

  properties: [
    {
      class: 'FObjectProperty',
      name: 'safManager',
      of: 'foam.box.saf.SAFManager',
      javaFactory: `
        return (SAFManager) getX().get("safManager");
      `
    }
  ],

  methods: [
    {
      name: 'find_',
      javaCode: `
        SAF saf = (SAF) getSafManager().getSafs().get((String) id);
        return new SAFMonitor(x, saf);
      `
    },
    {
      name: 'select_',
      javaCode:`
        Map<String, SAF> safMap = getSafManager().getSafs();
        sink = sink == null ? new ArraySink() : sink;
        for ( Map.Entry<String, SAF> e : safMap.entrySet() ) {
          sink.put(new SAFMonitor(null, e.getValue()), null);
        }
        sink.eof();
        return sink;
      `
    }
  ]
})
