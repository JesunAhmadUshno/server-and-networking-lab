"""Layout check: the files the portfolio standard requires exist. Nothing more."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
need = ["README.md", "PROPOSAL.md", "REPORT.md", "CHANGELOG.md", "CITATION.cff", "SECURITY.md", "LICENSE",
        "src/baseline_check.py", "src/run_check.py", "src/make_results.py", "src/capture_snapshot.sh",
        "src/nightly_backup.sh", "src/drill.sh", "docs/RUNBOOK.md",
        "results/baseline.json", "results/recovery.json", "docs/decisions/0001-approved-firewall-ports.md"]
missing = [p for p in need if not os.path.exists(os.path.join(ROOT, p))]
assert not missing, "missing files: " + ", ".join(missing)
assert os.listdir(os.path.join(ROOT, "experiments", "snapshots")), "no snapshots in experiments/snapshots/"
print("layout check: PASS,", len(need), "files present")
