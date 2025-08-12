/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.box.saf',
  name: 'HealthRefines',
  refines: 'foam.core.app.Health',

  properties: [
    {
      name: 'status',
      value: 'DOWN'
    }
  ]
});
