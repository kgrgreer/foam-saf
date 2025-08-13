/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFEntry',

  implements: [
    'foam.core.auth.CreatedAware',
  ],

  ids: [
    'index'
  ],

  properties: [
    {
      name: 'index',
      class: 'Long',
      visibility: 'RO',
      tableWidth: 100
    },
    {
      class: 'String',
      name: 'cSpecName',
      label: 'CSpec Name',
      visibility: 'RO',
      tableWidth: 225
    },
    {
      class: 'Enum',
      of: 'foam.dao.DOP',
      name: 'dop',
      visibility: 'RO',
      tableWidth: 100
    },
    {
      class: 'FObjectProperty',
      of: 'foam.lang.FObject',
      name: 'object',
      storageTransient: false
    },
    {
      class: 'Long',
      name: 'scheduledTime',
      storageTransient: true,
      clusterTransient: true,
      value: 0
    },
    {
      class: 'Reference',
      of: 'foam.core.saf.SAF',
      name: 'saf',
      // storageTransient: true,
      clusterTransient: true,
    },
    {
      name: 'retryStrategy',
      class: 'FObjectProperty',
      of: 'foam.util.retry.RetryStrategy',
      storageTransient: true,
      clusterTransient: true,
    },
  ]
})
