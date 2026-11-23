# foam-saf — Store And Forward

Store And Forward (**SAF**) is a delayed-time, one-way data communication
technique for replicating data changes on one FOAM instance to other instances.
An update is persisted locally *before* it is forwarded, so if the forward fails
it can be retried, and if the forwarding instance restarts it picks up from the
persisted data where it left off.

See https://www.twingate.com/blog/glossary/store-and-forward and
https://en.wikipedia.org/wiki/Store_and_forward for the general pattern.

FOAM's SAF is intended for **small-scale, low-traffic application clustering**,
where instances can safely fall out of sync with each other for short windows.
It does **not** guarantee consistency — treat anything you forward over SAF as
data you can afford to lose or deliver late.

Recommended deployments:

* Place SAF cluster instances behind a Load Balancer (LB) with **sticky
  sessions**, so each user's activity stays on one instance.
* A single-instance deployment can use SAF for **zero-downtime upgrades** (see
  [Zero-downtime upgrades](#zero-downtime-upgrades)).
* One instance can act as a central **monitor** that many others forward their
  events to (see [PULSE](#pulse--platform-usage-logs-and-system-events)).

---

## Contents

* [How SAF works](#how-saf-works)
* [Including SAF in an application](#including-saf-in-an-application)
* [Configuration files](#configuration-files)
* [Port configuration — read this](#port-configuration--read-this)
* [Health: store / forward gating](#health-store--forward-gating)
* [Health heartbeat and delivery modes](#health-heartbeat-and-delivery-modes)
* [The receive path](#the-receive-path)
* [PULSE — Platform Usage, Logs, and System Events](#pulse--platform-usage-logs-and-system-events)
  * [Caveat: DAOs that use SeqNo for ids](#caveat-daos-that-use-seqno-for-ids)
* [Zero-downtime upgrades](#zero-downtime-upgrades)
* [Writing your own SAF](#writing-your-own-saf)
* [SAF in Medusa](#saf-in-medusa)
* [Developer cluster (c2)](#developer-cluster-c2)
* [Testing](#testing)
* [Future work](#future-work)

---

## How SAF works

SAF is wired in by **DAO decoration**. When SAF is enabled for a DAO, `EasyDAO`
installs a `SAFBroadcastDAO` above the MDAO. The flow of a single `put`:

1. `SAFBroadcastDAO.put_` first delegates the put to the inner DAO (the MDAO),
   so the object is stored locally and gets its id.
2. It wraps the stored object in a `SAFEntry` that records the **CSpec name** of
   the source DAO, the **DOP** (`PUT` / `REMOVE`) and the object itself.
3. It hands a clone of that entry to each broadcast client (one per destination)
   on a thread pool — send-and-forget.
4. The **SAF system** (`SAFManager` + `SAF`) persists the entry in a journal and
   queues it for forwarding.
5. The forwarder polls the queue and sends the entry to the destination,
   **retrying until it succeeds**. "Success" means the destination did not throw.

Key classes:

| Class | Role |
|-------|------|
| `SAFBroadcastDAO` | Decorator above the MDAO; creates the `SAFEntry` on put/remove and broadcasts it. |
| `SAFEntry` | The stored/forwarded unit: source CSpec name, DOP, object. |
| `SAFManager` | Owns the forwarders, builds a client per enabled destination, selects destinations. |
| `SAF` | One store-and-forward pipeline to a single destination; sub-class and override `submit` to customise. |
| `SAFBroadcastReceiverDAO` | The receiving side; applies an incoming `SAFEntry` to the target DAO. |
| `SAFConfig` | Per-instance config row (id, enabled, port, sessionId). |
| `SAFSupport` | Builds the client box (address, port, session) used to reach a destination. |

---

## Including SAF in an application

SAF is added to a build with one of two deployment journal sets:

1. **opt-in** — `-J../../foam-saf/deployment/saf`
   SAF defaults to **disabled** for every `EasyDAO` CSpec. Enable it per DAO
   with `.setSaf(true)`.
2. **opt-out** — `-J../../foam-saf/deployment/saf-all`
   SAF defaults to **enabled** for every `EasyDAO` CSpec. Disable it per DAO
   with `.setSaf(false)`.

> With `saf-all`, remember to `.setSaf(false)` on DAOs that must never forward —
> for example `localLogMessageDAO`, which deadlocks at boot if its own log
> writes go through SAF.

---

## Configuration files

SAF reads a handful of journals. `foam-saf/deployment/c2` is the reference
example; a client/server (PULSE) example lives in the ptv3 `deployment/`
directory under `pulse-server`, `pulse-client` and `pulse-common`.

| File | Purpose |
|------|---------|
| `safconfigs.jrl` | One `SAFConfig` row per instance in the cluster: `id`, `name`, `enabled`, `port`, `sessionId`. |
| `hosts.jrl` | Maps a `SAFConfig` id to a network address (`foam.net.Host`). If absent, the id is used verbatim as the hostname (so it must resolve, e.g. via `/etc/hosts`). |
| `sessionsinternal.jrl` | The long-lived `Session` rows used to authenticate inter-instance connections. A session referenced by a destination must exist **on that destination**. |
| `ports.jrl` | Optional `foam.net.Port` overrides. The default `SocketServer` port is `http + 3` (`foam3/src/foam/box/socket/ports.jrl`). |
| `users.jrl` | The user the internal sessions belong to (conventionally user id `2`, the "Socket API" system user). Must exist on the receiver. |
| `services.jrl` | Registers `safConfigWatcher` so config changes are picked up live. |

### Which instance am I?

`SAFSupport.getLocalConfig` identifies the running instance by the `hostname`
system property (falling back to `user.name` when `hostname` is `localhost`),
then finds the matching `SAFConfig` by id/name. The run scripts set this via
`HOST_NAME` (e.g. `-EHOST_NAME:pulse-client`).

`SAFManager.getBroadcastIds` then selects **every enabled `SAFConfig` other than
the local one** as a forward destination. So:

* An instance whose `safconfigs.jrl` lists **only itself** forwards to no one —
  it is **receive-only**.
* An instance whose `safconfigs.jrl` lists itself **and** a peer forwards to that
  peer.

---

## Port configuration — read this

This is the single most common reason a SAF setup silently fails to send.

When the sender builds a client for a destination, `SAFSupport.getSocketClientBox`
resolves the destination **port** like this:

```java
int port = receiverConfig.getPort();   // the destination SAFConfig's port
if ( port == 0 ) {
  port = foam.net.Port.get(x, "SocketServer");   // fallback
}
```

The fallback `Port.get(x, "SocketServer")` resolves to **the sender's own**
`http + 3` — **not** the destination's. So if you leave `port` unset (`0`) and
the two instances run on different web ports, the sender dials the *wrong* port.

**Example (PULSE on one box):**

| Instance | `WEB_PORT` | SocketServer (listens on) |
|----------|-----------|---------------------------|
| pulse-server | 8300 | **8303** |
| pulse-client | 8310 | **8313** |

With no `port` on the `pulse-server` `SAFConfig`, the client falls back to its
*own* SocketServer port (8313) and tries to reach `pulse-server:8313` — but the
server is listening on 8303. Nothing arrives.

**Rule: set `port` explicitly on every `SAFConfig` to that instance's own
SocketServer port.** The `c2` example does this (`saf1` → `8303`, `saf2` →
`8313`), which is why it works without ever hitting the fallback.

```jrl
p({
  "class":"foam.core.saf.SAFConfig",
  "id":"pulse-server",
  "name":"pulse-server",
  "enabled":true,
  "port":8303,                                  // the server's SocketServer port
  "sessionId":"4BFDD224-774E-4716-8508-43FA72E003D9",
  "created":"2020-03-28T14:57:12.959Z",
  "createdBy":2
})
```

Two related gotchas on the same path:

* **Session.** `SAFSupport.getBroadcastClientDAO` wraps the connection in a
  `SessionClientBox` using the **destination** `SAFConfig`'s `sessionId` (or the
  current context's session, if one is present — which it usually is *not* when
  the forwarder runs from the boot context). If the destination config has no
  `sessionId`, the forward authenticates as anonymous and is rejected. Give each
  receiving `SAFConfig` a `sessionId` that exists in the receiver's
  `sessionsinternal.jrl` and whose user exists in the receiver's `users.jrl`.
* **Address.** If `hosts.jrl` has no row for the destination id, the id itself is
  used as the hostname. On a single box, add the names to `/etc/hosts`
  (`127.0.0.1 pulse-server`, etc.).

---

## Health: store / forward gating

Each instance carries a `Health` with a `status`. Two independent gates control
replication:

* An instance **stores** updates for a destination only when its **own** Health
  status is `UP` or `DRAIN` (and the destination's `SAFConfig` is `enabled`).
* An instance **forwards** a stored update to a destination only when the
  **destination's** Health status is `UP` or `MAINT`.

### Manipulating Health status from the file system

Deployment scripts can drive the two gates by touching files. On startup the
`HealthStatusWatcher` logs its watch directory. Touching a status file in that
directory changes the instance's Health status. For example, with watch directory
`/tmp`:

```sh
touch /tmp/<hostname>/<appname>/UP      # -> status UP
touch /tmp/<hostname>/<appname>/MAINT   # -> status MAINT
touch /tmp/<hostname>/<appname>/DOWN    # -> status DOWN
```

---

## Health heartbeat and delivery modes

The store/forward gates above read Health status out of **healthDAO**. That DAO
is populated by a **heartbeat**: each instance's `HealthHeartbeatService`
periodically sends its own Health, and also listens and writes what it receives
into `healthDAO`. Until an instance has received a peer's heartbeat, that peer
is absent from its `healthDAO` and SAF will **not forward** to it (no "UP"
signal) — so a broken heartbeat looks exactly like a cluster that never
forwards.

`HealthHeartbeatService.mode` (`foam.core.app.HeartbeatMode`) chooses how
heartbeats are delivered. Default is `BROADCAST`; nothing needs setting for the
normal case.

| mode | delivery |
|------|----------|
| `BROADCAST` *(default)* | Multicast to the group (`230.22.41.0:52241`) on the OS default interface. |
| `LOOPBACK` | Multicast pinned to the loopback interface, for several instances on one host (local testing). |
| `DIRECT` | Unicast to each peer from `getPeers()`, for environments such as AWS that do not support multicast. In foam-saf, `getPeers` is refined to return the enabled `SAFConfig`s other than this instance (`HealthHeartbeatServiceRefines`), so DIRECT reaches exactly the SAF peers. |

### LOOPBACK for local single-box testing

Running two or more instances on one machine, the heartbeat group can be routed
off the box by a VPN (`utun*`) or an interface's reject route, so the instances
never see each other. The **loopback** deployment switches the heartbeat to
`LOOPBACK`. Opt in per run from an app that has foam-saf beside foam3:

```sh
deployment/<app>/run.sh -J../foam-saf/deployment/loopback
```

**macOS, only with an active VPN:** macOS ignores `IP_MULTICAST_IF` for `lo0`, so
`LOOPBACK` alone can't force loopback the way it does on Linux. When a VPN is up,
add a loopback route for the group so the sends stay on `lo0`:

```sh
sudo route -n add -net 230.22.41.0/24 -interface lo0   # add (not persistent)
netstat -rn | grep 230.22                              # expect: 230.22.41  lo0
sudo route -n delete -net 230.22.41.0/24 -interface lo0
```

No app restart is needed after adding the route — the next heartbeat (~3s)
flows. Without a VPN the route is not needed. Do **not** use `LOOPBACK` in a
multi-host deployment; there the heartbeat must use a routable interface
(`BROADCAST`) or `DIRECT`.

---

## The receive path

**SAF has no separate server component.** Every instance that includes the saf
deployment both sends and receives. On the receiving side, the foam3 socket
server routes an incoming message to the `safBroadcastReceiverDAO` CSpec, which
applies the entry to the target DAO.

**How an entry reaches the receiver:**

1. **Socket server.** The foam3 `socketServer` CSpec starts at boot
   (`lazy:false`) and listens on the `SocketServer` port (`http + 3`). A build's
   `-W` sets the http port, so `-W8698` means the socket server listens on 8701.
2. **Routing.** `SocketRouter` reads the service name from the message's
   `SubBoxMessage` and looks up the CSpec with that name, sending the message
   through `SessionServerBox`, which applies session authentication.
3. **Receiver CSpec.** `safBroadcastReceiverDAO` is an `EasyDAO` with
   `serve:true` (so the router can reach it) and `saf` and `ruler` both false. It
   wraps `SAFBroadcastReceiverDAO` over a `NullDAO`.
4. **Apply.** `SAFBroadcastReceiverDAO.put_` looks up the DAO named by the
   entry's `cSpecName`, takes its innermost DAO via `cmd_(DAO.LAST_CMD)`, and
   calls `put_` / `remove_` on it per the entry's DOP. This **skips the rules,
   authorization and the `SAFBroadcastDAO`** above the MDAO, so a received entry
   is applied once and never forwarded on again.

> `LAST_CMD` asks a delegate chain for its terminal storage DAO; a plain MDAO
> answers with itself. A **partitioned** DAO (e.g. `eventRecordDAO`, which fans
> rows to per-date MDAOs) has no single MDAO, so `PartitionedDAO.cmd_` answers
> `LAST_CMD` with itself — a `put_` on it routes to the correct partition while
> still bypassing the SAF/Ruler decorators above it.

**How the sender connects to the receiver:**

* **Who to send to.** `SAFManager.getBroadcastIds` selects every enabled
  `SAFConfig` other than the instance's own; `createClient` makes one
  `SAFClientDAO` per destination.
* **Service name.** The client sends to the service `safBroadcastReceiverDAO`.
* **Address / port / login.** As covered in
  [Port configuration](#port-configuration--read-this): address from `hosts.jrl`
  (or the id), port from the destination `SAFConfig` (falling back to the
  *sender's* SocketServer port when `0`), and a `SessionClientBox` authenticated
  with the destination config's `sessionId`.

---

## PULSE — Platform Usage, Logs, and System Events

**PULSE** uses SAF in a **one-way, many-to-one** topology: many application
instances (**clients**) forward their operational events to a single instance
(the **server**) that acts as a central **monitor**. The clients never receive;
the server never sends. It's "store and forward" used purely for observability —
platform **usage**, **logs**, alarms and system **events** collected in one
place.

This is the setup under the an applications `deployment/` directory:

```
deployment/
  pulse-common/     # shared by both roles
    safconfigs.jrl      -> the pulse-server SAFConfig (port 8303, sessionId)
    sessionsinternal.jrl-> internal session for user 2
    hosts.jrl           -> (commented; relies on /etc/hosts)
    HealthAwareRefines.js  -> EventRecord/Alarm/AnalyticEvent implement HealthAware
    PulseHealthRefines.js  -> Health.status defaults to UP for pulse
  pulse-server/     # the monitor (receive-only)
    users.jrl           -> user 2 (Socket API)
    run.sh              -> WEB_PORT 8300  (SocketServer 8303)
  pulse-client/     # an application instance (sends)
    safconfigs.jrl      -> the pulse-client SAFConfig (port 8313)
    rules.jrl           -> Health rules on the forwarded DAOs
    run.sh              -> WEB_PORT 8310  (SocketServer 8313)
```

### How the roles differ

* **pulse-server** loads only `pulse-common`, whose `safconfigs.jrl` lists just
  `pulse-server`. `getBroadcastIds` finds no "other" enabled config, so the
  server forwards to no one — **receive-only**.
* **pulse-client** loads its own `safconfigs.jrl` (`pulse-client`) **and**
  `pulse-common` (`pulse-server`). So the client sees a peer — `pulse-server` —
  and forwards to it.

### What gets forwarded

The DAOs enabled for SAF are the monitoring DAOs — e.g. `eventRecordDAO`,
`localAlarmDAO` and `analyticEventDAO`. Their models implement `HealthAware`
(via `pulse-common/HealthAwareRefines.js`).

### Distinguishing clients on the monitor

Because every client forwards into the *same* server DAO, the server needs to
know which client each record came from. `SAFBroadcastDAO.put_` handles this: if
the forwarded object implements `HealthAware` and its `health` is unset, it
stamps the object with this instance's health id —
`Health.getId().toSummary()`, which is `hostname:appName` (`HealthIdRefines`).
The monitor then groups records by this **Pulse Id** (`HealthAware.health`).

> `PulseHealthRefines` defaults `Health.status` to `UP` for pulse. The pulse
> server acts as a monitor, and if a client comes up `UP` immediately it will
> forward its startup and journal-replay events, which is exactly what the
> monitor wants to see.

### Caveat: DAOs that use SeqNo for ids

`SAFBroadcastDAO`'s own documentation states it plainly:

> *Objects that implement HealthAware are assigned this instance's healthId so
> they can be distinguished on the server … **NOTE: This is incompatible with
> DAOs using SeqNo.***

Why: `setSeqNo(true)` draws each id from a **per-instance counter** that starts
at 1. The SAF receiver writes a forwarded row straight to the terminal MDAO
(`LAST_CMD`), keeping the **sender's id verbatim** — it does not renumber. So:

* Client A emits ids `1, 2, 3…` and Client B emits `1, 2, 3…`. Forwarded into
  one server DAO, B's record `1` **overwrites** A's record `1` — silent data
  loss. (Bi-directional clusters collide the same way.)
* The health id stamped above identifies the *source* but is **not part of the
  id**, so it does not prevent the collision.

**Make the id globally unique instead of sequential:**

| Technique | Example | How it stays unique |
|-----------|---------|---------------------|
| `setFuid(true)` | `eventRecordDAO`, `analyticEventDAO` | FUID embeds a per-instance machine id (`UIDGenerator`), so two instances never generate the same id. |
| Composite id including the host | `Alarm` → `ids: ['name', 'hostname']` | The same alarm name from two hosts are two distinct rows. |
| `setGuid(true)` | — | Random GUID per row. |

`setSeqNo`, `setGuid` and `setFuid` are mutually exclusive on `EasyDAO`. A
SeqNo DAO that is **not** SAF-forwarded is fine (e.g. `monitoringReportDAO` uses
`setSeqNo(true)` but no SAF). The rule is specifically: **never forward a
`setSeqNo(true)` DAO into a shared receiver.**

---

## Zero-downtime upgrades

Intended for low-cost single-instance deployments: a second instance is brought
up on the new version, traffic is cut over, and the original is decommissioned.
Zero downtime is achieved by ordered manipulation of `SAFConfig.enabled` and
`Health.status` (see [Health gating](#health-store--forward-gating)).

Example with instances **S1** and **S2** behind load balancer **LB**.

**Initial configuration**

* S1 is deployed with SAF configuration for both S1 and S2.
* LB configured with S1 and S2, directing traffic to S1.
* S1 health is `UP`.
* On S1, S2's health is `DOWN`/`FAIL` and S2's `SAFConfig` is **disabled** — so
  S1 does **not** store updates for S2.

**Upgrade process**

1. On S1, **enable** S2's `SAFConfig`. S1 **starts storing** updates for S2.
2. Copy S1's journals to S2.
3. Deploy and start S2. It starts with Health `DOWN`.
4. Run S2's post-deploy steps (if any).
5. On S2, set Health `MAINT`. S1 **starts forwarding** to S2.
6. Monitor until SAF is idle.
7. On S2, set Health `UP`.
8. On S1, set Health `DRAIN`.
9. LB now directs new traffic to S2.
10. On S2, **disable** S1's `SAFConfig`. S2 **stops storing** updates for S1.
11. Monitor S1 sessions for idle, then set S1 Health `DOWN`.
12. Decommission S1.

**Upgrade complete.**

---

## Writing your own SAF

For custom store-and-forward processing (beyond DAO replication):

* `SAFEntry` — the stored request/data/object that SAF will process.
* `SAF` — the key class; override its `submit` method to define how a request is
  processed.
* `SAFManager` — manages all SAF requests and invokes `SAF` processing.

**Steps:**

1. Create a sub-class of `foam.core.saf.SAF` and override `submit` for the
   behaviour you want.
2. Register it in `storeAndForwards.jrl`.
3. Fetch it via the `SAFManager` service:
   `((SAFManager) x.get("safManager")).getSafs().get("<your SAF id>")`.

**Example:** `SAFSink.js` shows how to create a SAF;
`constFourSecondHttpSinkDemoUsingAtime` in `storeAndForwards.jrl` shows how to
register one.

---

## SAF in Medusa

The SAF system is also built into the Medusa clustering system, where it is used
to broadcast data from one mediator to others. DAOs can be set to broadcast
directly from the mediator rather than routing through a Medusa node.

> **Important:** SAF does not guarantee consistency. Only use it for a DAO whose
> data you can afford to lose.

Key classes: `foam.core.medusa.sf.MedusaSAFManager`,
`foam.core.medusa.sf.SAFBroadcastDAO`,
`foam.core.medusa.sf.SAFBroadcastReceiverDAO`.

To use it, enable SAF on the DAO via `EasyDAO`. Example from a `services.jrl`:

```js
p({
  "class":"foam.core.boot.CSpec",
  "name":"localEmailMessageDAO",
  "serviceScript":"""
    return new foam.dao.EasyDAO.Builder(x)
      .setOf(foam.core.notification.email.EmailMessage.getOwnClassInfo())
      .setAuthorize(false)
      .setFuid(true)                                        // globally-unique id (SAF-safe)
      .setJournalType(foam.dao.JournalType.SINGLE_JOURNAL)
      .setJournalName("emailMessages")
      .setSaf(true)                                         // turn on SAF
      .setServiceProviderAware(false)
      .setFixedSize(new foam.dao.FixedSizeDAO.Builder(x)
        .setComparator(foam.mlang.MLang.DESC(foam.core.notification.email.EmailMessage.CREATED))
        .setSize(100000)
        .build())
      .build()
      .addPropertyIndex(new foam.lang.PropertyInfo[] {foam.core.notification.email.EmailMessage.CREATED});
  """
})
```

---

## Developer cluster (c2)

`foam-saf/deployment/c2` runs a two-instance SAF cluster locally, both in the
same memory space.

**Requirements:** at least 8 GB free (4 GB × 2).

**`/etc/hosts`:**

```
127.0.0.1   saf1
127.0.0.1   saf2
```

**Run:**

```sh
deployment/c2/run1.sh -c [-j]     # saf1
deployment/c2/run2.sh [-j]        # saf2
```

Because both scripts share one build/classes tree, run the builds **sequentially**
to avoid a race. `-j` drops journals and pending SAF data.

**Websites:**

* Themed: `https://saf1:8300`, `https://saf2:8310`
* Admin: `https://localhost:8300`, `https://localhost:8310`

---

## Testing

`foam/core/saf/test/SAFClusterTest.js` mimics a two-instance cluster: it
manipulates `SAFConfig` and Health status to verify that DAO operations are
stored and eventually delivered to the "other" instance.

```sh
deployment/test/test.sh
```

---

## Future work

When a forward destination goes offline, updates are currently queued **in
memory**, which does not scale. The intended fix is a **forwarder per
destination**: when a destination is unreachable its forwarder stops and its
in-memory queue is released; when the destination returns, the forwarder
restarts and replays from the persisted **store** file, as it already does at
startup.

---

## Future Features

- **Clean-shutdown status.** When an instance shuts down cleanly, have it send a
  `MAINT` or `DOWN` Health status to its peers before exiting. A monitor then
  records the instance as intentionally down instead of raising
  missed-heartbeat alarms once the heartbeats stop.
