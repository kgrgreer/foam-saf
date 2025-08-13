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
    { name: "../../src/foam/core/saf/CronRefines",                flags: "js|java" },
    { name: "../../src/foam/core/saf/EasyDAORefines",             flags: "js|java" },
    { name: "../../src/foam/core/saf/HealthRefines",              flags: "js|java" }
  ]
});
