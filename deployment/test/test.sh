#!/bin/bash
node ../foam3/tools/build.js -Jsaf -EDEBUG:true,DEBUG_PORT:8305,WEB_PORT:8300 --java-tests:SAFTest --log-level:INFO "$@"
