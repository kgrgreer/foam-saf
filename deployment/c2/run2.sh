#!/bin/bash
node ../foam3/tools/build.js -Jsaf-all,c2,../foam3/deployment/demo,../foam3/deployment/https -EAPP_HOME:/opt/saf2,APP_NAME:saf,HOST_NAME:saf2,DEBUG:true,DEBUG_PORT:8315,WEB_PORT:8310 -a  "$@"
