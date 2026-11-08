import { useMemo, useState, useEffect, useId } from 'react';
import snapshot from '../../experiments/snapshots/r610-snapshot-2026-10-26.json';
import live from '../../experiments/snapshots/r610-snapshot-2026-11-08-live.json';
import pySrc from '../../src/baseline_check.py?raw';
import testSrc from '../../tests/test_baseline.py?raw';
import readme from '../../README.md?raw';
import report from '../../REPORT.md?raw';
import { parsePolicy, runChecks, formatRow, MUTATIONS, mutate, pythonExpectations, countTests, poolTotal, evaluateFirewall, networkOf } from './checker.js';

const REPO = 'https://github.com/JesunAhmadUshno/server-and-networking-lab';
const blob = (p) => `${REPO}/blob/main/${p}`;
const SNAP_PATH = 'experiments/snapshots/r610-snapshot-2026-10-26.json';

// ---- everything below is derived from repo files at build time ----
const policy = parsePolicy(pySrc);
const base = runChecks(snapshot, policy);
const liveRun = runChecks(live, policy);
const LIVE_PATH = 'experiments/snapshots/r610-snapshot-2026-11-08-live.json';
const meta = snapshot.snapshot_meta;
const machineName = meta.machine.split(',')[0].trim();
const machineShort = machineName.split(' ').pop();
const hostname = (meta.machine.match(/hostname (\S+)/) || [])[1];
const pvs = snapshot.storage.pool.physical_volumes;
const poolGb = poolTotal(pvs);
const testCount = countTests(testSrc);
const expectations = pythonExpectations(testSrc);
const mutationTests = Object.values(expectations).filter((t) => t.expected?.length).length;
const honesty = (readme.match(/^Evidence honesty:.*$/m) || [''])[0];
const stages = [...readme.matchAll(/^- (\w+): ([A-Z]+)(?: (\d{4}-\d{2}-\d{2}))?$/gm)].map((m) => m.slice(1));
const verdict = (readme.match(/^\*\*Verdict\.\*\* ([^.]+)/m) || [])[1];
const stepTitles = [...report.matchAll(/^(\d)\. ([^.]+)\./gm)].map((m) => m[2]);
const daysOld = Math.floor((Date.now() - Date.parse(`${meta.evidence_date}T00:00:00Z`)) / 86400000);
const byName = Object.fromEntries(base.results.map((r) => [r.check, r]));
const preset = (test) => MUTATIONS.find((m) => m.test.startsWith(test));

