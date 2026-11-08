"""Recovery harness: scoring against the locked pass lines, and both scripts end to end."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
from make_results import score_h1, score_drills

DAY = 24 * 3600


def night(i, verified=True, gap=DAY):
    return {"started_epoch": 1_800_000_000 + i * gap, "archive": "nightly-2027-01-%02d.tar.gz" % (i + 1),
            "verified": verified}


def trial(h, n, seconds, verified=True, archive_age_days=0):
    start = 1_800_000_000
    return {"hypothesis": h, "trial": n, "started_epoch": start, "seconds": seconds, "verified": verified,
            "bytes_restored": 10**9, "archive_epoch": start - archive_age_days * DAY}


class H1Scoring(unittest.TestCase):
    def test_not_run(self):
        self.assertEqual(score_h1([])["status"], "not run")

    def test_in_progress(self):
        self.assertEqual(score_h1([night(i) for i in range(3)])["status"], "in progress")

    def test_seven_good_nights_pass(self):
        self.assertEqual(score_h1([night(i) for i in range(7)])["status"], "pass")

    def test_one_failed_night_is_a_miss_not_a_restart(self):
        nights = [night(i, verified=(i != 2)) for i in range(10)]
        self.assertEqual(score_h1(nights)["status"], "miss")

    def test_missing_night_is_a_miss(self):
        nights = [night(i) for i in range(7)]
        nights[4:] = [night(i + 1) for i in range(4, 7)]  # skips a day: a 48 h gap
        self.assertEqual(score_h1(nights)["status"], "miss")

    def test_scheduler_jitter_allowed(self):
        self.assertEqual(score_h1([night(i, gap=DAY + 59) for i in range(7)])["status"], "pass")


class DrillScoring(unittest.TestCase):
    def test_not_run(self):
        self.assertEqual(score_drills([], "H2")["status"], "not run")

    def test_three_fast_verified_trials_pass(self):
        self.assertEqual(score_drills([trial("H2", n, 1700) for n in (1, 2, 3)], "H2")["status"], "pass")

    def test_one_slow_trial_is_a_miss(self):
        t = [trial("H2", 1, 1900), trial("H2", 2, 600), trial("H2", 3, 600)]
        self.assertEqual(score_drills(t, "H2")["status"], "miss")

    def test_unverified_restore_is_a_miss(self):
        t = [trial("H2", 1, 600, verified=False), trial("H2", 2, 600), trial("H2", 3, 600)]
        self.assertEqual(score_drills(t, "H2")["status"], "miss")

    def test_h3_has_a_longer_limit(self):
        self.assertEqual(score_drills([trial("H3", n, 3500) for n in (1, 2, 3)], "H3")["status"], "pass")

    def test_h3_stale_archive_is_a_miss(self):
        t = [trial("H3", 1, 600, archive_age_days=3), trial("H3", 2, 600), trial("H3", 3, 600)]
        self.assertEqual(score_drills(t, "H3")["status"], "miss")

    def test_only_first_three_trials_count(self):
        t = [trial("H2", 1, 1900)] + [trial("H2", n, 600) for n in (2, 3, 4)]
        self.assertEqual(score_drills(t, "H2")["status"], "miss")


class Scripts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = self.tmp.name
        self.src = os.path.join(self.d, "data")
        os.makedirs(self.src)
        with open(os.path.join(self.src, "a.conf"), "w") as f:
            f.write("setting = 1\n")

    def tearDown(self):
        self.tmp.cleanup()

    def test_drill_records_a_verified_and_a_failed_restore(self):
        archive = os.path.join(self.d, "nightly-2027-01-01.tar.gz")
        subprocess.run(["tar", "-czpf", archive, "-C", self.d, "data"], check=True)
        restore, out = os.path.join(self.d, "restore"), os.path.join(self.d, "drills")
        os.makedirs(restore)
        subprocess.run(["tar", "-xpzf", archive, "-C", restore], check=True)  # the runbook's restore
        run = lambda n: subprocess.run(["sh", os.path.join(ROOT, "src", "drill.sh"), "H2", str(n), archive,
                                        restore, out], input="\n", capture_output=True, text=True)
        self.assertEqual(run(1).returncode, 0)
        with open(os.path.join(restore, "data", "a.conf"), "w") as f:
            f.write("setting = 2\n")
        self.assertEqual(run(2).returncode, 0)
        recs = {r["trial"]: r for r in (json.load(open(os.path.join(out, p))) for p in os.listdir(out))}
        self.assertTrue(recs[1]["verified"])
        self.assertFalse(recs[2]["verified"])
        self.assertNotEqual(run(1).returncode, 0, "an existing trial record must never be overwritten")

    def test_nightly_backup_logs_a_verified_offsite_copy(self):
        bdir, remote = os.path.join(self.d, "backup"), os.path.join(self.d, "offsite")
        os.makedirs(bdir)
        os.makedirs(remote)
        env = dict(os.environ, BACKUP_DIR=bdir, BACKUP_REMOTE=remote, BACKUP_PATHS=self.src)
        r = subprocess.run(["sh", os.path.join(ROOT, "src", "nightly_backup.sh")], env=env,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        line = json.loads(open(os.path.join(bdir, "h1-log.jsonl")).read().splitlines()[-1])
        self.assertTrue(line["verified"])
        self.assertEqual(line["sha256"], line["offsite_sha256"])
        for f in (os.path.join(bdir, line["archive"]), os.path.join(remote, line["archive"]),
                  os.path.join(bdir, "h1-log.jsonl")):
            self.assertEqual(os.stat(f).st_mode & 0o077, 0, f + " must be readable by its owner only")

    def test_nightly_backup_logs_a_failed_copy_as_unverified(self):
        bdir = os.path.join(self.d, "backup")
        os.makedirs(bdir)
        env = dict(os.environ, BACKUP_DIR=bdir, BACKUP_REMOTE=os.path.join(self.d, "missing"),
                   BACKUP_PATHS=self.src)
        r = subprocess.run(["sh", os.path.join(ROOT, "src", "nightly_backup.sh")], env=env,
                           capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        line = json.loads(open(os.path.join(bdir, "h1-log.jsonl")).read().splitlines()[-1])
        self.assertFalse(line["verified"])


if __name__ == "__main__":
    unittest.main()
