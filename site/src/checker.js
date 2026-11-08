// JavaScript port of src/baseline_check.py.
// The expected values (interface, address, ports, thresholds) are not typed here:
// parsePolicy() reads them out of the Python source, so the port and the original
// share one policy. checker.check.mjs runs both on the same snapshots and fails the
// build if any pass flag or detail string differs.

// Python's %s and repr, for the detail strings the Python checker prints.
const pyStr = (v) => (v === true ? 'True' : v === false ? 'False' : v == null ? 'None'
  : Array.isArray(v) ? `[${v.map(pyRepr).join(', ')}]` : String(v));
const pyRepr = (v) => (typeof v === 'string' ? `'${v}'` : pyStr(v));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function get(data, keys, def) {
  let cur = data;
  for (const k of keys) {
    if (!isObj(cur) || !(k in cur)) return def;
    cur = cur[k];
  }
  return cur;
}
const obj = (v) => (isObj(v) ? v : {});
const list = (v) => (Array.isArray(v) ? v : []);

function need(src, re, what) {
  const m = src.match(re);
  if (!m) throw new Error(`baseline_check.py: could not find ${what}`);
  return m;
}
const strings = (s) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

export function parsePolicy(src) {
  const os = need(src, /os_id == "([^"]+)" and version\.startswith\("([^"]+)"\)/, 'the OS rule');
  const ip = need(src, /iface\.get\("name"\) == "([^"]+)" and iface\.get\("address"\) == "([^"]+)" and iface\.get\("mode"\) == "([^"]+)"/, 'the static IP rule');
  const req = need(src, /^REQUIRED_PORTS = \[([\d, ]+)\]/m, 'the required firewall ports');
  const lanSrc = need(src, /^LAN_SOURCE = "([^"]+)"/m, 'the LAN source');
  const appr = need(src, /^APPROVED_LAN_PORTS = \[([\d, ]+)\]/m, 'the approved LAN ports');
  const tn = need(src, /^APPROVED_TAILNET = \{"([^"]+)": \[([\d, ]+)\]\}/m, 'the approved tailnet rule');
  const st = need(src, /pool\.get\("name"\) == "([^"]+)" and len\(pvs\) == (\d+) and total >= ([\d.]+)/, 'the storage rule');
  const cpPort = need(src, /cp\.get\("port"\) == (\d+)/, 'the Cockpit port');
  const cpVer = need(src, /int\(cp\.get\("version", 0\)\) >= (\d+)/, 'the Cockpit version floor');
  const net = need(src, /net\.get\("name"\) == "([^"]+)" and net\.get\("subnet"\) == "([^"]+)"/, 'the labnet rule');
  const svc = need(src, /needed = \[([^\]]+)\]/, 'the service list');
  const logs = need(src, /logs == "([^"]+)"/, 'the journal rule');
  const bak = need(src, /^EXPECTED_BACKUP_SHA256 = "([0-9a-f]{64})"/m, 'the recorded backup hash');
  return {
    osId: os[1], osPrefix: os[2],
    iface: ip[1], address: ip[2], mode: ip[3],
    ports: req[1].split(',').map(Number), sources: [lanSrc[1]],
    approvedPorts: appr[1].split(',').map(Number), tailnet: { [tn[1]]: tn[2].split(',').map(Number) },
    pool: st[1], pvCount: +st[2], minTotalGb: +st[3],
    cockpitPort: +cpPort[1], minCockpit: +cpVer[1],
    labnet: net[1], labnetSubnet: net[2],
    services: strings(svc[1]), journal: logs[1], backupSha: bak[1],
    checkNames: [...src.matchAll(/\("(\w+)", check_\w+\)/g)].map((m) => m[1]),
  };
}

export const poolTotal = (pvs) => Math.round(list(pvs).reduce((s, pv) => s + Number(obj(pv).size_gb ?? 0), 0) * 100) / 100;

