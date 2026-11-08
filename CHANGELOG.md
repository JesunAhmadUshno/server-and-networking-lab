# Changelog

All notable changes to this project. Format: Keep a Changelog 1.1.
Versions follow Semantic Versioning; no release is tagged yet.

## [Unreleased]

### Changed
- 2026-11-08: Independent review applied. The backup check compares the
  hash with the recorded value (it only checked the length before).
  The capture script records listening sockets and the top five error
  sources, and publishes the kernel as major.minor (decision 0003).
  PROPOSAL.md is cut to three tests, with prior work cited (decision
  0002). REPORT.md now leads with the current state.
- 2026-11-08: Restructured to the portfolio standard v2: README is the
  abstract; PROPOSAL.md (draft) replaces SPEC.md, NOVELTY.md and
  DOSSIER.md; REPORT.md replaces the Learn README; code in src/,
  evidence in experiments/snapshots/, scores in results/. The Build and
  Deep scaffolds are folded into PROPOSAL.md. CI runs on Python 3.11
  and 3.12 and re-scores the evidence; CodeQL and Dependabot added.

### Added
- 2026-11-08: Live re-capture with the fixed capture script; all five
  firewall rules recorded; 10 of 10.
- 2026-11-07: Firewall check moved to an approved list (decision 0001);
  four tests pin it.
- 2026-11-07: First live capture: 9 of 10, firewall drift found
  (3389 xrdp and 9001 Penpot).
- 2026-11-07: Capture script reads every field the checker needs,
  including interface-scoped firewall rules.
- 2026-11-07: Mutation tests for every check; live dashboard on Pages
  with a JavaScript port held to the Python checker by a parity test.
- 2026-11-04: Baseline checker (10 checks), recorded R610 snapshot
  (2026-10-26), read-only capture script.
