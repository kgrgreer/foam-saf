/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'SAFClientDAO',
  extends: 'foam.box.saf.SAFDAO',

    javaImports: [
    'foam.core.pm.PM',
    'foam.dao.DAO',
    'foam.lang.FObject'
  ],

  properties: [
    {
      name: 'senderConfig',
      class: 'FObjectProperty',
      of: 'foam.box.saf.SAFConfig',
      javaSetter: `
      senderConfig_ = val;
      senderConfigIsSet_ = true;
      DELEGATE.clear(this);
      `
    },
    {
      name: 'receiverConfig',
      class: 'FObjectProperty',
      of: 'foam.box.saf.SAFConfig',
      javaSetter: `
      receiverConfig_ = val;
      receiverConfigIsSet_ = true;
      DELEGATE.clear(this);
      `
    },
    {
      name: 'serviceName',
      class: 'String',
      javaFactory: `
      return "safBroadcastReceiverDAO";
      `
    },
    {
      class: 'Proxy',
      of: 'foam.dao.DAO',
      name: 'delegate',
      transient: true,
      javaFactory: `
      SAFConfigSupport support = (SAFConfigSupport) getX().get("safConfigSupport");
      DAO dao = support.getBroadcastClientDAO(getX(), getServiceName(), getSenderConfig(), getReceiverConfig());
      return dao;
      `
    }
  ],

  methods: [
    {
      name: 'put',
      code: function() {},
      swiftCode: '// NOOP',
      javaCode: `
      return this.storeAndForward((FObject) obj);
      `
    },
    {
      name: 'submit',
      args: 'Context x, SAFEntry entry',
      javaCode: `
      PM pm = new PM("SAFClientDAO", "submit", getSenderConfig().getId(), getReceiverConfig().getId());
      try {
        getDelegate().put(entry);
      } catch (RuntimeException e) {
        pm.error(x, e);
        throw e;
      } finally {
        pm.log(x);
      }
      `
    },
    {
      name: 'createDelegate',
      documentation: 'creating delegate when start up',
      javaCode: `
      `
    },
  ]
});
