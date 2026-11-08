"""Score the evidence in experiments/ against the locked pass lines (PROPOSAL.md, tag proposal-v1).

  python3 src/make_results.py          regenerate results/baseline.json and results/recovery.json
  python3 src/make_results.py --check  exit 1 if either committed file differs from a fresh re-score

Only the first 7 nights (H1) and the first 3 trials of each drill (H2, H3) count: a miss is never
retried away.
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
RECOVERY_OUT = os.path.join(ROOT, "results", "recovery.json")

# Pass lines, copied from PROPOSAL.md. Changing them after the proposal-v1 tag is not allowed.
H1_NIGHTS = 7
MAX_GAP_S = 24 * 3600 + 60          # data at risk at most 24 h; one minute for scheduler start jitter
TRIALS = 3
MAX_SECONDS = {"H2": 30 * 60, "H3": 60 * 60}


def score():
    out = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "experiments", "snapshots", "*.json"))):
        s = run_checks(load_snapshot(path))
        out[os.path.basename(path)] = {"passed": s["passed"], "total": s["total"],
                                       "failed": [r["check"] for r in s["results"] if not r["pass"]]}
    return out


def score_h1(nights):
    """nights: H1 log entries in the order logged. Pass = the first 7 all verified, no gap over 24 h."""
    first = nights[:H1_NIGHTS]
    gaps = [b["started_epoch"] - a["started_epoch"] for a, b in zip(first, first[1:])]
    bad = [n["archive"] for n in first if not n["verified"]]
    out = {"nights_logged": len(nights), "nights_scored": len(first), "unverified": bad,
           "max_gap_hours": round(max(gaps) / 3600, 2) if gaps else None}
    if not first:
        out["status"] = "not run"
    elif bad or any(g > MAX_GAP_S for g in gaps):
        out["status"] = "miss"
    else:
        out["status"] = "pass" if len(first) == H1_NIGHTS else "in progress"
    return out


def score_drills(records, h):
    """records: drill.sh outputs. Pass = the first 3 trials of h all verified and inside the time limit."""
    first = sorted((r for r in records if r["hypothesis"] == h), key=lambda r: r["trial"])[:TRIALS]
    trials = []
    for r in first:
        ok = r["verified"] and r["seconds"] <= MAX_SECONDS[h]
        if h == "H3":
            ok = ok and r["started_epoch"] - r["archive_epoch"] <= MAX_GAP_S
        trials.append({"trial": r["trial"], "minutes": round(r["seconds"] / 60, 1), "verified": r["verified"],
                       "gb_per_min": round(r["bytes_restored"] / 1e9 / max(r["seconds"] / 60, 1e-9), 3),
                       "pass": ok})
    status = ("not run" if not trials else "miss" if not all(t["pass"] for t in trials)
              else "pass" if len(trials) == TRIALS else "in progress")
    return {"status": status, "limit_minutes": MAX_SECONDS[h] // 60, "trials": trials}


def score_recovery():
    nights = []
    for path in sorted(glob.glob(os.path.join(ROOT, "experiments", "backups", "*.jsonl"))):
        nights += [json.loads(line) for line in open(path) if line.strip()]
    nights.sort(key=lambda n: n["started_epoch"])
    drills = [json.load(open(p)) for p in sorted(glob.glob(os.path.join(ROOT, "experiments", "drills", "*.json")))]
    return {"H1": score_h1(nights), "H2": score_drills(drills, "H2"), "H3": score_drills(drills, "H3")}


if __name__ == "__main__":
    ok = True
    for path, data in ((OUT, score()), (RECOVERY_OUT, score_recovery())):
        fresh = json.dumps(data, indent=1, sort_keys=True) + "\n"
        name = os.path.relpath(path, ROOT)
        if "--check" in sys.argv:
            same = os.path.exists(path) and open(path).read() == fresh
            ok = ok and same
            print(name, "reproduced" if same else "DIFFERS from a fresh re-score")
        else:
            with open(path, "w") as f:
                f.write(fresh)
            print(name, "written")
    sys.exit(0 if ok else 1)
