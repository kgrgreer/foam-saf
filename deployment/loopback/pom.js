/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'loopback',
  help: `Local single-box testing: set the Health heartbeat to LOOPBACK so SAF
instances sharing one machine exchange heartbeats over the loopback interface,
immune to a VPN or interface change routing the multicast group off the box.
Opt in per run from an app that has foam-saf beside foam3, e.g.
  deployment/<app>/run.sh -J../foam-saf/deployment/loopback
On macOS, only when a VPN is active, also add a loopback route for the group:
  sudo route -n add -net 230.22.41.0/24 -interface lo0
See foam-saf/README.md (Health heartbeat and delivery modes). Not for multi-host.`
});
