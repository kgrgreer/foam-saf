/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.saf',
  name: 'DUGSAFRule',
  extends: 'foam.core.dig.DUGRule',
  
  javaImports: [
    'foam.lang.ContextAgent',
    'foam.lang.X',
    'foam.dao.AbstractSink',
    'foam.dao.DAO',
    'foam.dao.HTTPSink',
    'foam.dao.Sink',
  ],
  
  properties: [    
    {
      class: 'String',
      name: 'safId',
    },
    {
      name: 'asyncAction',
      documentation: `All DUGRules use the same rule action, so a default one is created on demand instead of being configured`,
      section: 'dugInfo',
      view: { class: 'foam.u2.tag.TextArea' },
      javaGetter: `
        DUGSAFRuleAction action = new DUGSAFRuleAction(getX());
        action.setSafId(getSafId());
        return action;
      `
    },
  ],
});
