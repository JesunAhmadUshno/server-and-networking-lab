# server-and-networking-lab

Linux systems administration and networking proven on a real enterprise server: the Dell R610 base, its network plan, NAS and storage, backup and restore drills, and the rack build documented as a chapter.

Status: Level 1, Learn DONE 2026-11-04 (ROADMAP-V3-BATCH loop cycle). Levels 2 and 3 are scaffold only. Project: P23. Fleet node: Dell R610. Wave: Waves 1 to 2.

## Start here

1. Read SPEC.md for scope and acceptance criteria.
2. Read DOSSIER.md for the past, present, and future of this problem (v1).
3. Read NOVELTY.md for the proposed novelty (DRAFT, pending the Jev claim_check gate).
4. Start at level-1-learn/README.md, then level-2-build, then level-3-deep.

## Level map

- Level 1, Learn: the core idea, built small and clean, with a teaching path.
- Level 2, Build: a real working system other people can run.
- Level 3, Deep: benchmarks, optimization, evaluation, hard cases.

## Benchmarks

Level 1, Learn result (checker run 2026-11-04 on the Muse VM against the recorded R610 snapshot dated 2026-10-26; full record in level-1-learn/README.md):

| Test | Result |
| --- | --- |
| Admin baseline checker, 10 checks on the recorded snapshot | 10 of 10 passed: Ubuntu 24.04.5, key-only SSH, static 192.168.1.50/24, LAN-only firewall (22, 9090), labvg pool 1531.87 GB from 3 PVs, Cockpit 314 on 9090, isolated labnet 10.99.0.0/24, services and logs, automatic security updates, verified config backup |
| Unit tests | 9 tests pass, including 6 mutation tests where a broken snapshot fails exactly the check it breaks |

Evidence honesty: the snapshot is the verified 2026-10-26 build record, not a live 2026-11-04 capture. A live re-capture is the named open item for the next P23 cycle; see the Learn README limits.

Build and Deep have no results yet. Their tables fill only with measured numbers, with method.

## Novelty

PROPOSED. See NOVELTY.md. The novelty text is a draft until the Jev claim_check gate passes on it.

## License

Code: Apache-2.0 (see LICENSE). Tutorials: CC BY 4.0. Ruled in D-V3-11, 2026-11-04.
