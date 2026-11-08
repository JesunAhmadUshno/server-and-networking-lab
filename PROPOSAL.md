# Proposal: server-and-networking-lab

Status: DRAFT 2026-11-08, revision 2 (scope cut to three tests after an
independent three-reviewer critique; see docs/decisions/0002). Not
locked. The pass lines below are proposed values that I set before the
tag. Once set, this file is tagged `proposal-v1` and never edited
again. No test runs before the tag exists.

## Question

Can a solo-run server detect its own drift and recover from a disk or
configuration loss within targets set in advance?

## System under study

One Dell PowerEdge R610 running Ubuntu 24.04 with a static LAN address,
a ufw default-deny firewall, and an LVM volume group (labvg) of three
disks totalling 1531.87 GB. It also runs KVM/libvirt with an isolated
lab network and the Cockpit dashboard. Built in October 2026.

## Prior work

**Disks fail more often than datasheets say.** In field data from about
100,000 disks, annual replacement rates were typically 2 to 4%, against
a datasheet figure of at most 0.88%. Rates grew with age
([Schroeder and Gibson 2007](https://consensus.app/papers/details/d85581106d8f57dfa01aa176c3eb787f/?utm_source=claude_code)).
A study of a much larger population found that SMART health signals
alone do not usefully predict an individual drive's failure
([Pinheiro et al. 2007](https://consensus.app/papers/details/110dd9d714625c82a237db3eb22b35ad/?utm_source=claude_code)).
For a pool of three disks with no redundancy, that means planning for
loss rather than waiting for a warning.

**Measured recovery differs from vendor figures.** A controlled
small-business study ran each of three cloud failure scenarios five
times. It found median recovery times between about 5 and 32 minutes,
and a consistent gap from vendor-reported restore times, caused by
manual steps after the restore. It also found a learning effect: one
restore fell from 16 to 4 minutes over successive runs
([Turkson et al. 2026](https://consensus.app/papers/details/68efcc36360b520ebebb9e229ad97b0e/?utm_source=claude_code)).
That is why this design reports every trial, randomises trial order,
and treats the first trial as the honest figure. RTO and RPO as
planning targets follow NIST SP 800-34 Rev. 1 and
[Zgureanu 2022](https://consensus.app/papers/details/adcf7ca5da09597098e05d9758990d6f/?utm_source=claude_code).

**Drift detection.** Configuration drift is the gap between intended and
actual state. Recent work proposes formal compliance and drift indices
built from atomic checks
([Moiseev et al. 2025](https://consensus.app/papers/details/361eb0c556d555b08cbfbf0be95f3857/?utm_source=claude_code)).
That line of work is early and has few citations. Established practice
lives in tools: CIS Benchmarks, OpenSCAP, Lynis, Chef InSpec, Goss and
Testinfra.

**What this project adds.** No new tool is claimed. The checker is
narrower than all of the above: one host, ten checks, each with a
mutation test. The contribution is measurement. Recovery targets are
stated before the tests and timed on real hardware, and the misses are
reported.

## Known risk found during the baseline

labvg is a linear volume group with no redundancy, so losing any one
disk loses the pool. The only verified backup is one configuration
archive from 2026-10-26, and it may sit on the same pool it protects.
H1 tests the fix.

## Hypotheses (proposed pass lines; set before the tag)

| # | Test | Runs on | Pass line |
| --- | --- | --- | --- |
| H1 | Nightly hashed backup of configuration and pool data, with a copy kept off the server | the real server | 7 consecutive nights succeed; every night's off-server copy matches its hash; data at risk at most 24 h |
| H2 | Restore configuration from the off-server copy | a test VM on labnet | each trial at most 30 min, ending with the baseline checker passing on the VM |
| H3 | Lose one disk of a pool built like labvg and recover from the off-server copy | a test VM with three virtual disks | each trial at most 60 min; data lost no older than H1's last good night; time also reported per GB restored |

## Design

- Order: H1 starts first, because it runs unattended for 7 nights. H2
  and H3 run during that week.
- Three trials each for H2 and H3, in randomised order. Every trial is
  reported, not only the median. The first trial is highlighted because
  later ones benefit from practice.
- Each trial will be timed by src/drill.sh (built before the tag) and
  logged as a dated file in
  experiments/drills/.
- H2 and H3 never touch the live host's services, firewall or disks.
  H1 only adds a scheduled backup job and an off-server copy.
- Monitoring: a scheduled run of the baseline checker that alerts on any
  failing check. This is part of the build, not a hypothesis.

## Threats to validity

- Test VM versus real host: H2 and H3 do not exercise host-only parts
  (eno1, Cockpit, ufw on bare metal), and virtual disks are smaller and
  faster than the real ones. H3 therefore reports time per GB, and the
  result is not claimed for the full 1.5 TB pool.
- One operator: there is no second person, so "anyone can follow the
  runbook" is not claimed.
- Three trials give a range, not a statistical estimate.

## Analysis plan

Each hypothesis passes or misses on its pass line exactly as written.
A miss is reported with its measured value, and targets are never moved
after the tag. src/make_results.py scores every file in experiments/.

## Not pre-registered

The baseline checker and its snapshots predate this proposal. They are
reported as baseline, not as confirmatory evidence.
