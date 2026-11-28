/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf.test',
  name: 'SAFBroadcastPredicateTest',
  extends: 'foam.core.test.Test',

  documentation: `Unit test for SAFBroadcastDAO.safBroadcastPredicate -- the FScript
gate deciding whether an object is store-and-forwarded. It calls shouldBroadcast
directly, so it needs no safManager, clients or timing (unlike SAFClusterTest):
the point under test is purely that the FScript parses against the object's class
and evaluates against the object. The example mirrors the real localLogMessageDAO
config: forward only WARN/ERROR LogMessages.`,

  javaImports: [
    'foam.core.saf.SAFBroadcastDAO',
    'foam.core.logger.LogMessage',
    'foam.dao.NullDAO',
    'foam.lang.X',
    'foam.log.LogLevel'
  ],

  methods: [
    {
      name: 'runTest',
      args: 'X x',
      javaCode: `
      // Forward only warnings and errors.
      SAFBroadcastDAO filtered = new SAFBroadcastDAO.Builder(x)
        .setSafBroadcastPredicate("severity == foam.log.LogLevel.WARN || severity == foam.log.LogLevel.ERROR")
        .setDelegate(new NullDAO(x, LogMessage.getOwnClassInfo()))
        .build();

      test (   filtered.shouldBroadcast(logOf(LogLevel.WARN)),  "WARN is broadcast");
      test (   filtered.shouldBroadcast(logOf(LogLevel.ERROR)), "ERROR is broadcast");
      test ( ! filtered.shouldBroadcast(logOf(LogLevel.INFO)),  "INFO is not broadcast");
      test ( ! filtered.shouldBroadcast(logOf(LogLevel.DEBUG)), "DEBUG is not broadcast");

      // Second evaluation exercises the parse-once cache; it must still agree.
      test (   filtered.shouldBroadcast(logOf(LogLevel.ERROR)), "ERROR still broadcast (cached predicate)");

      // Empty predicate (the default) broadcasts everything -- prior behaviour.
      SAFBroadcastDAO all = new SAFBroadcastDAO.Builder(x)
        .setDelegate(new NullDAO(x, LogMessage.getOwnClassInfo()))
        .build();
      test ( all.shouldBroadcast(logOf(LogLevel.INFO)), "empty predicate broadcasts INFO (forward all)");

      // A predicate that does not parse fails open (broadcasts) rather than
      // silently dropping data; it also logs a warning (not asserted here).
      SAFBroadcastDAO bad = new SAFBroadcastDAO.Builder(x)
        .setCSpec(new foam.core.boot.CSpec.Builder(x).setName("safBroadcastPredicateTest").build())
        .setSafBroadcastPredicate("not a valid fscript ===")
        .setDelegate(new NullDAO(x, LogMessage.getOwnClassInfo()))
        .build();
      test ( bad.shouldBroadcast(logOf(LogLevel.INFO)), "unparseable predicate fails open (broadcasts)");
      `
    },
    {
      name: 'logOf',
      args: 'foam.log.LogLevel severity',
      type: 'foam.core.logger.LogMessage',
      javaCode: `
      LogMessage m = new LogMessage();
      m.setSeverity(severity);
      return m;
      `
    }
  ]
});
