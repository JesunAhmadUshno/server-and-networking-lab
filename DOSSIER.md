# DOSSIER: server-and-networking-lab (P23) v1, 2026-11-04

Written under the documentation and publishing standard (past, present, future). Updated at ship time.

## Past

Prior art for this project is named in NOVELTY.md (homelab write-ups and vendor server docs). The history of the problem, the key papers and systems, and what was tried before are recorded in the Roadmap v2 section text in SPEC.md and will be expanded with dated sources at the project's wave, before Build opens.

## Present

Current demand evidence: hiring value scored in the fleet pass (new candidates P23 to P29: see the decision pack Sections 4 and 5) [confirmed, fleet and scoring pass 2026-11-04; for P23 to P29, the decision pack 2026-11-04]. The Round 3 research (2026-11-04) found the market centre at post-training, evals, environments, and inference depth [confirmed as the research finding; the report is at ~/workspace/research_notes/roadmap-v3-revaluation-research-20261104-0949/report.md]. Tools and versions are pinned at Build time, not in this v1.

Update 2026-11-04, Learn evidence capture opened and Learn closed: the admin baseline now exists as a runnable checker (level-1-learn/baseline_check.py) with a recorded R610 snapshot (level-1-learn/evidence/r610-snapshot-2026-10-26.json, transcribed from the live-verified 2026-10-26 build record, TECHNICAL-DOCUMENTATION.md in the R610 Ubuntu install goal) and a read-only capture script (level-1-learn/capture_snapshot.sh) for fresh captures in a planned power-on window. Checker result on the recorded snapshot: 10 of 10 checks passed. A live re-capture on 2026-11-04 was attempted and could not reach the server (fleet SSH host-key verification failed and was not bypassed; direct probes are blocked from the Muse VM), so no 2026-11-04 live state is claimed here.

## Future

Open problems and the project's next steps sit in the Deep level scope in SPEC.md. Any forecast about this field is [unverified] unless a dated primary source is added here at the wave update.