const CHECKS = {
  os_ubuntu_24_04(s, p) {
    const id = String(get(s, ['os', 'id'], '')).toLowerCase(), v = String(get(s, ['os', 'version_id'], ''));
    return [id === p.osId && v.startsWith(p.osPrefix), `os.id=${id} version_id=${v}`];
  },
  ssh_key_only(s) {
    const pa = pyStr(get(s, ['ssh', 'password_authentication'], '')).toLowerCase(), root = get(s, ['ssh', 'root_password_locked'], false);
    return [pa === 'no' && root === true, `password_authentication=${pa} root_password_locked=${pyStr(root)}`];
  },
  static_ip_plan(s, p) {
    const i = obj(get(s, ['network', 'primary_interface'], {}));
    return [i.name === p.iface && i.address === p.address && i.mode === p.mode,
      `interface=${pyStr(i.name)} address=${pyStr(i.address)} mode=${pyStr(i.mode)}`];
  },
  firewall_lan_only(s, p) {
    const fw = obj(get(s, ['firewall'], {}));
    const rules = list(fw.allowed_from_lan).filter(isObj);
    const lan = rules.filter((r) => !r.interface), scoped = rules.filter((r) => r.interface);
    const ports = lan.map((r) => r.port).sort((a, b) => a - b);
    const sources = [...new Set(lan.map((r) => r.source))].sort();
    const tailnet = scoped.map((r) => `${pyStr(r.interface)}:${pyStr(r.port)}`).sort();
    const ok = fw.active === true && fw.default_incoming === 'deny'
      && JSON.stringify(sources) === JSON.stringify(p.sources) && ports.every((x) => p.approvedPorts.includes(x))
      && p.ports.every((x) => ports.includes(x)) && scoped.every((r) => (p.tailnet[r.interface] || []).includes(r.port));
    return [ok, `active=${pyStr(fw.active)} default_incoming=${pyStr(fw.default_incoming)} ports=${pyStr(ports)} sources=${pyStr(sources)} tailnet=${pyStr(tailnet)}`];
  },
  storage_pool_labvg(s, p) {
    const pool = obj(get(s, ['storage', 'pool'], {})), pvs = list(pool.physical_volumes), total = poolTotal(pvs);
    return [pool.name === p.pool && pvs.length === p.pvCount && total >= p.minTotalGb,
      `pool=${pyStr(pool.name)} pvs=${pvs.length} total_gb=${total.toFixed(2)}`];
  },
  cockpit_dashboard(s, p) {
    const c = obj(get(s, ['cockpit'], {}));
    const ok = c.port === p.cockpitPort && c.socket_activated === true && c.machines_plugin === true && Math.trunc(Number(c.version ?? 0)) >= p.minCockpit;
    return [ok, `version=${pyStr(c.version)} port=${pyStr(c.port)} socket_activated=${pyStr(c.socket_activated)} machines_plugin=${pyStr(c.machines_plugin)}`];
  },
  labnet_isolated(s, p) {
    const n = obj(get(s, ['network', 'labnet'], {}));
    const ok = n.name === p.labnet && n.subnet === p.labnetSubnet && (n.forward === 'none' || n.forward == null) && n.autostart === true;
    return [ok, `name=${pyStr(n.name)} subnet=${pyStr(n.subnet)} forward=${pyStr(n.forward)} autostart=${pyStr(n.autostart)}`];
  },
  services_and_logs(s, p) {
    const by = Object.fromEntries(list(get(s, ['services'], [])).filter(isObj).map((x) => [x.name, x]));
    const missing = p.services.filter((n) => obj(by[n]).state !== 'active');
    const logs = get(s, ['logs', 'journal_check'], '');
    return [!missing.length && logs === p.journal,
      `services_active=${pyStr(p.services.filter((n) => !missing.includes(n)))} journal_check=${pyStr(logs)}`];
  },
  automatic_security_updates(s) {
    const e = get(s, ['updates', 'automatic_security_updates'], false);
    return [e === true, `automatic_security_updates=${pyStr(e)}`];
  },
  verified_config_backup(s, p) {
    const b = obj(get(s, ['backup'], {})), sha = pyStr(b.sha256 ?? ''), match = sha === p.backupSha;
    return [b.present === true && match, `present=${pyStr(b.present)} sha256_matches_record=${pyStr(match)}`];
  },
};

