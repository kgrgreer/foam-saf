# foam-saf
Store And Forward (SAF) is a delayed-time, one-way, data communication technique for replicating data changes in a cluster.

FOAM's SAF solution is intended for small scale, low traffic, application clustering, where instances can safely fall out of sync with eath other for short time windows.

It is recommended that instances of a SAF cluster are located behind a Load Balancer (LB) configured with stick sessions (which keep each users activities on the same instance).

For single instance deployments, SAF can be used for zero-downtime upgrades (see #flow-doc/SAF).

## Use - Inclusion in an application
SAF can be included in an application in two scenarios:
1. opt-in
    `-J../../foam-saf/deployment/saf`
    With opt-in, SAF defaults to disabled for all CSpecs using EasyDAO. To enable use: `setSaf(true)`.
1. opt-out
    `-J../../foam-saf/deployment/saf-all`
    With opt-out, SAF defaults to enabled for all CSpecs using EasyDAO. To disable use: `setSaf(false)`.

### Additional Configuration - incomplete
see deployment/c2 for examples
* safconfigs.jrl - saf instance configuration
* hosts.jrl - id to hostname mapping
* sessionsinternal.jrl - session ids for inter-saf ssl connections

## Additional documentation
* #flow-doc/SAF

## Test Cases
See foam/core/saf/test/SAFClusterTest.js
run with `deployment/test/test.sh`

## Developer cluster
See deployment/c2/README.md
