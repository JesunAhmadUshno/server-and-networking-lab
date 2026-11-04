#!/bin/sh
# capture_snapshot.sh: read-only evidence capture for the P23 baseline.
# Run this ON the server, in a planned power-on window. It changes
# nothing: it only reads system state and prints a JSON snapshot to
# stdout. Save the output as a new dated file under evidence/, then
# run: python level-1-learn/run_check.py <that file>
# It needs sudo only for sshd -T and ufw status, which read config.
set -eu
echo "{" 
printf '  "os": {"id": "%s", "version_id": "%s", "kernel": "%s"},\n' \
  "$(. /etc/os-release && echo "$ID")" \
  "$(. /etc/os-release && echo "$VERSION_ID")" \
  "$(uname -r)"
printf '  "ssh": {"port": 22, "password_authentication": "%s", "root_password_locked": %s},\n' \
  "$(sudo sshd -T 2>/dev/null | awk '/passwordauthentication/ {print $2}')" \
  "$(passwd -S root | awk '{print ($2=="L") ? "true" : "false"}')"
echo '  "note": "Fill network, firewall, storage, cockpit, services, logs, updates and backup fields from: ip -brief addr, sudo ufw status verbose, pvs and vgs, cockpit --version, systemctl is-active ssh cockpit.socket libvirtd, journalctl --no-pager -n 5, and sha256sum of the config backup. The checker names every field it needs."'
echo "}"
