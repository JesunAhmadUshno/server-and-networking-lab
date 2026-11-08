# Report: server-and-networking-lab

Status: BASELINE 2026-11-08. The recovery tests (PROPOSAL.md, H1 to H3)
are locked by tag proposal-v1 and the harness is built and tested; no
test has run yet. Results are added below as they are measured.

## Current state

| Evidence | Result |
| --- | --- |
| Live capture 2026-11-08 (current) | 10 of 10 checks pass |
| Live capture 2026-11-07 | 10 of 10 against today's approved list (9 of 10 on the day, see Findings) |
| Recorded snapshot 2026-10-26 (transcribed from the build record) | 10 of 10 |
| Unit tests | 34 pass: a failing (mutation) case for every check, every pass and miss case of the recovery scoring, and both server scripts run end to end |
| Results | results/baseline.json and results/recovery.json reproduced from experiments/ in CI |

## Recovery results

| Test | Pass line | Result |
| --- | --- | --- |
| H1 nightly backup, off-server copy | first 7 nights verified, no gap over 24 h | not run |
| H2 configuration restore | each of 3 trials at most 30 min, verified | not run |
| H3 one disk lost | each of 3 trials at most 60 min, verified, backup at most 24 h old | not run |

Steps: docs/RUNBOOK.md. Scores: results/recovery.json.

## Findings

**Drift caught on the first live run (2026-11-07).** The checker failed
the firewall check on a live capture. Two ports, 3389 (xrdp) and 9001
(a Penpot design server), had been opened after the recorded baseline.
Before removing anything, a guard step checked what was listening on
them. Both services were in active use, so I decided to keep them. The
check was then changed from an exact match to an approved list, and the
reason is recorded in docs/decisions/0001. The same run exposed a bug in
the capture script, which skipped interface-scoped ufw rules (9001 on
tailscale0). The script was fixed, and the incomplete capture is kept
as captured. The 2026-11-08 re-capture with the fixed script records
all five rules and passes.

**Weaknesses an independent review found (2026-11-08).**
- verified_config_backup only checked that the hash was 64 hex
  characters. It now compares the hash with the value recorded at
  backup time.
- firewall_lan_only reads ufw's rule list. Penpot runs in Docker, and
  Docker-published ports bypass ufw, so "LAN-only" is not proven for
  9001. The capture script now records the sockets actually listening;
  a check on them is added once the next capture shows the real list.
- services_and_logs accepts any error count. The journal showed 923
  error-priority lines on 2026-11-07 and 958 on 2026-11-08. The capture
  now records the top five error sources. A ceiling is set from that
  triage, not guessed.

## Baseline, in order

1. Users and keys. One admin account, SSH on port 22 with public-key
   authentication only (PasswordAuthentication no, verified with
   sshd -T on the server), and the root password locked, so root
   login is closed in practice. Read: /etc/ssh/sshd_config, then
   sshd -T. Do: run the ssh_key_only check against a snapshot.
2. Systemd services. ssh, cockpit.socket, and libvirtd are the three
   services this baseline watches. Read: systemctl status ssh,
   systemctl is-enabled cockpit.socket. The journal is the log:
   journalctl -u ssh, journalctl -b for the current boot.
3. Storage. Three physical volumes (sda 464.75 GB, sdc 136.12 GB,
   sdd 931.00 GB) form one LVM volume group, labvg, totalling
   1531.87 GB, just under 1.50 TB as the build record states it.
   Read: pvs, vgs, lvs. Carve logical volumes from the pool; never
   keep the only copy of anything on the RAID 0 OS disk.
4. Network. eno1 holds the static address 192.168.1.50/24. The lab
   network labnet is 10.99.0.0/24 with no forward element: guests on
   it can reach each other and nothing else. Read: ip -brief addr,
   virsh net-info labnet.
5. The Cockpit view. Cockpit 314 on port 9090, socket-activated,
   with the machines plugin, is the daily dashboard: metrics,
   storage, logs, services, terminal, and virtual machines in one
   place. It opens in limited (read-only) access; administrative
   access is an explicit elevation inside the session.
6. Firewall and updates. ufw is active, default deny incoming, and
   22 and 9090 must be open to 192.168.1.0/24; 3389 (xrdp) and 9001
   (Penpot) are also approved (docs/decisions/0001).
   Automatic security updates are on.
7. Backup proof. A config backup sits at
   /srv/backup/pre-perc-2026-10-26.tar.gz, SHA256
   4568177d3cddd330f909c33ee4e24ef412d8c81df273e313ae787b5e1dcc3a58.
   The checker compares each capture's hash with this recorded value.
   A backup without a hash is a hope, not a backup.

## How a snapshot is taken

src/capture_snapshot.sh runs on the server and only reads state. It
prints every field the checker needs; anything unreadable becomes null,
so the checker fails it instead of guessing. Each result is saved as a
new dated file in experiments/snapshots/ and never edited. From
2026-11-08 the kernel version is published as major.minor only
(docs/decisions/0003).

```text
python3 -m unittest discover -s tests -p "test_*.py" -v
python3 src/run_check.py experiments/snapshots/r610-snapshot-2026-11-08-live.json
python3 src/make_results.py --check
```

## Limits

- Recovery is not measured. Passing the baseline says the server is
  configured as intended; it says nothing about recovery after a loss.
- labvg has no redundancy, and the only verified backup is one archive
  from 2026-10-26 (PROPOSAL.md, Known risk).
- The server reports on itself. No outside scan of its open ports has
  been compared with its own view yet.
- One host, not a tool: the expected interface, address, ports and
  subnet are fixed in src/baseline_check.py.
- The Cockpit view is taught from the build record, not a live session.

History of every change: CHANGELOG.md.
