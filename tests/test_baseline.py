"""Level 1 Learn tests for the P23 admin baseline checker.

The load-bearing tests use the recorded R610 snapshot and mutations of
it. A checker that passes everything would prove nothing, so each
mutation must fail exactly the check it breaks.
"""
import copy
import json
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
from baseline_check import run_checks

SNAPSHOT = os.path.join(ROOT, "experiments", "snapshots", "r610-snapshot-2026-10-26.json")


def load():
    with open(SNAPSHOT, encoding="utf-8") as fh:
        return json.load(fh)


def failed_names(summary):
    return [r["check"] for r in summary["results"] if not r["pass"]]


class BaselineTests(unittest.TestCase):
    def test_recorded_snapshot_passes_all_checks(self):
        summary = run_checks(load())
        self.assertEqual(summary["total"], 10)
        self.assertEqual(summary["passed"], 10)
        self.assertEqual(failed_names(summary), [])

    def test_storage_total_is_the_documented_sum(self):
        snap = load()
        total = sum(pv["size_gb"] for pv in snap["storage"]["pool"]["physical_volumes"])
        self.assertAlmostEqual(total, 1531.87, places=2)

    def test_password_auth_on_fails_ssh_check_only(self):
        snap = copy.deepcopy(load())
        snap["ssh"]["password_authentication"] = "yes"
        self.assertEqual(failed_names(run_checks(snap)), ["ssh_key_only"])

    def test_labnet_forward_set_fails_isolation_only(self):
        snap = copy.deepcopy(load())
        snap["network"]["labnet"]["forward"] = "nat"
        self.assertEqual(failed_names(run_checks(snap)), ["labnet_isolated"])

    def test_small_pool_fails_storage_only(self):
        snap = copy.deepcopy(load())
        snap["storage"]["pool"]["physical_volumes"] = snap["storage"]["pool"]["physical_volumes"][:1]
        self.assertEqual(failed_names(run_checks(snap)), ["storage_pool_labvg"])

    def test_open_firewall_port_fails_firewall_only(self):
        snap = copy.deepcopy(load())
        snap["firewall"]["allowed_from_lan"].append({"port": 3389, "source": "0.0.0.0/0"})
        self.assertEqual(failed_names(run_checks(snap)), ["firewall_lan_only"])

    def test_wellformed_but_wrong_backup_hash_fails_backup_only(self):
        snap = load()
        snap["backup"]["sha256"] = "0" * 64
        self.assertEqual(failed_names(run_checks(snap)), ["verified_config_backup"])

    def test_bad_backup_hash_fails_backup_only(self):
        snap = copy.deepcopy(load())
        snap["backup"]["sha256"] = "not-a-hash"
        self.assertEqual(failed_names(run_checks(snap)), ["verified_config_backup"])

    def test_wrong_static_ip_fails_network_only(self):
        snap = copy.deepcopy(load())
        snap["network"]["primary_interface"]["address"] = "192.168.1.99/24"
        self.assertEqual(failed_names(run_checks(snap)), ["static_ip_plan"])

    def test_old_ubuntu_release_fails_os_check_only(self):
        snap = copy.deepcopy(load())
        snap["os"]["version_id"] = "22.04.4"
        self.assertEqual(failed_names(run_checks(snap)), ["os_ubuntu_24_04"])

    def test_missing_machines_plugin_fails_cockpit_only(self):
        snap = copy.deepcopy(load())
        snap["cockpit"]["machines_plugin"] = False
        self.assertEqual(failed_names(run_checks(snap)), ["cockpit_dashboard"])

    def test_inactive_libvirtd_fails_services_only(self):
        snap = copy.deepcopy(load())
        for service in snap["services"]:
            if service["name"] == "libvirtd":
                service["state"] = "inactive"
        self.assertEqual(failed_names(run_checks(snap)), ["services_and_logs"])

    def test_updates_off_fails_auto_updates_only(self):
        snap = copy.deepcopy(load())
        snap["updates"]["automatic_security_updates"] = False
        self.assertEqual(failed_names(run_checks(snap)), ["automatic_security_updates"])

    def test_owner_approved_ports_pass(self):
        # 3389 (xrdp) and 9001 (Penpot) on the LAN, 9001 on the tailnet: approved 2026-11-07.
        snap = copy.deepcopy(load())
        snap["firewall"]["allowed_from_lan"] += [{"port": 3389, "source": "192.168.1.0/24"},
                                                 {"port": 9001, "source": "192.168.1.0/24"},
                                                 {"port": 9001, "source": "Anywhere", "interface": "tailscale0"}]
        self.assertEqual(failed_names(run_checks(snap)), [])

    def test_unapproved_lan_port_fails_firewall_only(self):
        snap = copy.deepcopy(load())
        snap["firewall"]["allowed_from_lan"].append({"port": 8080, "source": "192.168.1.0/24"})
        self.assertEqual(failed_names(run_checks(snap)), ["firewall_lan_only"])

    def test_tailnet_rule_on_unapproved_port_fails_firewall_only(self):
        snap = copy.deepcopy(load())
        snap["firewall"]["allowed_from_lan"].append({"port": 22, "source": "Anywhere", "interface": "tailscale0"})
        self.assertEqual(failed_names(run_checks(snap)), ["firewall_lan_only"])

    def test_missing_ssh_rule_fails_firewall_only(self):
        snap = copy.deepcopy(load())
        snap["firewall"]["allowed_from_lan"] = [r for r in snap["firewall"]["allowed_from_lan"] if r["port"] != 22]
        self.assertEqual(failed_names(run_checks(snap)), ["firewall_lan_only"])

    def test_snapshot_meta_names_its_source_and_date(self):
        meta = load()["snapshot_meta"]
        self.assertEqual(meta["evidence_date"], "2026-10-26")
        self.assertIn("not a live capture", meta["source"])


if __name__ == "__main__":
    unittest.main()
