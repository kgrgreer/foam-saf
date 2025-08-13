/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.saf',
  name: 'DUGSFRuleAction',
  extends: 'foam.core.dig.DUGRuleAction',
  
  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.dao.HTTPSink',
    'foam.dao.Sink',
    'foam.core.logger.Loggers'
  ],
  
  properties: [
    {
      class: 'String',
      name: 'safId',
    }
  ],
  
  methods: [
    {
      name: 'getDelegateSink',
      args: 'X agencyX, foam.core.ruler.Rule rule',
      type: 'foam.dao.Sink',
      javaCode: `
        SAFManager safManager = (SAFManager) agencyX.get("safManager");
        Sink sink = (Sink) safManager.getSafs().get(getSafId());
        if ( sink == null ) {
          Loggers.logger(agencyX, this).error("SAF Sink not found, SAFId", getSafId());
          throw new RuntimeException("SAF Sink not found");
         }
        return sink;
      `
    }
  ],
});
