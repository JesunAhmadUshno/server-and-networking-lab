# Level 1, Learn: server-and-networking-lab

Status: DONE 2026-11-04 (ROADMAP-V3-BATCH loop cycle). Evidence: the
checker in this folder, the recorded R610 snapshot in evidence/, and
9 unit tests in tests/test_learn_baseline.py. Build and Deep are not
started.

## The idea in one paragraph

A server you can trust is a short list of facts you can check, not a
feeling about a machine. Level 1 turns the admin baseline into that
list: who can log in and how, which services run, where the logs are,
how storage is pooled, which network the machine sits on, and which
dashboard shows it all. Each fact becomes one named check in
baseline_check.py, and each check prints the value it actually saw.

## The teachable path (the baseline, in order)

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
   22 and 9090 are open to 192.168.1.0/24 only; since 2026-11-07 the
   approved list also allows 3389 (xrdp) and 9001 (Penpot), see below.
   Automatic security updates are on.
7. Backup proof. A verified config backup sits on the pool at
   /srv/backup/pre-perc-2026-10-26.tar.gz, SHA256
   4568177d3cddd330f909c33ee4e24ef412d8c81df273e313ae787b5e1dcc3a58.
   A backup without a hash is a hope, not a backup.

## Evidence capture (how a fresh snapshot is taken)

capture_snapshot.sh is the read-only capture script. Run it on the
server; it changes nothing and prints every field the checker reads
(unreadable fields come out as null, so the checker fails them instead
of guessing). Save the result as a new dated file under evidence/,
never over an older snapshot, then run the checker on it.

### First live capture, 2026-11-07: 9 of 10, firewall drift found

evidence/r610-snapshot-2026-11-07-live.json was captured on the R610
itself by capture_snapshot.sh at 2026-11-07 22:53 UTC. Checker result:
9 of 10. The one failure is real drift, not a capture error: the
firewall still denies incoming by default and still limits every rule
to 192.168.1.0/24, but it now also allows ports 3389 (RDP) and 9001,
which the 2026-10-26 baseline did not. The baseline is not edited to
make the check pass.

Follow-up the same evening: before any rule was removed, a guard step
checked what listens on the two ports. 3389 is xrdp (remote desktop)
and 9001 is a Penpot design server in Docker, both in active use, so
no rule was deleted and the decision went back to the Owner. The
check also showed a fifth rule, 9001 allowed on the tailscale0
interface from any source, which this snapshot does not contain: the
first version of capture_snapshot.sh skipped interface-scoped ufw
rules. The script now records them (with an "interface" field), and
the snapshot file is kept as captured, incomplete on that one rule.

Owner decision, 2026-11-07: keep both. The firewall check changed
from "exactly ports 22 and 9090" to an approved list, recorded in
baseline_check.py: 22 and 9090 must be open to 192.168.1.0/24; 3389
(xrdp) and 9001 (Penpot) may be; 9001 may also be open on tailscale0;
any other rule, source or interface fails. Both snapshots now score
10 of 10. Four tests pin the new rule (approved ports pass, an
unapproved LAN port fails, a tailnet rule on an unapproved port fails,
a missing SSH rule fails). The next capture, with the fixed script,
must include the tailscale0 rule and still score 10 of 10.

### Re-capture, 2026-11-08: 10 of 10, complete

evidence/r610-snapshot-2026-11-08-live.json was captured at
2026-11-08 05:13 UTC with the fixed script. It records all five ufw
rules, including 9001 on tailscale0, and scores 10 of 10 against the
approved list. The backup hash is unchanged. This is the current live
evidence; the 2026-11-07 file is kept as captured.

Also from the live capture: the backup file's SHA-256 equals the hash
recorded on 2026-10-26 (the backup is unchanged), and the journal
showed 923 error-priority lines in the current boot (12 days of
uptime), now recorded in the snapshot rather than self-reported.

The 2026-10-26 snapshot stays in evidence/ as the transcribed record
it always was (from TECHNICAL-DOCUMENTATION.md of the R610 Ubuntu
install goal).

## Run it

```text
python -m unittest discover -s tests -p "test_learn*.py" -v
python level-1-learn/run_check.py
```

No dependencies beyond Python 3. The checker runs anywhere; only the
capture step needs the server.

## Measured results (2026-11-04, Muse VM, Python 3.12.3)

Recorded snapshot: Dell PowerEdge R610, hostname r610, Ubuntu
24.04.5, kernel 6.8.0-147-generic, evidence date 2026-10-26.

| Check | Result |
| --- | --- |
| os_ubuntu_24_04 | PASS: ubuntu, 24.04.5 |
| ssh_key_only | PASS: password_authentication=no, root locked |
| static_ip_plan | PASS: eno1, 192.168.1.50/24, static |
| firewall_lan_only | PASS: deny incoming, ports 22 and 9090 from 192.168.1.0/24 only |
| storage_pool_labvg | PASS: labvg, 3 PVs, 1531.87 GB total |
| cockpit_dashboard | PASS: Cockpit 314, port 9090, socket-activated, machines plugin |
| labnet_isolated | PASS: 10.99.0.0/24, forward none, autostart |
| services_and_logs | PASS: ssh, cockpit.socket, libvirtd active; journal checked |
| automatic_security_updates | PASS: on |
| verified_config_backup | PASS: backup present, SHA256 recorded (64 hex chars) |

Result: 10 of 10 checks passed on the recorded snapshot. 9 unit
tests pass, including six mutation tests: each broken snapshot
(password auth on, labnet forwarding set, pool shrunk, extra open
port, bad backup hash, wrong static address) fails exactly the one
check it breaks.

Update after the 2026-11-04 run: four more mutation tests (older
Ubuntu release, Cockpit without the machines plugin, libvirtd
stopped, automatic updates off) bring the suite to 13 tests, with a
failing case for all 10 checks. The site/ dashboard's build also
runs a parity check: a JavaScript port of the checker must match
this Python checker, flag for flag and detail for detail, on the
recorded snapshot, all 10 mutations and threshold edge cases.

## Limits, stated plainly

- The evidence is dated 2026-10-26, not today. Server state can
  drift; only a fresh capture in a power-on window proves today.
  This is the named open item for the next P23 cycle.
- The checker ran on the Muse VM, not on the R610. The checker is
  portable Python, so the run is valid; the capture is the part
  that needs the server.
- The Cockpit view is taught from the build record and its
  screenshot in the R610 goal files, not from a live session in
  this cycle.
- Build scope (DNS for lab names, a reverse proxy, VM templates,
  the NAS track with a timed restore) is not started.

## Next

Level 2, Build opens with a fresh live capture in a planned
power-on window (capture_snapshot.sh, dated snapshot, checker run),
then the network layer in SPEC.md: DNS for lab names, a reverse
proxy in front of fleet services, KVM/libvirt VM templates, and
the NAS and storage track.
