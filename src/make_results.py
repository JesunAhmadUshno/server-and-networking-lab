"""Score every snapshot in experiments/snapshots/ and write results/baseline.json.

  python3 src/make_results.py          regenerate results/baseline.json
  python3 src/make_results.py --check  exit 1 if the committed file differs from a fresh re-score
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from baseline_check import load_snapshot, run_checks

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "results", "baseline.json")


def score():
    out = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "experiments", "snapshots", "*.json"))):
        s = run_checks(load_snapshot(path))
        out[os.path.basename(path)] = {"passed": s["passed"], "total": s["total"],
                                       "failed": [r["check"] for r in s["results"] if not r["pass"]]}
    return out


if __name__ == "__main__":
    fresh = json.dumps(score(), indent=1, sort_keys=True) + "\n"
    if "--check" in sys.argv:
        ok = os.path.exists(OUT) and open(OUT).read() == fresh
        print("results/baseline.json reproduced" if ok else "results/baseline.json DIFFERS from a fresh re-score")
        sys.exit(0 if ok else 1)
    with open(OUT, "w") as f:
        f.write(fresh)
    print(fresh, end="")
