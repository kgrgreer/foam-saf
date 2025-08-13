/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name:'saf',

  projects: [
    { name: "../../pom"}
  ],

  files: [
    { name: "../../src/foam/box/saf/CronRefines",                flags: "js|java" },
    { name: "../../src/foam/box/saf/EasyDAORefines",             flags: "js|java" },
    { name: "../../src/foam/box/saf/HealthRefines",              flags: "js|java" }
  ]
});
