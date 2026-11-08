# Research review: server-and-networking-lab

Reviewed 2026-11-07 against a doctoral-level rubric for a systems lab, plus engineering rigor. Scope: what is in the repo today (Level 1, Learn). Levels 2 and 3 are scaffold only and are graded as not started.

Grades: A (meets the bar), B (minor gaps), C (real gaps), D (largely missing), n/a with a reason.

## Summary

Level 1 is a small, honest, well-tested artifact: a dependency-free checker of 10 admin-baseline facts, a recorded snapshot of one Dell R610, and a mutation test for every check. Its weakest links are the evidence chain (the snapshot was transcribed by hand, not captured) and two checks that test a format or a self-report rather than the underlying fact. It is a teaching tool and a host spec check, not a research result; nothing in it is measured beyond pass or fail.

## Rubric

| Criterion | Grade | Evidence and gaps |
| --- | --- | --- |
| Question | B | Clear practical question in level-1-learn/README.md: can a server's admin baseline be reduced to a short list of checkable facts? It is an engineering question, not a research hypothesis. |
| Hypotheses | C | No stated hypothesis or prediction. The implicit claim is "the recorded R610 meets this baseline", which the checker answers on the snapshot. |
| Method | B | 10 deterministic checks, each printing the value it saw (baseline_check.py). Method is fully readable. Weakness: no rationale for why these 10 checks, and no threat model behind them. |
| Baselines / related work | C (was D) | Fixed today: DOSSIER.md Past now names CIS Benchmarks, OpenSCAP/SCAP, Lynis, Chef InSpec, Goss and Testinfra, and says this checker is narrower. Still open: no mapping of checks to CIS control IDs. NOVELTY.md is a draft with no measured difference. |
| Statistics / uncertainty | n/a | The checks are boolean and deterministic on a fixed snapshot; there is no sampling, so no confidence interval applies. The relevant uncertainty is evidence age and transcription error, covered under threats. |
| Reproducibility | A | `python3 level-1-learn/run_check.py` and the unit tests need only Python 3 and run in under a second. CI runs both. The site build reruns the Python checker and asserts the JS port agrees on 16 snapshots. |
| Validity of the evidence | A (was C) | Update 2026-11-07: capture_snapshot.sh now emits every field and ran on the R610; the live snapshot (evidence/r610-snapshot-2026-11-07-live.json) scores 9 of 10, and the miss is real firewall drift (ports 3389 and 9001 added), which the Owner then approved into the baseline. Capture-to-check has run end to end. Re-capture 2026-11-08 (evidence/r610-snapshot-2026-11-08-live.json), with the fixed script, records all five rules including 9001 on tailscale0 and scores 10 of 10. |
| Test strength | A (was B) | Mutation coverage was 6 of 10 checks at the 2026-11-04 run; it is now 10 of 10 (tests/test_learn_baseline.py, 13 tests). Each mutation asserts exactly one failing check. The site build adds a JS/Python parity check with threshold edge cases. |
| Threats to validity | B | Stated plainly in the Learn README and on the dashboard: evidence age, transcription, checker run off the server, Cockpit taught from the record. Added on the dashboard: the two weak checks and the unexplained Cockpit version floor. |
| Limitations | B | Present and honest. The checker is host-specific: interface, address, ports and subnet are fixed in code, so policy and mechanism are not separated. |
| Engineering rigor | B | Small pure functions, no dependencies, clear output, CI. Missing: a policy file separate from code, and a schema for the snapshot. |
| Public verifiability | C | DOSSIER and the snapshot's source line cite private build records and notes that outside readers cannot open. |

## Cheap gaps fixed in this pass

1. Four missing mutation tests (OS release, Cockpit machines plugin, libvirtd state, automatic updates): mutation coverage 10 of 10.
2. JS port parity check (site/src/checker.check.mjs), run by `npm run build` and therefore by the Pages workflow: the browser checker must reproduce the Python checker's pass flags and detail strings, and every mutation preset must use the same change and expected failure as its Python test.
3. Related-work note in DOSSIER.md (names and roles only; no invented comparisons).
4. Limits block on the dashboard repeating the README's evidence-honesty statement word for word, plus the weak checks.
5. README and Learn README test counts brought up to date, with the 2026-11-04 run's original counts kept.

## Remaining gaps and exactly what each needs

| Gap | What closes it | Needs |
| --- | --- | --- |
| ~~Evidence is transcribed, not captured~~ | CLOSED 2026-11-07: live snapshot captured on the R610 and checked (9 of 10, firewall drift) | Done |
| ~~capture_snapshot.sh is partial~~ | CLOSED 2026-11-07: emits every field, validated on the R610 | Done |
| Backup check is format-only | Store the backup's size and compare `sha256sum` of the file with the recorded hash during capture | Read access to /srv/backup on the R610 during capture. |
| Journal check is self-reported | Replace `journal_check == "checked"` with captured evidence (for example, the last boot's journal entry count and timestamp) | Capture on the R610. |
| Host-specific policy | Move expected values to a policy JSON; keep the checker generic | Code change only (a few hours); deferred to Level 2 so the Level 1 tests stay a fixed record. |
| No rationale / standard mapping | Map each check to a CIS Ubuntu 24.04 benchmark recommendation, or state why none applies | The CIS Ubuntu Linux 24.04 LTS Benchmark PDF (free with registration) and a reading pass; no compute. |
| Cockpit version floor unexplained | Cite the release that introduced the needed feature, or drop the floor | Cockpit release notes; no compute. |
| Private citations | Publish redacted excerpts of the build record (or a screenshot) in the repo | Owner decision on what can be public. |
| Levels 2 and 3 not started | DNS, reverse proxy, VM templates, NAS with a timed restore; restore and rollback drills with timings | The R610 powered on for several sessions, a second machine or VM as restore target, and a stopwatch-quality timing method written before the drill. |

No number on the dashboard comes from these open items; they are listed as not started.
