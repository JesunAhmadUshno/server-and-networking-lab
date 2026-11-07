#!/bin/sh
# capture_snapshot.sh: read-only evidence capture for the P23 baseline.
# Run this ON the server. It changes nothing: every command below only
# reads state. It prints one JSON snapshot with every field
# baseline_check.py reads. Save it as a dated file under evidence/, then
# run: python3 level-1-learn/run_check.py <that file>
#
#   sh capture_snapshot.sh [backup-path] > r610-snapshot-$(date +%F)-live.json
#
# sudo is used only to read: sshd -T, passwd -S root, ufw status, pvs,
# virsh net-dumpxml, and the backup file hash. A field that cannot be
# read is written as null, so the checker fails it instead of guessing.
set -eu
sudo -v || true
BACKUP="${1:-/srv/backup/pre-perc-2026-10-26.tar.gz}" exec python3 - <<'PY'
import hashlib, ipaddress, json, os, re, socket, subprocess, time
import xml.etree.ElementTree as ET


def run(*cmd, sudo=False):
    try:
        r = subprocess.run((["sudo", "-n"] if sudo else []) + list(cmd), capture_output=True, text=True, timeout=30)
        return r.stdout if r.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def osrel():
    d = {}
    for line in open("/etc/os-release"):
        k, _, v = line.strip().partition("=")
        d[k] = v.strip('"')
    return {"id": d.get("ID"), "version_id": d.get("VERSION_ID"), "kernel": os.uname().release}


def ssh():
    t = run("sshd", "-T", sudo=True) or ""
    m = re.search(r"^passwordauthentication (\S+)", t, re.M)
    p = (run("passwd", "-S", "root", sudo=True) or "").split()
    return {"port": 22, "password_authentication": m.group(1) if m else None,
            "root_password_locked": (p[1] == "L") if len(p) > 1 else None}


def primary():
    routes = json.loads(run("ip", "-j", "route", "show", "default") or "[]")
    if not routes:
        return None
    dev, gw = routes[0].get("dev"), routes[0].get("gateway")
    info = json.loads(run("ip", "-j", "addr", "show", "dev", dev) or "[{}]")[0]
    inet = [a for a in info.get("addr_info", []) if a.get("family") == "inet"]
    if not inet:
        return {"name": dev, "gateway": gw, "address": None, "mode": None}
    a = inet[0]
    # The kernel flags DHCP leases as dynamic; an address without it was set statically.
    return {"name": dev, "gateway": gw, "address": f"{a['local']}/{a['prefixlen']}",
            "mode": "dhcp" if a.get("dynamic") else "static"}


def labnet():
    x = run("virsh", "-c", "qemu:///system", "net-dumpxml", "labnet", sudo=True)
    if not x:
        return None
    root = ET.fromstring(x)
    fwd = root.find("forward")
    ip = root.find("ip")
    host = net = None
    if ip is not None:
        iface = ipaddress.ip_interface(f"{ip.get('address')}/{ip.get('netmask') or ip.get('prefix')}")
        host, net = str(iface), str(iface.network)
    info = run("virsh", "-c", "qemu:///system", "net-info", "labnet", sudo=True) or ""
    auto = re.search(r"^Autostart:\s+(\S+)", info, re.M)
    return {"name": root.findtext("name"), "subnet": net, "host_address": host,
            "forward": "none" if fwd is None else fwd.get("mode", "nat"),
            "autostart": (auto.group(1) == "yes") if auto else None}


def firewall():
    t = run("ufw", "status", "verbose", sudo=True)
    if t is None:
        return None
    rules = []
    for line in t.splitlines():
        m = re.match(r"^(\d+)(?:/tcp)?\s+ALLOW IN\s+(\S+)", line.strip())
        if m:
            rules.append({"port": int(m.group(1)), "source": m.group(2)})
    d = re.search(r"Default:\s*(\w+) \(incoming\)", t)
    return {"active": "Status: active" in t, "default_incoming": d.group(1) if d else None, "allowed_from_lan": rules}


def storage():
    t = run("pvs", "--reportformat", "json", "--units", "g", "--nosuffix", "-o", "pv_name,vg_name,pv_size", sudo=True)
    if not t:
        return None
    pvs = [p for p in json.loads(t)["report"][0]["pv"] if p["vg_name"] == "labvg"]
    return {"pool": {"name": "labvg" if pvs else None, "physical_volumes": [
        {"device": os.path.basename(p["pv_name"]), "size_gb": round(float(p["pv_size"]), 2)} for p in pvs]}}


def cockpit():
    v = re.search(r"Version:\s*(\d+)", run("cockpit-bridge", "--version") or "")
    listen = run("systemctl", "show", "cockpit.socket", "-p", "Listen") or ""
    port = re.search(r":(\d+) ", listen)
    return {"version": int(v.group(1)) if v else None, "port": int(port.group(1)) if port else None,
            "socket_activated": (run("systemctl", "is-enabled", "cockpit.socket") or "").strip() == "enabled",
            "machines_plugin": os.path.isdir("/usr/share/cockpit/machines")}


def updates():
    try:
        t = open("/etc/apt/apt.conf.d/20auto-upgrades").read()
    except OSError:
        return {"automatic_security_updates": False}
    return {"automatic_security_updates": bool(re.search(r'Unattended-Upgrade\s+"1"', t))}


def backup(path):
    h = None
    try:
        with open(path, "rb") as f:
            h = hashlib.file_digest(f, "sha256").hexdigest()
    except PermissionError:
        out = run("sha256sum", path, sudo=True)
        h = out.split()[0] if out else None
    except OSError:
        pass
    return {"path": path, "present": h is not None, "sha256": h}


svc = [{"name": n, "state": (run("systemctl", "is-active", n) or "inactive").strip()}
       for n in ("ssh", "cockpit.socket", "libvirtd")]
errs = run("journalctl", "--no-pager", "-q", "-b", "-p", "err", "-o", "cat")
snap = {
    "os": osrel(), "ssh": ssh(),
    "network": {"primary_interface": primary(), "labnet": labnet()},
    "firewall": firewall(), "storage": storage(), "cockpit": cockpit(), "services": svc,
    "logs": {"journal_check": "checked" if errs is not None else None,
             "errors_this_boot": len(errs.splitlines()) if errs is not None else None},
    "updates": updates(), "backup": backup(os.environ["BACKUP"]),
    "snapshot_meta": {"source": "live capture by level-1-learn/capture_snapshot.sh on the server",
                      "machine": "hostname " + socket.gethostname(),
                      "hostname": socket.gethostname(), "evidence_date": time.strftime("%Y-%m-%d"),
                      "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")},
}
print(json.dumps(snap, indent=1, sort_keys=True))
PY
