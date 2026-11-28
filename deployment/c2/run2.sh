#!/bin/bash
# loopback keeps the Health heartbeat on lo0 for this one-box cluster. On macOS
# with an active VPN also run once:
#   sudo route -n add -net 230.22.41.0/24 -interface lo0
# See ../../README.md, "Health heartbeat and delivery modes".
node ../foam3/tools/build.js -Jsaf-all,c2,loopback,../foam3/deployment/demo,../foam3/deployment/https -EAPP_HOME:/opt/saf2,APP_NAME:saf,HOST_NAME:saf2,DEBUG:true,DEBUG_PORT:8315,WEB_PORT:8310 -a  "$@"
