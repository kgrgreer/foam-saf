/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.saf',
  name: 'SAFException',
  javaExtends: 'foam.lang.FOAMException',

  javaCode: `
    public SAFException(String message) {
      super(message);
    }

    public SAFException(String message, Throwable cause) {
      super(message, cause);
    }

    public SAFException(Throwable cause) {
      super("SAFException", cause);
    }
  `
});
