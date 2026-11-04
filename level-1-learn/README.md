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
   only ports 22 and 9090 are open, only to 192.168.1.0/24.
   Automatic security updates are on.
7. Backup proof. A verified config backup sits on the pool at
   /srv/backup/pre-perc-2026-10-26.tar.gz, SHA256
   4568177d3cddd330f909c33ee4e24ef412d8c81df273e313ae787b5e1dcc3a58.
   A backup without a hash is a hope, not a backup.

## Evidence capture (how a fresh snapshot is taken)

capture_snapshot.sh is the read-only capture script. Run it on the
server in a planned power-on window; it changes nothing and prints
the snapshot fields the checker needs, with the exact commands for
the remaining fields in its output note. Save the result as a new
dated file under evidence/, never over an older snapshot, then run
the checker on it.

The snapshot in evidence/ today is the 2026-10-26 snapshot. It was
transcribed from the verified build record (TECHNICAL-DOCUMENTATION.md
of the R610 Ubuntu install goal, live-verified on 2026-10-26). It is
not a live capture taken on 2026-11-04: a live re-capture attempt in
this cycle could not reach the server (the fleet SSH route failed
host-key verification, which was not bypassed, and direct network
probes are blocked from the Muse VM). The next power-on window
closes that gap with capture_snapshot.sh.

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
