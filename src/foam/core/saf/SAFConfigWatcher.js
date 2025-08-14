/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFConfigWatcher',
  extends: 'foam.core.fs.Watcher',

  documentation: `Monitor for SAFConfig change request.
Accepts ENABLE, DISABLE, with the file contents containing a
comma seperated list of 'ids' to udpate.

This watcher is meant for SAF only deployments (no Medusa).
enable with:
p({
  "class": "foam.core.boot.CSpec",
  "name": "safConfigWatcher",
  "lazy": false,
  "serviceClass": "foam.core.saf.SAFConfigWatcher"
})
`,

  javaImports: [
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.dao.DAO',
    'foam.lang.X',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List',
    'java.util.stream.Collectors',
    'java.io.File',
    'java.io.IOException',
    'java.nio.file.Files',
    'java.nio.file.Path',
    'java.nio.file.Paths'
  ],

  constants: [
    {
      name: 'ENABLE',
      type: 'String',
      value: 'ENABLE'
    },
    {
      name: 'DISABLE',
      type: 'String',
      value: 'DISABLE'
    }
  ],

  methods: [
    {
      name: 'acceptRequest',
      javaCode: `
      return ENABLE.equals(request) ||
             DISABLE.equals(request);
      `
    },
    {
      name: 'handleRequest',
      javaCode: `
        Logger logger = Loggers.logger(x, this);
        boolean enable = ENABLE.equals(request);

        try {
          Path path = Paths.get(getWatchDir());
          Path file = path.resolve(request);
          String contents = Files.readAllLines(file).get(0);
          // logger.debug("contents", contents);
          if ( ! SafetyUtil.isEmpty(contents) ) {
            List<String> ids =
              Arrays.stream(contents
               .split(","))
               .map(String::trim)
               .collect(Collectors.toList());

            DAO dao = (DAO) x.get("safConfigDAO");
            for ( String id : ids ) {
              SAFConfig config = (SAFConfig) dao.find(id);
              if ( config != null ) {
                config = (SAFConfig) config.fclone();
                config.setEnabled(enable);
                dao.put_(x, config);
                logger.info("SAFConfig",id,(enable ? "enabled" : "disabled"));
              } else {
                logger.warning("SAFConfig not found", id);
              }
            }
          } else {
            logger.warning("No ids found");
          }
        } catch (Exception e) {
          logger.warning(e);
        }
      `
    }
  ]
});
