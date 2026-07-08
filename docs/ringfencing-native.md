# Ringfencing — native-agent design (future track)

**Status:** Not implemented. Documented here as a separate, native effort because
it is out of reach for the current Python agent.

## What ringfencing is

Controlling what an *allowed* application is permitted to do at runtime:

- **Network** — which hosts/ports/protocols the app may reach (or block network entirely).
- **File** — which paths the app may read/write (e.g. block an app from user documents).
- **Registry** (Windows) — which keys the app may read/write.
- **Process** — whether the app may spawn/inject into other processes.

This is the adjacency that separates real app control from a blocklist. It is
also fundamentally a **syscall/IO interception** problem, which a user-space
Python agent cannot do — the agent can only see processes (via `ps`/`tasklist`)
and kill them. It cannot mediate an app's network connections, file opens, or
registry access. Ringfencing therefore requires OS-level enforcement components.

## macOS

A **notarized System Extension** bundled inside a helper app, user-approved once
(Settings → Privacy & Security). Two subsystems:

- **Endpoint Security** (`com.apple.developer.endpoint-security.client`
  entitlement) — subscribe to `AUTH` events (`ES_EVENT_TYPE_AUTH_OPEN`,
  `_EXEC`, `_MMAP`) and allow/deny per-app for **file** and **process** control.
  Requires the ES entitlement (Apple approval) + notarization.
- **Network Extension** — a content filter (`NEFilterDataProvider`) or
  transparent proxy to allow/deny **network** flows per app.

Distribution: the ES/Network entitlements need Apple authorization; the extension
must be signed + notarized; the user (or MDM profile) must approve it. Managed
fleets would push the approval via an MDM configuration profile.

## Windows

Signed kernel-mode components + a user-mode service:

- **Network** — a **WFP** (Windows Filtering Platform) callout driver keyed on
  the process image path.
- **File** — a **minifilter** driver (filter manager) intercepting `IRP_MJ_CREATE`.
- **Registry** — `CmRegisterCallbackEx` registry callbacks.

Drivers require production code-signing (EV cert + attestation/WHQL signing) and
a service to load them and sync rules.

## How it would integrate with Ravyn

- **Rule model** extends the existing scoped policy idea: per-app ringfence rules
  (network allow/deny lists, path allow/deny, spawn allow) at org/location/
  device/ring scope, resolved server-side like today's policies.
- **Delivery** — the Python agent (already on every endpoint, running elevated)
  installs/updates the native component and syncs its rule set, so the native
  layer stays a thin enforcement engine and the agent remains the control plane.
- **Reporting** — ringfence denials flow back as agent events, same as kills.

## Effort

Large and per-OS: native development (Swift/C++ + kernel/driver), Apple ES/Network
entitlement approval + notarization, Windows driver signing, and substantial
testing. This is its own project, not an increment on the Python agent.

## What ships today instead

- **USB / removable-storage control** — implemented (agent v1.7.23): eject
  unauthorized USB volumes (macOS), disable USBSTOR (Windows).
- **Network-only ringfence, Windows-only** — an achievable slice not yet built:
  block a specific app's outbound via a Windows Firewall rule
  (`netsh advfirewall firewall add rule program="<path>" dir=out action=block`).
  No macOS equivalent without the Network Extension above.