export function runChecks(snapshot, policy) {
  const results = policy.checkNames.map((name) => {
    const [pass, detail] = CHECKS[name](snapshot, policy);
    return { check: name, pass: !!pass, detail };
  });
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

// One line per check, formatted like run_check.py prints it ("%s %-28s %s").
export const formatRow = (r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.check.padEnd(28)} ${r.detail}`;

// Presets that mirror tests/test_baseline.py. `literal` must appear in the
// named Python test body and `expected` must equal its assertion: the check enforces both.
export const MUTATIONS = [
  { test: 'test_password_auth_on_fails_ssh_check_only', label: 'Password login on', literal: '"yes"', expected: 'ssh_key_only', apply: (s) => { s.ssh.password_authentication = 'yes'; } },
  { test: 'test_labnet_forward_set_fails_isolation_only', label: 'labnet forwards (NAT)', literal: '"nat"', expected: 'labnet_isolated', apply: (s) => { s.network.labnet.forward = 'nat'; } },
  { test: 'test_small_pool_fails_storage_only', label: 'Pool cut to one disk', literal: '[:1]', expected: 'storage_pool_labvg', apply: (s) => { s.storage.pool.physical_volumes = s.storage.pool.physical_volumes.slice(0, 1); } },
  { test: 'test_open_firewall_port_fails_firewall_only', label: 'RDP open to the world', literal: '{"port": 3389, "source": "0.0.0.0/0"}', expected: 'firewall_lan_only', apply: (s) => { s.firewall.allowed_from_lan.push({ port: 3389, source: '0.0.0.0/0' }); } },
  { test: 'test_bad_backup_hash_fails_backup_only', label: 'Backup hash corrupted', literal: '"not-a-hash"', expected: 'verified_config_backup', apply: (s) => { s.backup.sha256 = 'not-a-hash'; } },
  { test: 'test_wrong_static_ip_fails_network_only', label: 'Static address moved', literal: '"192.168.1.99/24"', expected: 'static_ip_plan', apply: (s) => { s.network.primary_interface.address = '192.168.1.99/24'; } },
  { test: 'test_old_ubuntu_release_fails_os_check_only', label: 'Older Ubuntu release', literal: '"22.04.4"', expected: 'os_ubuntu_24_04', apply: (s) => { s.os.version_id = '22.04.4'; } },
  { test: 'test_missing_machines_plugin_fails_cockpit_only', label: 'Cockpit without VMs plugin', literal: '"machines_plugin"] = False', expected: 'cockpit_dashboard', apply: (s) => { s.cockpit.machines_plugin = false; } },
  { test: 'test_inactive_libvirtd_fails_services_only', label: 'libvirtd stopped', literal: '"inactive"', expected: 'services_and_logs', apply: (s) => { s.services.find((x) => x.name === 'libvirtd').state = 'inactive'; } },
  { test: 'test_updates_off_fails_auto_updates_only', label: 'Auto-updates off', literal: '"automatic_security_updates"] = False', expected: 'automatic_security_updates', apply: (s) => { s.updates.automatic_security_updates = false; } },
];

export const mutate = (snapshot, m) => { const s = structuredClone(snapshot); m.apply(s); return s; };

// Reads the Python test file: name -> expected failing checks (null when the test asserts nothing like that).
export function pythonExpectations(testSrc) {
  const out = {};
  for (const m of testSrc.matchAll(/def (test_\w+)\(self\):([\s\S]*?)(?=\n    def |\n\nif __name__)/g)) {
    const a = m[2].match(/assertEqual\(failed_names\([^)]*\)\)?, \[([^\]]*)\]\)/);
    out[m[1]] = { body: m[2], expected: a ? strings(a[1]) : null };
  }
  return out;
}

export const countTests = (testSrc) => (testSrc.match(/^\s*def test_/gm) || []).length;

// ---- firewall model: default incoming policy plus the recorded allow rules ----
export function parseIPv4(s) {
  const m = String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((x) => x <= 255) ? ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0 : null;
}
const maskOf = (bits) => (bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0);
const toIP = (n) => [24, 16, 8, 0].map((sh) => (n >>> sh) & 255).join('.');

export function inCidr(ip, cidr) {
  const [base, bits] = cidr.split('/'), b = parseIPv4(base), n = Number(bits);
  if (b == null || !(n >= 0 && n <= 32)) return false;
  return ((ip & maskOf(n)) >>> 0) === ((b & maskOf(n)) >>> 0);
}

export function networkOf(cidr) {
  const [addr, bits] = cidr.split('/'), n = Number(bits);
  return `${toIP((parseIPv4(addr) & maskOf(n)) >>> 0)}/${n}`;
}

export function evaluateFirewall(fw, srcIp, port) {
  const ip = parseIPv4(srcIp);
  if (ip == null) return { verdict: null, reason: 'Enter an IPv4 address such as 192.168.1.20.' };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { verdict: null, reason: 'Enter a port from 1 to 65535.' };
  if (fw.active !== true) return { verdict: 'ALLOW', reason: 'The firewall is not active, so nothing is filtered.' };
  const rule = list(fw.allowed_from_lan).find((r) => r.port === port && inCidr(ip, r.source));
  if (rule) return { verdict: 'ALLOW', rule, reason: `Matches the rule: allow ${rule.port}/tcp from ${rule.source}.` };
  const portOpen = list(fw.allowed_from_lan).some((r) => r.port === port);
  const verdict = fw.default_incoming === 'deny' ? 'DENY' : 'ALLOW';
  return { verdict, reason: portOpen ? `Port ${port} is open, but only from ${list(fw.allowed_from_lan).filter((r) => r.port === port).map((r) => r.source).join(', ')}. Falls through to default incoming ${fw.default_incoming}.` : `No rule opens port ${port}. Falls through to default incoming ${fw.default_incoming}.` };
}
