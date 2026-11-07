# DOSSIER: server-and-networking-lab (P23) v1, 2026-11-04

Written under the documentation and publishing standard (past, present, future). Updated at ship time.

## Past

Prior art for this project is named in NOVELTY.md (homelab write-ups and vendor server docs). The history of the problem, the key papers and systems, and what was tried before are recorded in the Roadmap v2 section text in SPEC.md and will be expanded with dated sources at the project's wave, before Build opens.

Related work (added 2026-11-07; names and roles only, no comparisons measured):

- CIS Benchmarks (Center for Internet Security): published, consensus hardening guides per operating system, with numbered recommendations. They are the usual reference for what a Linux baseline should contain.
- OpenSCAP / SCAP: the NIST Security Content Automation Protocol and its open-source scanner, which evaluates a host against machine-readable profiles (for example CIS or DISA STIG content) and writes a report.
- Lynis: an open-source security auditing script for Unix-like systems that runs many host checks and prints findings and hardening suggestions.
- Chef InSpec: a compliance-as-code framework where controls are written as tests and run against a local or remote host.
- Goss and Testinfra: server validation tools (YAML specs for Goss, pytest-based tests for Testinfra) that assert a host's packages, services, ports and files are in the expected state.

Where this repo sits: baseline_check.py is much narrower than any of these. It is a host-specific spec check for one machine (the R610), run on a recorded JSON snapshot rather than on the live host, with 10 checks whose expected values are written into the code. It does not map to CIS control IDs and makes no coverage claim against these tools. Its value is teaching: each check is small enough to read, and each has a mutation test proving it can fail.

## Present

Current demand evidence: hiring value scored in the fleet pass (new candidates P23 to P29: see the decision pack Sections 4 and 5) [confirmed, fleet and scoring pass 2026-11-04; for P23 to P29, the decision pack 2026-11-04]. The Round 3 research (2026-11-04) found the market centre at post-training, evals, environments, and inference depth [confirmed as the research finding; the report is at ~/workspace/research_notes/roadmap-v3-revaluation-research-20261104-0949/report.md]. Tools and versions are pinned at Build time, not in this v1.

Update 2026-11-04, Learn evidence capture opened and Learn closed: the admin baseline now exists as a runnable checker (level-1-learn/baseline_check.py) with a recorded R610 snapshot (level-1-learn/evidence/r610-snapshot-2026-10-26.json, transcribed from the live-verified 2026-10-26 build record, TECHNICAL-DOCUMENTATION.md in the R610 Ubuntu install goal) and a read-only capture script (level-1-learn/capture_snapshot.sh) for fresh captures in a planned power-on window. Checker result on the recorded snapshot: 10 of 10 checks passed. A live re-capture on 2026-11-04 was attempted and could not reach the server (fleet SSH host-key verification failed and was not bypassed; direct probes are blocked from the Muse VM), so no 2026-11-04 live state is claimed here.

## Future

Open problems and the project's next steps sit in the Deep level scope in SPEC.md. Any forecast about this field is [unverified] unless a dated primary source is added here at the wave update.
