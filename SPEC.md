# SPEC: server-and-networking-lab (P23)

Phase skill: spec-driven-development (house engineering pipeline).
Status: Wave 0 scaffold spec, from Roadmap v2 text and the v3 decision pack. Scope and acceptance criteria below are the v2 section text, kept as the source of truth until the project's wave opens its own spec pass.

Fleet node: Dell R610. Wave: Waves 1 to 2.
Hiring evidence: scored in the fleet pass (new candidates P23 to P29: see the decision pack Sections 4 and 5) [confirmed, fleet and scoring pass 2026-11-04, or the decision pack for P23 to P29].

## Project section text (Roadmap v2, or the v3 candidate text for P23 to P29)

Subject: Linux systems administration and networking, proven on the Dell R610 built in October 2026 (Ubuntu 24.04.5, static IP plan, Cockpit dashboard, 1.50 TB labvg storage pool, isolated labnet 10.99.0.0/24, SSH key-only) [confirmed, build record in the fleet pass Section 6.1].
- Learn: the admin baseline as a teachable path: users and keys, systemd services, logs, storage, the Cockpit view.
- Build: the network layer end to end: static IP plan, DNS for lab names, a reverse proxy in front of fleet services, KVM/libvirt VM templates, and a NAS and storage track (shares, permissions, a timed restore proof).
- Deep: the drills: a backup and restore drill with a proven timed restore, a VM rebuilt from snapshot, a network change with a written rollback executed once, a full architecture document (network map, service list, failure modes), and the rack build documented as a chapter.

## Acceptance criteria (scaffold level)

- Learn closes when the level-1-learn code runs, its README teaches the idea, and a fresh-eyes reader can follow it.
- Build closes when the system runs end to end, tests pass, and one benchmark or result table with method is in the README.
- Deep closes when the Deep scope in the section text is done, the failure modes are written, and the dossier is updated to ship state.
- No level closes on a claim. Evidence only: code, tests, numbers, links.
