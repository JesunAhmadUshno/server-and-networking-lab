"""Admin baseline checker for a Linux server snapshot.

Dependency-free. It reads a snapshot JSON (an evidence bundle captured
from a server, see capture_snapshot.sh) and checks the admin baseline: key-only SSH, a static address, a LAN-only firewall,
a named storage pool, the Cockpit dashboard, an isolated lab network,
running services with logs, automatic security updates, and a verified
config backup whose hash matches the one recorded at backup time. Every check returns a name, a pass flag, and the value
it actually saw, so a reader can audit the result without trusting a
summary line.
"""
import json


def _get(data, *keys, default=None):
    cur = data
    for key in keys:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def check_os(snap):
    os_id = str(_get(snap, "os", "id", default="")).lower()
    version = str(_get(snap, "os", "version_id", default=""))
    ok = os_id == "ubuntu" and version.startswith("24.04")
    return ok, "os.id=%s version_id=%s" % (os_id, version)


def check_ssh_key_only(snap):
    password_auth = str(_get(snap, "ssh", "password_authentication", default="")).lower()
    root_locked = _get(snap, "ssh", "root_password_locked", default=False)
    ok = password_auth == "no" and root_locked is True
    return ok, "password_authentication=%s root_password_locked=%s" % (password_auth, root_locked)


def check_static_ip(snap):
    iface = _get(snap, "network", "primary_interface", default={}) or {}
    ok = iface.get("name") == "eno1" and iface.get("address") == "192.168.1.50/24" and iface.get("mode") == "static"
    return ok, "interface=%s address=%s mode=%s" % (iface.get("name"), iface.get("address"), iface.get("mode"))


# Firewall policy. SSH (22) and Cockpit (9090) must be open to the LAN. xrdp remote desktop
# (3389) and the Penpot design server (9001) were found by the 2026-11-07 live capture and
# approved by the Owner the same day; Penpot is also allowed on the tailscale0 interface,
# where only devices signed into the tailnet can reach it. Any other rule fails the check.
REQUIRED_PORTS = [22, 9090]
LAN_SOURCE = "192.168.1.0/24"
APPROVED_LAN_PORTS = [22, 3389, 9001, 9090]
APPROVED_TAILNET = {"tailscale0": [9001]}
# SHA-256 of /srv/backup/pre-perc-2026-10-26.tar.gz as recorded at backup time (2026-10-26).
EXPECTED_BACKUP_SHA256 = "4568177d3cddd330f909c33ee4e24ef412d8c81df273e313ae787b5e1dcc3a58"


def check_firewall(snap):
    fw = _get(snap, "firewall", default={}) or {}
    rules = [r for r in fw.get("allowed_from_lan", []) or [] if isinstance(r, dict)]
    lan = [r for r in rules if not r.get("interface")]
    ports = sorted(r.get("port") for r in lan)
    sources = sorted(set(r.get("source") for r in lan))
    tailnet = sorted("%s:%s" % (r.get("interface"), r.get("port")) for r in rules if r.get("interface"))
    ok = (fw.get("active") is True and fw.get("default_incoming") == "deny"
          and sources == [LAN_SOURCE] and all(p in APPROVED_LAN_PORTS for p in ports)
          and all(p in ports for p in REQUIRED_PORTS)
          and all(r.get("port") in APPROVED_TAILNET.get(r.get("interface"), []) for r in rules if r.get("interface")))
    return ok, "active=%s default_incoming=%s ports=%s sources=%s tailnet=%s" % (
        fw.get("active"), fw.get("default_incoming"), ports, sources, tailnet)


def check_storage_pool(snap):
    pool = _get(snap, "storage", "pool", default={}) or {}
    pvs = pool.get("physical_volumes", []) or []
    total = round(sum(float(pv.get("size_gb", 0)) for pv in pvs), 2)
    ok = pool.get("name") == "labvg" and len(pvs) == 3 and total >= 1500.0
    return ok, "pool=%s pvs=%d total_gb=%.2f" % (pool.get("name"), len(pvs), total)


def check_cockpit(snap):
    cp = _get(snap, "cockpit", default={}) or {}
    ok = (cp.get("port") == 9090 and cp.get("socket_activated") is True
          and cp.get("machines_plugin") is True and int(cp.get("version", 0)) >= 300)
    return ok, "version=%s port=%s socket_activated=%s machines_plugin=%s" % (
        cp.get("version"), cp.get("port"), cp.get("socket_activated"), cp.get("machines_plugin"))


def check_labnet_isolated(snap):
    net = _get(snap, "network", "labnet", default={}) or {}
    ok = (net.get("name") == "labnet" and net.get("subnet") == "10.99.0.0/24"
          and net.get("forward") in ("none", None) and net.get("autostart") is True)
    return ok, "name=%s subnet=%s forward=%s autostart=%s" % (
        net.get("name"), net.get("subnet"), net.get("forward"), net.get("autostart"))


def check_services_and_logs(snap):
    services = _get(snap, "services", default=[]) or []
    by_name = {s.get("name"): s for s in services if isinstance(s, dict)}
    needed = ["ssh", "cockpit.socket", "libvirtd"]
    missing = [n for n in needed if by_name.get(n, {}).get("state") != "active"]
    logs = _get(snap, "logs", "journal_check", default="")
    ok = not missing and logs == "checked"
    return ok, "services_active=%s journal_check=%s" % (
        [n for n in needed if n not in missing], logs)


def check_auto_updates(snap):
    enabled = _get(snap, "updates", "automatic_security_updates", default=False)
    return enabled is True, "automatic_security_updates=%s" % (enabled,)


def check_backup(snap):
    backup = _get(snap, "backup", default={}) or {}
    sha = str(backup.get("sha256", ""))
    ok = backup.get("present") is True and sha == EXPECTED_BACKUP_SHA256
    return ok, "present=%s sha256_matches_record=%s" % (backup.get("present"), sha == EXPECTED_BACKUP_SHA256)


CHECKS = [
    ("os_ubuntu_24_04", check_os),
    ("ssh_key_only", check_ssh_key_only),
    ("static_ip_plan", check_static_ip),
    ("firewall_lan_only", check_firewall),
    ("storage_pool_labvg", check_storage_pool),
    ("cockpit_dashboard", check_cockpit),
    ("labnet_isolated", check_labnet_isolated),
    ("services_and_logs", check_services_and_logs),
    ("automatic_security_updates", check_auto_updates),
    ("verified_config_backup", check_backup),
]


def run_checks(snapshot):
    results = []
    for name, fn in CHECKS:
        passed, detail = fn(snapshot)
        results.append({"check": name, "pass": bool(passed), "detail": detail})
    passed_count = sum(1 for r in results if r["pass"])
    return {"total": len(results), "passed": passed_count,
            "failed": len(results) - passed_count, "results": results}


def load_snapshot(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)
