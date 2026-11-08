// Known-answer and parity check, run by "npm run build" (and on its own: node src/checker.check.mjs).
// 1. The JS checker and the Python checker must agree, flag for flag and detail for detail,
//    on the recorded snapshot and on every mutation preset.
// 2. Every preset must match its Python test: same mutation literal, same expected failing check.
// 3. Storage, firewall and subnet helpers must reproduce values the repo itself states.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parsePolicy, runChecks, MUTATIONS, mutate, pythonExpectations, countTests, poolTotal, evaluateFirewall, networkOf } from './checker.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');
const pySrc = read('level-1-learn/baseline_check.py');
const testSrc = read('tests/test_learn_baseline.py');
const snap = JSON.parse(read('level-1-learn/evidence/r610-snapshot-2026-10-26.json'));
const policy = parsePolicy(pySrc);

// Python is the reference implementation: run it on exactly the snapshots the JS side sees.
// Edge cases that sit just past each numeric threshold, plus an empty snapshot for the defaults.
const edge = (label, fn) => { const s = structuredClone(snap); fn(s); return [label, s]; };
const pvs = snap.storage.pool.physical_volumes;
const cases = [['recorded snapshot', snap], ...MUTATIONS.map((m) => [m.test, mutate(snap, m)]),
  edge('three PVs just under the pool threshold', (s) => { s.storage.pool.physical_volumes[2].size_gb -= poolTotal(pvs) - policy.minTotalGb + 0.01; }),
  edge('three PVs exactly at the pool threshold', (s) => { s.storage.pool.physical_volumes[2].size_gb -= Math.round((poolTotal(pvs) - policy.minTotalGb) * 100) / 100; }),
  edge('Cockpit one version below the floor', (s) => { s.cockpit.version = policy.minCockpit - 1; }),
  edge('firewall inactive', (s) => { s.firewall.active = false; }),
  edge('owner-approved extra ports', (s) => { s.firewall.allowed_from_lan.push({ port: 3389, source: '192.168.1.0/24' }, { port: 9001, source: '192.168.1.0/24' }, { port: 9001, source: 'Anywhere', interface: 'tailscale0' }); }),
  edge('unapproved LAN port', (s) => { s.firewall.allowed_from_lan.push({ port: 8080, source: '192.168.1.0/24' }); }),
  edge('tailnet rule on an unapproved port', (s) => { s.firewall.allowed_from_lan.push({ port: 22, source: 'Anywhere', interface: 'tailscale0' }); }),
  edge('SSH rule missing', (s) => { s.firewall.allowed_from_lan = s.firewall.allowed_from_lan.filter((r) => r.port !== 22); }),
  ['live capture 2026-11-07', JSON.parse(read('level-1-learn/evidence/r610-snapshot-2026-11-07-live.json'))],
  ['live capture 2026-11-08', JSON.parse(read('level-1-learn/evidence/r610-snapshot-2026-11-08-live.json'))],
  ['empty snapshot', {}]];
const py = JSON.parse(execFileSync('python3', ['-I', '-c',
  'import json,sys; sys.path.insert(0, sys.argv[1]); from baseline_check import run_checks; '
  + 'print(json.dumps([run_checks(s) for s in json.load(sys.stdin)]))', root + 'level-1-learn'],
{ input: JSON.stringify(cases.map((c) => c[1])) }));

cases.forEach(([name, s], i) => assert.deepEqual(runChecks(s, policy), py[i], `JS and Python checkers disagree on ${name}`));

const base = runChecks(snap, policy);
assert.equal(base.total, 10);
assert.equal(base.passed, 10);

const expectations = pythonExpectations(testSrc);
assert.deepEqual(expectations.test_recorded_snapshot_passes_all_checks.expected, []);
for (const m of MUTATIONS) {
  const t = expectations[m.test];
  assert.ok(t, `no Python test named ${m.test}`);
  assert.ok(t.body.includes(m.literal), `${m.test}: preset literal ${m.literal} not found in the Python test`);
  assert.deepEqual(t.expected, [m.expected], `${m.test}: Python expects ${t.expected}`);
  assert.deepEqual(runChecks(mutate(snap, m), policy).results.filter((r) => !r.pass).map((r) => r.check), [m.expected]);
}
// Every check now has a failing-case preset.
assert.deepEqual([...new Set(MUTATIONS.map((m) => m.expected))].sort(), [...policy.checkNames].sort());

// Storage: the documented sum in the Python test.
const documented = Number(testSrc.match(/assertAlmostEqual\(total, ([\d.]+)/)[1]);
assert.equal(poolTotal(snap.storage.pool.physical_volumes), documented);
assert.ok(documented >= policy.minTotalGb);

// Network: the primary interface's subnet is the firewall's LAN source.
assert.equal(networkOf(snap.network.primary_interface.address), policy.sources[0]);
assert.equal(networkOf(snap.network.labnet.host_address), snap.network.labnet.subnet);

// Firewall model on the recorded rules (README: only 22 and 9090, only from 192.168.1.0/24).
const fw = snap.firewall;
const lanHost = networkOf(snap.network.primary_interface.address).replace(/0\/\d+$/, '20');
for (const p of policy.ports) assert.equal(evaluateFirewall(fw, lanHost, p).verdict, 'ALLOW');
assert.equal(evaluateFirewall(fw, lanHost, 3389).verdict, 'DENY');
assert.equal(evaluateFirewall(fw, '10.99.0.5', 22).verdict, 'DENY');
assert.equal(evaluateFirewall(fw, '8.8.8.8', 9090).verdict, 'DENY');
assert.equal(evaluateFirewall(fw, '192.168.2.1', 22).verdict, 'DENY');
assert.equal(evaluateFirewall(fw, '192.168.1.255', 22).verdict, 'ALLOW');
assert.equal(evaluateFirewall(fw, '300.1.1.1', 22).verdict, null);

console.log('checker parity ok', { cases: cases.length, unitTests: countTests(testSrc), poolGb: documented });
