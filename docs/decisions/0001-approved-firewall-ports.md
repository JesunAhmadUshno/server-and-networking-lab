# 0001: Firewall baseline is an approved list, not an exact match

Date: 2026-11-07. Status: accepted. Decided by: Jesun Ahmad Ushno.

## Context

The baseline required exactly ports 22 (SSH) and 9090 (Cockpit) open to
192.168.1.0/24. The first live capture (2026-11-07) found two more:
3389 (xrdp remote desktop) and 9001 (a Penpot design server in Docker),
plus 9001 allowed on the tailscale0 interface. A guard step before any
removal showed both services in active use; removing 9001 would cut a
workstation off from Penpot, and removing 3389 would block new remote
desktop logins.

## Decision

I kept both. The firewall check accepts an approved list:
22 and 9090 required from 192.168.1.0/24; 3389 and 9001 allowed from
192.168.1.0/24; 9001 allowed on tailscale0. Any other port, source or
interface fails. Recorded as REQUIRED_PORTS, APPROVED_LAN_PORTS and
APPROVED_TAILNET in src/baseline_check.py, with four tests.

## Consequences

The check now passes on the live server (10 of 10, 2026-11-08). Two
more services are exposed to the LAN than in the original design; any
further port needs a new decision record. Reversing this means removing
the two ufw rules on the server and the two ports from the list.
