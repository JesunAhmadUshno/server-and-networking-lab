"""Run the admin baseline checker on a snapshot and print the table.

Usage:
  python level-1-learn/run_check.py [snapshot.json]

With no argument it checks the recorded R610 snapshot in
level-1-learn/evidence/. Exit code is 0 only when every check passes.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from baseline_check import load_snapshot, run_checks

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.join(HERE, "evidence", "r610-snapshot-2026-10-26.json")


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT
    snapshot = load_snapshot(path)
    meta = snapshot.get("snapshot_meta", {})
    summary = run_checks(snapshot)
    print("Snapshot: %s" % path)
    if meta:
        print("Machine: %s" % meta.get("machine", "unknown"))
        print("Evidence date: %s" % meta.get("evidence_date", "unknown"))
        print("Source: %s" % meta.get("source", "unknown"))
    for row in summary["results"]:
        print("%s %-28s %s" % ("PASS" if row["pass"] else "FAIL", row["check"], row["detail"]))
    print("Result: %d of %d checks passed" % (summary["passed"], summary["total"]))
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
