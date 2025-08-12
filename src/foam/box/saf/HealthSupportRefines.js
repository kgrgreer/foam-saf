/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'HealthSupportRefines',
  refines: 'foam.core.app.HealthSupport',

  properties: [
    {
      name: 'statusManagementManual',
      value: true
    }
  ]
});
