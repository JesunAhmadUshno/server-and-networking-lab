# 0002: Cut the recovery plan from seven tests to three

Date: 2026-11-08. Status: accepted. Decided by: Jesun Ahmad Ushno.

## Context

The first draft of PROPOSAL.md had seven hypotheses plus build items
(DNS names, a reverse proxy, a NAS share, a rack-build chapter). Three
independent reviewers (Skeptic, Pragmatist, Critic), given only the repo
files, agreed that four tests could not be run honestly by one operator
on one host, or did not test the question: a second-operator runbook
test, a VM snapshot rebuild, a network rollback, and a full monitoring
stack. They also agreed the build items did not feed the question.

## Decision

Keep three tests: nightly hashed backup with an off-server copy (H1),
configuration restore (H2), and single-disk loss (H3). Monitoring is
reduced to a scheduled checker run that alerts on failure, as build
work. DNS, the reverse proxy, the NAS share and the rack chapter are
out of scope.

## Consequences

The plan is smaller and every test is runnable solo. H1 addresses the
one risk the baseline found: no redundancy and a single backup. The cut
items can return as a later proposal with its own tag.
