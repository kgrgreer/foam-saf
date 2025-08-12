# foam-saf
Store And Forward (SAF) is a delayed-ime, one-way, data communication technique for replicating data changes in a cluster.

FOAM's SAF solution is intended for small scale, low traffic, application clustering, where instances can safely fall out of sync with eath other for short time windows.

It is recommended that instances of a SAF cluster are located behind a Load Balancer (LB) configured with stick sessions (which keep each users activities on the same instance).

For single instance deployments, SAF can be used for zero-downtime upgrades (see $flow-doc/SAF).

Additional documentation
* #flow-doc/SAF
