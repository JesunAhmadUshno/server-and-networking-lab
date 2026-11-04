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
sys.path.insert(0, os.path.join(ROOT, "level-1-learn"))
from baseline_check import run_checks

SNAPSHOT = os.path.join(ROOT, "level-1-learn", "evidence", "r610-snapshot-2026-10-26.json")


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

    def test_bad_backup_hash_fails_backup_only(self):
        snap = copy.deepcopy(load())
        snap["backup"]["sha256"] = "not-a-hash"
        self.assertEqual(failed_names(run_checks(snap)), ["verified_config_backup"])

    def test_wrong_static_ip_fails_network_only(self):
        snap = copy.deepcopy(load())
        snap["network"]["primary_interface"]["address"] = "192.168.1.99/24"
        self.assertEqual(failed_names(run_checks(snap)), ["static_ip_plan"])

    def test_snapshot_meta_names_its_source_and_date(self):
        meta = load()["snapshot_meta"]
        self.assertEqual(meta["evidence_date"], "2026-10-26")
        self.assertIn("not a live capture", meta["source"])


if __name__ == "__main__":
    unittest.main()
