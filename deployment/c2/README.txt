# c2 - 2 SAF Cluster

Configuration and build scripts to test/run a SAF cluster locally.

These build scripts are designed to run all SAF instances in the same memory space.

## Requirements
* need at least 8Gbytes free - 4Gb x 2

## Machine configuration
/etc/hosts:
127.0.0.1       saf1
127.0.0.1       saf2

## Build scripts
1. `deployment/c2/run1.sh -c [-j]`
1. `deployment/c2/run2.sh [-j]`

## Website
### User / Themed website
* `https://saf1:8300`
* `https://saf2:8310`

### Admin access
* `https://localhost:8300`
* `https://localhost:8310`

* To drop journals and pending saf data - build with -j