const SECTIONS = [['top', 'Overview', '◎'], ['checker', 'Checker', '✓'], ['mutations', 'Mutation lab', '⚑'], ['storage', 'Storage', '▤'], ['network', 'Firewall', '⇄'], ['path', 'Teachable path', '☰'], ['roadmap', 'Roadmap', '◷'], ['limits', 'Limits', '!']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">Server &amp; Networking Lab</a>
      <a className="m" href={blob('PROPOSAL.md')}>Proposal</a>
      <a className="m" href={blob('REPORT.md')}>Report</a>
      <a className="m" href={blob('CHANGELOG.md')}>Changelog</a>
      <span className="spacer" />
      <span className="status"><i /> {verdict}</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <Checker />
      <Mutations />
      <Storage />
      <Network />
      <Path />
      <Roadmap />
      <Limits />
      <Dock />
      <footer>
        Code: Apache-2.0. Every number on this page is read from <code>src/</code>, <code>experiments/</code>, <code>tests/</code> and the docs at build time; the checker, the mutation lab, the storage calculator and the firewall model run in your browser.
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <header className="card hero window" id="top" data-title={`${hostname} - baseline.report`}>
      <div className="head">
        <p className="eyebrow">Baseline · recorded and live snapshots</p>
        <span className={`pill ${base.failed ? 'bad' : 'good'}`}>● {base.passed} of {base.total} pass</span>
      </div>
      <h1>A server you can trust is a short list of <em>checkable</em> facts: {base.passed} of {base.total} baseline checks pass on the recorded {machineShort} snapshot.</h1>
      <p className="recorded" role="note">
        <b>Recorded snapshot {meta.evidence_date}, transcribed from the build record, not a live capture.</b>
        <span>Source, as the snapshot states it: “{meta.source}”</span>
      </p>
      <p className="sub">
        The admin baseline for a {machineName} becomes ten named checks: who can log in and how, which services run, how storage is pooled, which network the machine sits on and what the firewall lets in.
        Each check prints the value it actually saw, so you can audit the verdict instead of trusting it. Below, the same checker runs in your browser, and you can break the snapshot to watch exactly one check fail.
      </p>
      <div className="recorded" role="note">
        <b>Live capture {live.snapshot_meta.evidence_date}: {liveRun.passed} of {liveRun.total} pass on the running {live.snapshot_meta.hostname}.</b>
        <span>Captured on the server by capture_snapshot.sh. It found two firewall rules added after the recorded baseline, xrdp remote desktop (3389) and the Penpot design server (9001); the Owner approved both on 2026-11-07 and they are now on the baseline's approved list. This 2026-11-08 re-capture, with the fixed script, also records the Penpot rule on the Tailscale interface, and it is approved too.</span>
        <Terminal summary={{ ...liveRun, results: liveRun.results.filter((r) => !r.pass || r.check === 'firewall_lan_only') }} label="Firewall check on the live capture" path={LIVE_PATH} />
      </div>
      <div className="actions">
        <a className="btn primary" href="#checker">Run the checker</a>
        <a className="btn ghost" href="#mutations">Break the snapshot</a>
        <span className="hint">Or locally: <code>python3 src/run_check.py</code></span>
      </div>
      <div className="tiles three">
        <div className="tile"><div className="num">{base.passed}/{base.total}</div><div className="cap">Baseline checks passed on the recorded snapshot</div></div>
        <div className="tile"><div className="num">{meta.evidence_date}</div><div className="cap">Evidence date: {daysOld} days before today, not a fresh capture</div></div>
        <div className="tile"><div className="num">{machineShort}</div><div className="cap">{machineName}, hostname {hostname}</div></div>
        <div className="tile"><div className="num">{snapshot.os.version_id}</div><div className="cap">{snapshot.os.id[0].toUpperCase() + snapshot.os.id.slice(1)}, kernel {snapshot.os.kernel}</div></div>
        <div className="tile"><div className="num">{poolGb.toFixed(2)} GB</div><div className="cap">{snapshot.storage.pool.name} pool from {pvs.length} physical volumes</div></div>
        <div className="tile"><div className="num">{testCount}</div><div className="cap">Unit tests, {mutationTests} of them mutation tests (counted from the test file)</div></div>
      </div>
    </header>
  );
}

function Terminal({ summary, label, path = SNAP_PATH }) {
  return (
    <pre className="term" aria-label={label} tabIndex={0}>
      <span className="dim">$ python3 src/run_check.py</span>{'\n'}
      Snapshot: {path}{'\n'}
      {summary.results.map((r) => <span key={r.check} className={r.pass ? 'p' : 'f'}>{formatRow(r)}{'\n'}</span>)}
      <b>Result: {summary.passed} of {summary.total} checks passed</b>
    </pre>
  );
}

function Checker() {
  const pretty = useMemo(() => JSON.stringify(snapshot, null, 2), []);
  const [text, setText] = useState(pretty);
  const parsed = useMemo(() => { try { return { snap: JSON.parse(text) }; } catch (e) { return { error: e.message }; } }, [text]);
  const summary = parsed.snap && typeof parsed.snap === 'object' ? runChecks(parsed.snap, policy) : null;
  return (
    <section id="checker" className="card window reveal" data-title="baseline_check.py">
      <div className="head">
        <div>
          <p className="eyebrow">Runs in your browser</p>
          <h2>The checker, ported line for line, runs <em>live</em> on the snapshot.</h2>
          <p className="sub">
            This is a JavaScript port of <a href={blob('src/baseline_check.py')}>baseline_check.py</a>. It reads its expected values (interface, address, ports, thresholds) out of the Python source,
            and the build fails unless it gives the same pass flag and the same detail string as the Python checker on {MUTATIONS.length + 1} snapshots plus threshold edge cases.
            Edit the JSON and the output updates as you type.
          </p>
        </div>
        {summary && <span className={`pill ${summary.failed ? 'bad' : 'good'}`}>{summary.passed} of {summary.total} pass</span>}
      </div>
      {summary ? <Terminal summary={summary} label="Checker output" /> : <p className="pill bad" role="alert">Not valid JSON: {parsed.error}</p>}
      <p className="hint">Same format as <code>run_check.py</code>: verdict, check name, then the value the check saw.</p>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="snap-json">Snapshot JSON, editable <span>{text === pretty ? 'recorded, unedited' : 'edited'}</span></label>
        <textarea id="snap-json" className="json" spellCheck="false" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={() => setText(pretty)} disabled={text === pretty}>Reset to the recorded snapshot</button>
          <span className="hint">Try <span className="mono">"journal_check": "skipped"</span> or delete a whole block.</span>
        </div>
      </div>
    </section>
  );
}

