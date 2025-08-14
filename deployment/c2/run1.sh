#!/bin/bash
node ../foam3/tools/build.js -Jsaf-all,c2,../foam3/deployment/demo,../foam3/deployment/https -EAPP_HOME:/opt/saf1,APP_NAME:saf,HOST_NAME:saf1,DEBUG:true,DEBUG_PORT:8305,WEB_PORT:8300 -a  "$@"
