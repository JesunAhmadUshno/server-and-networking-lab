# Runbook: recovery tests (PROPOSAL.md, tag proposal-v1)

Everything here runs on the R610 or on a test VM on labnet. Nothing in
this file changes the live host's services, firewall or disks; the
host gains two cron jobs (the H1 backup and the monitoring check).
Drills run from a clone of this repo, so records land in
experiments/drills/ of that clone.

## 0. Before anything

```text
git clone https://github.com/JesunAhmadUshno/server-and-networking-lab
sudo install -d /opt/p23 && sudo install -m 755 server-and-networking-lab/src/*.sh server-and-networking-lab/src/*.py /opt/p23/
sh server-and-networking-lab/src/drill.sh order        # the random trial order; commit the file it writes
```

## 1. H1: nightly backup, 7 nights, real server

1. Pick the off-server host. It receives copies of /etc (secrets
   included), so it must be trusted as much as the server. Give root on
   the R610 an SSH key that can write to one directory there.
2. Install the job (03:15 UTC each night):

   ```text
   echo '15 3 * * * root BACKUP_REMOTE=user@host:/backups/r610 BACKUP_PATHS="/etc" /opt/p23/nightly_backup.sh' | sudo tee /etc/cron.d/p23-backup
   ```

3. Do not retry or re-run a failed night. Only the first 7 nights count.
4. After night 7: copy `/srv/backup/h1-log.jsonl` to
   `experiments/backups/h1-log-<first night>.jsonl`, run
   `python3 src/make_results.py`, and commit both files.

## 2. Test VM (once, for H2 and H3)

```text
virt-install --name p23-drill --network network=labnet --memory 2048 --vcpus 2 \
  --disk size=20 --disk size=4 --disk size=4 --disk size=4 --import ...   # Ubuntu 24.04 cloud image
# inside the VM: one linear pool like labvg
sudo vgcreate drillvg /dev/vdb /dev/vdc /dev/vdd
sudo lvcreate -l 100%FREE -n data drillvg && sudo mkfs.ext4 /dev/drillvg/data
sudo mount /dev/drillvg/data /srv/data && sudo cp -a /usr/share/doc /srv/data/   # sample data
sudo install -d /srv/backup
```

Clone this repo inside the VM too. Copy the R610's newest nightly
archive into the VM with `scp -p`, so the file keeps its time.

## 3. H2: configuration restore (each trial at most 30 min)

1. Fault: on the VM, `sudo rm -rf /srv/restore && sudo mkdir /srv/restore`.
2. Start the clock: `sudo sh server-and-networking-lab/src/drill.sh H2 <n> <archive> /srv/restore`.
3. Fetch the archive from the off-server host and restore:
   `sudo tar -xpzf <archive> -C /srv/restore`.
4. Press Enter. The script checks every file with `tar --compare` and
   writes `experiments/drills/<date>-H2-trial<n>.json`.

## 4. H3: one disk lost (each trial at most 60 min)

1. Back up the pool: `sudo BACKUP_REMOTE=user@host:/backups/drill BACKUP_PATHS=/srv/data BACKUP_DIR=/srv/backup sh /opt/p23/nightly_backup.sh`.
2. Fault, from the host: `virsh detach-disk p23-drill vdc --live`. The pool is now broken.
3. Start the clock in the VM: `sudo sh server-and-networking-lab/src/drill.sh H3 <n> <archive> /`.
4. Recover: attach a blank disk (`virsh attach-disk ... --live`), then
   `vgreduce --removemissing --force drillvg`, extend onto the new disk,
   `lvcreate`, `mkfs.ext4`, mount on /srv/data, fetch the archive from
   the off-server host with `scp -p`, and `tar -xpzf <archive> -C /`.
5. Press Enter. The record checks the restore and the backup's age.

## 5. Scoring

```text
python3 src/make_results.py     # writes results/recovery.json
```

Copy each record into experiments/ unchanged and commit it. Misses are
reported as measured; the pass lines in PROPOSAL.md never move.

## Monitoring (build item, not a hypothesis)

```text
echo '0 * * * * root sh /opt/p23/capture_snapshot.sh > /tmp/p23.json && python3 /opt/p23/run_check.py /tmp/p23.json || logger -p user.err "p23 baseline check FAILED"' | sudo tee /etc/cron.d/p23-monitor
```

A failing check, or a failed backup, writes an error-priority line to
the journal (`journalctl -p err -t root`) and shows in Cockpit's log view.