const alt = (test, read) => read(mutate(snapshot, preset(test)));

function Mutations() {
  const [snap, setSnap] = useState(snapshot);
  const [active, setActive] = useState(null);
  const summary = runChecks(snap, policy);
  const failing = summary.results.filter((r) => !r.pass).map((r) => r.check);
  const edit = (fn) => { const s = structuredClone(snap); fn(s); setSnap(s); setActive(null); };
  const pick = (m) => { setSnap(mutate(snapshot, m)); setActive(m); };
  const extra = preset('test_open_firewall').apply.bind(null);
  const extraRule = alt('test_open_firewall', (s) => s.firewall.allowed_from_lan.at(-1));
  const hasExtra = snap.firewall.allowed_from_lan.some((r) => r.port === extraRule.port && r.source === extraRule.source);
  const present = new Set(snap.storage.pool.physical_volumes.map((p) => p.device));
  const libvirtd = snap.services.find((x) => x.name === 'libvirtd');
  const ok = active && failing.length === 1 && failing[0] === active.expected;
  return (
    <section id="mutations" className="card window reveal" data-title="test_learn_baseline.py">
      <p className="eyebrow">Mutation lab</p>
      <h2>A checker that passes everything proves nothing, so <em>break</em> it on purpose.</h2>
      <p className="sub">
        Each preset is one mutation test from <a href={blob('tests/test_learn_baseline.py')}>tests/test_learn_baseline.py</a>: it changes one fact in a copy of the snapshot, and exactly one check must fail.
        The build checks that every preset uses the same change and expects the same failing check as its Python test. Or flip the switches yourself and combine faults.
      </p>
      <div className="presets" role="group" aria-label="Mutation test presets">
        {MUTATIONS.map((m) => (
          <button key={m.test} aria-pressed={active === m} onClick={() => pick(m)} title={m.test}>
            <b>{m.label}</b><small>expects {m.expected}</small>
          </button>
        ))}
      </div>
      <div className="controls toggles">
        <div className="field"><label htmlFor="m-pass">SSH password login</label>
          <select id="m-pass" value={snap.ssh.password_authentication} onChange={(e) => edit((s) => { s.ssh.password_authentication = e.target.value; })}>
            {[snapshot.ssh.password_authentication, alt('test_password_auth', (s) => s.ssh.password_authentication)].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
        <div className="field"><label htmlFor="m-fwd">labnet forward mode</label>
          <select id="m-fwd" value={snap.network.labnet.forward} onChange={(e) => edit((s) => { s.network.labnet.forward = e.target.value; })}>
            {[snapshot.network.labnet.forward, alt('test_labnet', (s) => s.network.labnet.forward)].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
        <div className="field"><label htmlFor="m-os">Ubuntu version_id</label>
          <select id="m-os" value={snap.os.version_id} onChange={(e) => edit((s) => { s.os.version_id = e.target.value; })}>
            {[snapshot.os.version_id, alt('test_old_ubuntu', (s) => s.os.version_id)].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
        <div className="field"><label htmlFor="m-ip">{snapshot.network.primary_interface.name} address</label>
          <input id="m-ip" type="text" value={snap.network.primary_interface.address} onChange={(e) => edit((s) => { s.network.primary_interface.address = e.target.value; })} /></div>
        <div className="field"><label htmlFor="m-svc">libvirtd state</label>
          <select id="m-svc" value={libvirtd.state} onChange={(e) => edit((s) => { s.services.find((x) => x.name === 'libvirtd').state = e.target.value; })}>
            {[snapshot.services.find((x) => x.name === 'libvirtd').state, alt('test_inactive_libvirtd', (s) => s.services.find((x) => x.name === 'libvirtd').state)].map((v) => <option key={v} value={v}>{v}</option>)}
          </select></div>
      </div>
      <div className="checks-row">
        {pvs.map((pv) => (
          <Check key={pv.device} label={`PV ${pv.device} (${pv.size_gb} GB)`} checked={present.has(pv.device)}
            onChange={(on) => edit((s) => { s.storage.pool.physical_volumes = pvs.filter((p) => (p.device === pv.device ? on : present.has(p.device))).map((p) => ({ ...p })); })} />
        ))}
        <Check label={`Extra rule: ${extraRule.port} from ${extraRule.source}`} checked={hasExtra}
          onChange={(on) => edit((s) => { if (on) extra(s); else s.firewall.allowed_from_lan = s.firewall.allowed_from_lan.filter((r) => !(r.port === extraRule.port && r.source === extraRule.source)); })} />
        <Check label="Backup SHA256 intact" checked={snap.backup.sha256 === snapshot.backup.sha256}
          onChange={(on) => edit((s) => { s.backup.sha256 = on ? snapshot.backup.sha256 : alt('test_bad_backup', (x) => x.backup.sha256); })} />
        <Check label="Cockpit machines plugin" checked={snap.cockpit.machines_plugin === true} onChange={(on) => edit((s) => { s.cockpit.machines_plugin = on; })} />
        <Check label="Automatic security updates" checked={snap.updates.automatic_security_updates === true} onChange={(on) => edit((s) => { s.updates.automatic_security_updates = on; })} />
      </div>
      <div className="verdict-bar" aria-live="polite">
        {active
          ? <><span className={`pill ${ok ? 'good' : 'bad'}`}>{ok ? '✓ Exactly one check fails, as the test expects' : '✕ Unexpected result'}</span><span className="hint">Expected failing: <b className="mono">{active.expected}</b> · Python test <span className="mono">{active.test}</span></span></>
          : <><span className={`pill ${failing.length ? 'warn' : 'good'}`}>{failing.length ? `${failing.length} of ${summary.total} checks failing` : `All ${summary.total} checks pass`}</span><span className="hint">{snap === snapshot ? 'Recorded snapshot, unchanged.' : 'Free edits: combine faults to see each one land on its own check.'}</span></>}
        <button className="btn ghost" onClick={() => { setSnap(snapshot); setActive(null); }} disabled={snap === snapshot}>Reset</button>
      </div>
      <ul className="chips">
        {summary.results.map((r) => (
          <li key={r.check} className={r.pass ? 'p' : 'f'}><span className="mark" aria-hidden="true">{r.pass ? '✓' : '✕'}</span><b className="mono">{r.check}</b><span className="sr">{r.pass ? 'passes' : 'fails'}</span><small>{r.detail}</small></li>
        ))}
      </ul>
    </section>
  );
}

function Check({ label, checked, onChange }) {
  const id = useId();
  return <label className="check" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

const smallest = pvs.reduce((a, b) => (b.size_gb < a.size_gb ? b : a));
const below = pvs.filter((pv) => poolGb - pv.size_gb < policy.minTotalGb);
const storageNote = below.length === pvs.length
  ? `Removing any one disk breaks both rules: the pool clears the threshold by only ${(poolGb - policy.minTotalGb).toFixed(2)} GB, less than its smallest disk (${smallest.device}, ${smallest.size_gb} GB).`
  : `Removing any one disk breaks the count rule; only removing ${below.map((pv) => pv.device).join(' or ') || 'none of them'} also drops the total under the threshold.`;

const PV_COLORS = ['var(--primary)', 'var(--good)', 'var(--warn)', 'var(--bad)'];

function Storage() {
  const [on, setOn] = useState(() => pvs.map(() => true));
  const kept = pvs.filter((_, i) => on[i]);
  const total = poolTotal(kept);
  const s = structuredClone(snapshot); s.storage.pool.physical_volumes = kept;
  const res = runChecks(s, policy).results.find((r) => r.check === 'storage_pool_labvg');
  const W = 960, H = 150, l = 16, r = 16, scaleMax = Math.max(poolGb, policy.minTotalGb) * 1.08;
  const x = (gb) => l + (gb / scaleMax) * (W - l - r);
  let acc = 0;
  return (
    <section id="storage" className="card window reveal" data-title={`vgs ${snapshot.storage.pool.name}`}>
      <div className="head">
        <div>
          <p className="eyebrow">Storage calculator</p>
          <h2>Three disks, one pool, and a <em>threshold</em> it clears by {(poolGb - policy.minTotalGb).toFixed(2)} GB.</h2>
          <p className="sub">
            The volume group {snapshot.storage.pool.name} is the sum of its physical volumes. The checker wants exactly {policy.pvCount} of them and at least {policy.minTotalGb} GB in total (read from baseline_check.py).
            Switch disks off to see when <span className="mono">storage_pool_labvg</span> flips, and which rule trips first.
          </p>
        </div>
        <span className={`pill ${res.pass ? 'good' : 'bad'}`}>storage_pool_labvg {res.pass ? 'PASS' : 'FAIL'}</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Stacked bar of physical volume sizes in ${snapshot.storage.pool.name}: ${total.toFixed(2)} GB against a ${policy.minTotalGb} GB threshold`}>
        {[0, 250, 500, 750, 1000, 1250, 1500].filter((t) => t <= scaleMax).map((t) => <g key={t}><line className="axis" x1={x(t)} x2={x(t)} y1={30} y2={100} /><text x={x(t)} y={120} textAnchor="middle">{t}</text></g>)}
        <rect x={x(0)} y={42} width={x(poolGb) - x(0)} height={46} rx="8" fill="none" stroke="var(--grid)" strokeDasharray="4 4" />
        {pvs.map((pv, i) => {
          if (!on[i]) return null;
          const x0 = x(acc); acc += pv.size_gb;
          return (
            <g key={pv.device}>
              <rect x={x0} y={42} width={x(acc) - x0} height={46} fill={PV_COLORS[i % 4]} opacity="0.85" stroke="var(--surface-strong)" strokeWidth="2" />
              {x(acc) - x0 > 70 && <text x={(x0 + x(acc)) / 2} y={70} textAnchor="middle" style={{ fill: '#fff', fontWeight: 700 }}>{pv.device} {pv.size_gb}</text>}
            </g>
          );
        })}
        <line x1={x(policy.minTotalGb)} x2={x(policy.minTotalGb)} y1={22} y2={104} stroke="var(--text)" strokeWidth="2" strokeDasharray="5 3" />
        <text x={x(policy.minTotalGb)} y={16} textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 600 }}>threshold {policy.minTotalGb} GB</text>
        <text x={W - r} y={H - 8} textAnchor="end">total {total.toFixed(2)} GB of {poolGb.toFixed(2)} recorded</text>
      </svg>
      <div className="grid2" style={{ marginTop: 16, alignItems: 'start' }}>
        <div className="checks-row" style={{ margin: '8px 0 0' }}>
          {pvs.map((pv, i) => <Check key={pv.device} label={`${pv.device}: ${pv.size_gb} GB`} checked={on[i]} onChange={(v) => setOn(on.map((o, j) => (j === i ? v : o)))} />)}
        </div>
        <table>
          <thead><tr><th>Rule in the checker</th><th>Now</th><th>Holds?</th></tr></thead>
          <tbody>
            <tr><td>pool name is {policy.pool}</td><td className="mono">{snapshot.storage.pool.name}</td><td className="ok">yes</td></tr>
            <tr><td>exactly {policy.pvCount} PVs</td><td>{kept.length}</td><td className={kept.length === policy.pvCount ? 'ok' : 'no'}>{kept.length === policy.pvCount ? 'yes' : 'no'}</td></tr>
            <tr><td>total ≥ {policy.minTotalGb} GB</td><td>{total.toFixed(2)}</td><td className={total >= policy.minTotalGb ? 'ok' : 'no'}>{total >= policy.minTotalGb ? 'yes' : 'no'}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>{storageNote}</p>
    </section>
  );
}

function NetMap() {
  const p = snapshot.network.primary_interface, n = snapshot.network.labnet;
  const lan = networkOf(p.address);
  return (
    <svg className="chart" viewBox="0 0 460 330" role="img" aria-label={`Network map: ${hostname} on ${lan} via ${p.name}, gateway ${p.gateway}, isolated ${n.name} ${n.subnet} with forward ${n.forward}`}>
      <rect x="20" y="16" width="420" height="64" rx="12" fill="var(--primary-pale)" stroke="var(--primary)" strokeOpacity=".35" />
      <text x="36" y="40" style={{ fill: 'var(--text)', fontWeight: 700 }}>LAN {lan}</text>
      <text x="36" y="60">gateway {p.gateway} · firewall allows {snapshot.firewall.allowed_from_lan.map((r) => r.port).join(', ')} from here</text>
      <line x1="230" y1="80" x2="230" y2="128" stroke="var(--primary)" strokeWidth="2.5" />
      <text x="240" y="108">{p.name} {p.address} ({p.mode})</text>
      <rect x="140" y="128" width="180" height="70" rx="12" fill="var(--surface-strong)" stroke="var(--text)" strokeOpacity=".4" />
      <text x="230" y="158" textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 700, fontSize: 14 }}>{hostname}</text>
      <text x="230" y="178" textAnchor="middle">ufw default incoming {snapshot.firewall.default_incoming}</text>
      <line x1="230" y1="198" x2="230" y2="240" stroke="var(--good)" strokeWidth="2.5" />
      <text x="240" y="224">bridge {n.host_address}</text>
      <rect x="20" y="240" width="420" height="72" rx="12" fill="var(--good-bg)" stroke="var(--good)" strokeOpacity=".4" />
      <text x="36" y="266" style={{ fill: 'var(--text)', fontWeight: 700 }}>{n.name} {n.subnet}</text>
      <text x="36" y="288">forward={n.forward} · guests reach each other and nothing beyond</text>
      <path d="M404 240 C 470 200, 470 110, 404 80" fill="none" stroke="var(--bad)" strokeWidth="2" strokeDasharray="5 4" />
      <text x="430" y="166" textAnchor="middle" style={{ fill: 'var(--bad)', fontWeight: 700, fontSize: 15 }}>✕</text>
    </svg>
  );
}

function Network() {
  const fw = snapshot.firewall;
  const lanHost = networkOf(snapshot.network.primary_interface.address).replace(/0\/\d+$/, '20');
  const labGuest = networkOf(snapshot.network.labnet.subnet).replace(/0\/\d+$/, '5');
  const [ip, setIp] = useState(lanHost);
  const [port, setPort] = useState(policy.ports[0]);
  const res = evaluateFirewall(fw, ip, port);
  const examples = [[`LAN laptop → SSH`, lanHost, policy.ports[0]], ['LAN laptop → Cockpit', lanHost, policy.ports[1]], ['LAN laptop → RDP', lanHost, alt('test_open_firewall', (s) => s.firewall.allowed_from_lan.at(-1).port)], ['labnet guest → SSH', labGuest, policy.ports[0]], ['Internet → Cockpit', '203.0.113.7', policy.ports[1]]];
  return (
    <section id="network" className="card window reveal" data-title="ufw status verbose">
      <p className="eyebrow">Network and firewall explorer</p>
      <h2>Two ports, one subnet, and <em>deny</em> for everything else.</h2>
      <p className="sub">
        Type a source address and a port. A small rule evaluator applies the recorded ufw rules: the first allow rule whose port and source CIDR match wins, otherwise the default incoming policy applies.
        <b> This is a model of the recorded rules, not a probe of the real server.</b> It ignores loopback, established connections, IPv6 and rate limits.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <NetMap />
        <div>
          <div className="controls" style={{ gridTemplateColumns: '1fr 120px' }}>
            <div className="field"><label htmlFor="fw-ip">Source IPv4</label><input id="fw-ip" type="text" inputMode="decimal" value={ip} onChange={(e) => setIp(e.target.value)} /></div>
            <div className="field"><label htmlFor="fw-port">Port (tcp)</label><input id="fw-port" type="number" min="1" max="65535" value={port} onChange={(e) => setPort(Math.trunc(+e.target.value))} /></div>
          </div>
          <div className="verdict" aria-live="polite">
            {res.verdict ? <span className={`pill big ${res.verdict === 'ALLOW' ? 'good' : 'bad'}`}>{res.verdict}</span> : <span className="pill warn big">?</span>}
            <span className="hint">{res.reason}</span>
          </div>
          <div className="examples" role="group" aria-label="Example connections">
            {examples.map(([label, a, p]) => <button key={label} className="btn ghost" onClick={() => { setIp(a); setPort(p); }}>{label}</button>)}
          </div>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>To</th><th>Action</th><th>From</th></tr></thead>
            <tbody>
              {fw.allowed_from_lan.map((r) => <tr key={r.port} className={res.rule === r ? 'hit' : ''}><td className="mono">{r.port}/tcp</td><td>ALLOW IN</td><td className="mono">{r.source}</td></tr>)}
              <tr className={res.verdict && !res.rule ? 'hit' : ''}><td className="mono">any</td><td>{fw.default_incoming.toUpperCase()} (default incoming)</td><td className="mono">anywhere</td></tr>
            </tbody>
          </table>
          <p className="hint">Firewall active: {String(fw.active)}. Rules from the <span className="mono">firewall</span> block of the snapshot.</p>
        </div>
      </div>
    </section>
  );
}

const STEP_CHECKS = [['ssh_key_only'], ['services_and_logs'], ['storage_pool_labvg'], ['static_ip_plan', 'labnet_isolated'], ['cockpit_dashboard'], ['firewall_lan_only', 'automatic_security_updates'], ['verified_config_backup']];
const STEP_TEXT = [
  `One admin account, SSH on port ${snapshot.ssh.port} with keys only (password_authentication=${snapshot.ssh.password_authentication}) and the root password locked. Read sshd -T, not just the config file.`,
  `${policy.services.join(', ')} are the services the baseline watches; the journal is the log (journalctl -u ssh, journalctl -b).`,
  `${pvs.map((p) => `${p.device} ${p.size_gb} GB`).join(', ')} form the ${snapshot.storage.pool.name} volume group. Read pvs, vgs, lvs.`,
  `${snapshot.network.primary_interface.name} holds the static ${snapshot.network.primary_interface.address}; ${snapshot.network.labnet.name} ${snapshot.network.labnet.subnet} has no forward element, so guests stay inside it.`,
  `Cockpit ${snapshot.cockpit.version} on port ${snapshot.cockpit.port}, socket-activated, with the machines plugin: one dashboard for metrics, logs, services and VMs.`,
  `ufw active, default ${snapshot.firewall.default_incoming} incoming, only ${snapshot.firewall.allowed_from_lan.map((r) => r.port).join(' and ')} open, only to ${policy.sources.join(', ')}. Automatic security updates on.`,
  `A config backup at ${snapshot.backup.path} with its SHA256 recorded. A backup without a hash is a hope, not a backup.`,
];

function Path() {
  return (
    <section id="path" className="card window reveal" data-title="REPORT.md">
      <p className="eyebrow">The teachable path</p>
      <h2>Seven steps, each one <em>feeding</em> a named check.</h2>
      <p className="sub">The order REPORT.md teaches the baseline in. Every step ends in a check you can run; <span className="mono">os_ubuntu_24_04</span> sits under all of them.</p>
      <ol className="steps" style={{ marginTop: 16 }}>
        {stepTitles.map((t, i) => (
          <li key={t}><span className="n">{i + 1}</span><div>
            <b>{t}</b>
            <div className="hint">{STEP_TEXT[i]}</div>
            <div className="tags">{(STEP_CHECKS[i] || []).map((c) => <span key={c} className={`pill ${byName[c].pass ? 'good' : 'bad'}`}>{byName[c].pass ? '✓' : '✕'} {c}</span>)}</div>
          </div></li>
        ))}
      </ol>
    </section>
  );
}

function Roadmap() {
  const done = stages.filter(([, st]) => st === 'DONE').length;
  return (
    <section id="roadmap" className="card window reveal" data-title="LIFECYCLE">
      <p className="eyebrow">Lifecycle</p>
      <h2>{done} of {stages.length} stages done. Verdict: <em>{verdict}</em>.</h2>
      <p className="sub">Stages and verdict are read from README.md; the plan is PROPOSAL.md. Nothing here is a progress estimate.</p>
      <div className="levels">
        {stages.map(([name, st, date], i) => (
          <div className="tile" key={name}>
            <div className="head" style={{ marginBottom: 6 }}><h3>{i + 1}. {name}</h3><span className={`pill ${st === 'DONE' ? 'good' : 'warn'}`}>{st}{date ? ` ${date}` : ''}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Limits() {
  const limits = [
    ['Evidence date versus today', `The snapshot is dated ${meta.evidence_date}, ${daysOld} days before today. Server state can drift; only a fresh capture proves today.`],
    ['Recovery not measured', 'Passing the baseline says the server is configured as intended. How fast it comes back after a loss is PROPOSAL.md, H1 to H7, not yet run.'],
    ['No redundancy in the pool', 'labvg spans three disks with no mirror, and the only verified backup is one archive from 2026-10-26. Losing one disk loses the pool.'],
    ['Cockpit taught from the record', 'The Cockpit view is described from the build record and its screenshot, not from a live session.'],
    ['Weak check: backup', `verified_config_backup only checks that a backup is marked present and its hash is 64 hex characters long. It never compares the hash with the file.`],
    ['Weak check: journal', `services_and_logs accepts a self-reported string, journal_check == "${policy.journal}".`],
    ['Unexplained floor', `cockpit_dashboard wants version ≥ ${policy.minCockpit}, with no stated reason for that number.`],
    ['One host, not a tool', `The interface (${policy.iface}), address (${policy.address}), approved ports (${policy.approvedPorts.join(', ')}) and subnet are fixed in baseline_check.py. It checks this machine, not any server.`],
    ['The firewall explorer is a model', 'It evaluates the recorded ufw rules in your browser. It never contacts the server and ignores loopback, established connections and IPv6.'],
      ];
  const cmds = [
    `git clone ${REPO}.git && cd server-and-networking-lab`,
    'python3 tests/test_smoke.py',
    'python3 -m unittest discover -s tests -p "test_*.py" -v',
    'python3 src/make_results.py --check',
    'cd site && npm ci && npm run build',
  ];
  const docs = [['PROPOSAL.md', 'Proposal', 'Question, targets, design'], ['REPORT.md', 'Report', 'Baseline, findings, limits'], ['docs/decisions/0001-approved-firewall-ports.md', 'Decision 0001', 'Approved firewall ports'], ['CHANGELOG.md', 'Changelog', 'Every change, dated'], ['src/baseline_check.py', 'Checker', 'The ten checks'], ['tests/test_baseline.py', 'Tests', `${testCount} unit tests`]];
  return (
    <section id="limits" className="card window reveal" data-title="LIMITS.txt">
      <p className="eyebrow">Limits and method</p>
      <h2>What this page can <em>not</em> tell you.</h2>
      <blockquote className="quote">{honesty}<cite>README.md, word for word</cite></blockquote>
      <div className="grid2" style={{ marginTop: 16 }}>
        {limits.map(([t, d]) => (
          <div className="tile" key={t}><h3>{t}</h3><p className="hint" style={{ margin: '4px 0 0', fontSize: 13 }}>{d}</p></div>
        ))}
      </div>
      <h3 style={{ marginTop: 24 }}>Reproduce it</h3>
      <ol className="steps" style={{ marginTop: 12 }}>
        {cmds.map((c, i) => <li key={c}><span className="n">{i + 1}</span><div><code className="cmd">{c}</code></div></li>)}
      </ol>
      <div className="docs" style={{ marginTop: 20 }}>
        {docs.map(([p, t, d]) => <a key={p} href={blob(p)}><b>{t}</b><small>{d}</small></a>)}
      </div>
    </section>
  );
}
