/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name:'saf-all',

  projects: [
    { name: "../saf/pom"}
  ],

  files: [
    { name: "../../src/foam/box/saf/EasyDAOSAFAllRefinement",    flags: "js|java" }
  ]
});
