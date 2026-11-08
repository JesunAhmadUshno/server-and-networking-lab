# 0003: What server detail the public evidence carries

Date: 2026-11-08. Status: accepted. Decided by: Jesun Ahmad Ushno.

## Context

The snapshots are public. A reviewer noted that exact kernel versions,
open ports and network exposure help an attacker plan.

## Decision

From 2026-11-08, captures publish the kernel as major.minor only. Ports,
firewall rules and listening sockets stay, because the checks need them
and the addresses are on a private network not reachable from the
internet. Snapshots captured before this date are not edited: evidence
is append-only.

## Consequences

New snapshots are slightly less informative to an attacker. The
2026-10-26, 2026-11-07 and 2026-11-08 snapshots still carry the full
kernel string.
