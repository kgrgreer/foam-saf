/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFConfig',

  documentation: 'Manage availability of instances in a SAF cluster',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.EnabledAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware'
  ],

  tableColumns: [
    'id',
    'name',
    'enabled',
    'status',
    'lastModified'
  ],

  properties: [
    {
      documentation: 'Local network IP or DNS name, or id to look up in HostDAO',
      name: 'id',
      class: 'String',
      label: 'Hostname',
      required: true,
      tableWidth: 250,
    },
    {
      documentation: 'External DNS name, or name instance is known by. Used in log messages.',
      name: 'name',
      class: 'String',
      required: true,
      tableWidth: 150,
    },
    {
      class: 'Boolean',
      name: 'enabled',
      documentation: 'Allows for prepatory configuration changes.',
      value: true
    },
    // {
    //   documentation: 'Status of an instance',
    //   name: 'status',
    //   class: 'Enum',
    //   of: 'foam.core.app.HealthStatus',
    //   value: 'DOWN',
    //   storageTransient: true
    // },
    {
      name: 'port',
      class: 'Int'
    },
    {
      name: 'sessionId',
      class: 'String'
    }
  ]
});
