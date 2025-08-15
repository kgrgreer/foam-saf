/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: "saf",
  projects: [
    { name: 'test/pom',                             flags: "test"},
  ],
  files: [
    { name: "DUGSFRuleAction",                      flags: "js|java" },
    { name: "DUGSFRule",                            flags: "js|java" },
    { name: "HealthStatusWatcher",                  flags: "js|java" },
    { name: "SAF",                                  flags: "js|java" },
    { name: "SAFBroadcastDAO",                      flags: "js|java" },
    { name: "SAFBroadcastReceiverDAO",              flags: "js|java" },
    { name: "SAFBOX",                               flags: "js|java" },
    { name: "SAFClientDAO",                         flags: "js|java" },
    { name: "SAFConfig",                            flags: "js|java" },
    { name: "SAFConfigWatcher",                     flags: "js|java" },
    { name: "SAFDAO",                               flags: "js|java" },
    { name: "SAFEntry",                             flags: "js|java" },
    { name: "SAFEntryFactory",                      flags: "js|java" },
    { name: "SAFException",                         flags: "js|java" },
    { name: "SAFFileJournal",                       flags: "js|java" },
    { name: "SAFManager",                           flags: "js|java" },
    { name: "SAFMonitor",                           flags: "js|java" },
    { name: "SAFMonitorDAO",                        flags: "js|java" },
    { name: "SAFSink",                              flags: "js|java" },
    { name: "SAFSupport",                           flags: "js|java" }
  ]
});
