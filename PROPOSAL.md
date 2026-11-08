# Proposal: server-and-networking-lab (P23)

Status: DRAFT 2026-11-08. Not locked. The targets below are proposed
values for the Owner to set. Once set, this file is tagged
`proposal-v1` and never edited again; every later change is a new
proposal with its own tag. No drill runs before the tag exists.

## Question

Can a self-hosted server be held to a written baseline that catches
drift, and be recovered from a configuration or disk loss within stated
targets?

## System under study

A Dell PowerEdge R610 (hostname r610), Ubuntu 24.04, static
192.168.1.50/24 on eno1, ufw default-deny, an LVM volume group labvg of
three disks (sda 464.75 GB, sdc 136.12 GB, sdd 931.00 GB, 1531.87 GB in
total), KVM/libvirt with an isolated network labnet 10.99.0.0/24, and
Cockpit 314. Built in October 2026.

## Prior work

- CIS Benchmarks: consensus hardening guides per operating system.
- OpenSCAP / SCAP: NIST's protocol and scanner for machine-readable
  host profiles.
- Lynis: an open-source host audit script.
- Chef InSpec, Goss, Testinfra: compliance and server-state tests.
- Google SRE book (2016): service-level objectives, postmortems.
- NIST SP 800-34 Rev. 1: contingency planning, recovery time objective
  (RTO) and recovery point objective (RPO).

What is different here: no new tool is claimed. The baseline checker is
narrower than any of the tools above (one host, ten checks, each with a
mutation test). What this project adds is measurement: recovery targets
stated in advance and then timed on a real server, with misses
reported.

## Known risk found during the baseline

labvg is a linear volume group across three disks with no redundancy.
Losing any one disk loses the pool. The only verified backup is a
single configuration archive dated 2026-10-26. As of today the data-loss
window (RPO) is therefore unbounded for anything on the pool and 13 days
for configuration. H3 tests the fix.

## Hypotheses and targets (proposed; the Owner sets the numbers)

| # | Hypothesis | Pass line (proposed) |
| --- | --- | --- |
| H1 | Configuration restore: a fresh VM on labnet is restored from the backup to a state that passes the baseline checks | median of 3 timed trials at most 30 min, every trial passes |
| H2 | Single-disk loss: in a test VM that mirrors labvg's layout, losing one disk is recovered from backup | service back within 60 min; data lost no older than the RPO |
| H3 | Scheduled backups bound the data-loss window | a nightly hashed backup succeeds on 7 consecutive nights, RPO at most 24 h |
| H4 | Monitoring catches faults | each injected fault (one per baseline check, plus a disk loss) raises an alert within 15 min |
| H5 | The runbook is enough on its own | a second operator, given only the runbook, completes H1 within its target |
| H6 | A VM is rebuilt from a snapshot | at most 10 min, VM passes its own checks |
| H7 | A network change with a written rollback | rollback executed once, service restored within 5 min |

## Design

- Every drill runs on test VMs on labnet. The live host's services,
  firewall and disks are never altered by a drill.
- Times are wall-clock, measured by a script that logs start and end,
  with each run appended to experiments/ as a dated file.
- Three trials per timed hypothesis; report median and range.
- Build work needed for the drills, from the original scope: VM
  templates, a NAS share with permissions, a nightly backup with hash
  and retention, a scheduled checker run with alerts, DNS names for lab
  hosts, and a reverse proxy in front of fleet services.
- Deliverables beyond the hypotheses: an architecture document (network
  map, service list, failure modes) and the rack build as a chapter.

## Analysis plan

Each hypothesis passes or misses on its pass line exactly as written.
A miss is reported with its measured value; targets are never moved
after the tag. src/make_results.py scores every file in experiments/.

## Not pre-registered

The baseline checker and its three snapshots predate this proposal. They
are reported as baseline, not as confirmatory evidence.
