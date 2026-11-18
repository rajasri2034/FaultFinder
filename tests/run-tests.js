/**
 * FaultFinder automated tests. Run: node tests/run-tests.js
 * Browser: open index.html?test=1
 * Hand calculations: verification/stage1-hand-calculations.md
 */

import { awardXp, buildFaultReport, computeScore, diagnosisIsCorrect, meterFactor, METER_DELAY_MS, plainCircuit, rankFor, takeMeasurement } from '../js/engine.js';
import { API_URL, sanitizeNickname, submitOnline, upsertLocal } from '../js/leaderboard.js';
import { caseUnlocked, FAULT_TYPES, getCase, listCases } from '../js/levels.js';
import { getMentorHint } from '../js/mentor.js';
import { generateWaveform, measureWaveform } from '../js/scope.js';
import { measureContinuity, measureResistance, measureVoltage, nodeCurrentBalance, solveCircuit } from '../js/solver.js';
import { defaultSave, loadSave, writeSave } from '../js/storage.js';

const FIXED_FAULTS = {
  0: { component: 'R1', type: 'open' },
  1: { component: 'D1', type: 'open' },
};

const results = [];

function logLine(log, line) {
  results.push(line);
  if (log) log(line);
}

function assert(condition, name) {
  if (!condition) throw new Error(name);
}

async function test(name, fn, log) {
  try {
    await fn();
    logLine(log, `PASS  ${name}`);
    return true;
  } catch (error) {
    logLine(log, `FAIL  ${name}`);
    logLine(log, `      ${error.message}`);
    return false;
  }
}

function circuitOf(level) {
  return plainCircuit(level);
}

function pairVoltage(level, pair, faultActive) {
  const [red, black] = pair.split(',');
  const redNode = level.testPoints.find((point) => point.id === red).node;
  const blackNode = level.testPoints.find((point) => point.id === black).node;
  const reading = measureVoltage(circuitOf(level), redNode, blackNode, { faultActive, powerOn: true });
  assert(reading.ol === false, `${pair} voltage mode returned OL`);
  assert(reading.valid, `${pair} voltage did not converge`);
  return reading.volts;
}

function pairOhms(level, pair, faultActive) {
  const [red, black] = pair.split(',');
  const redNode = level.testPoints.find((point) => point.id === red).node;
  const blackNode = level.testPoints.find((point) => point.id === black).node;
  const reading = measureResistance(circuitOf(level), redNode, blackNode, { faultActive, powerOn: false });
  assert(reading.valid, `${pair} resistance did not converge`);
  return reading.ol ? 'OL' : reading.ohms;
}

export async function runAllTests(options = {}) {
  const log = options.log || null;
  results.length = 0;
  let failed = 0;
  let passed = 0;

  const run = async (name, fn) => {
    const ok = await test(name, fn, log);
    if (ok) passed += 1;
    else failed += 1;
  };

  await run('unique case ids and contiguous numbers', () => {
    const cases = listCases();
    const ids = cases.map((entry) => entry.id);
    assert(new Set(ids).size === ids.length, 'duplicate case id');
    cases.forEach((entry, index) => {
      assert(entry.number === index, `case number ${entry.number} is out of sequence`);
    });
    assert(cases.length === 2, 'Stage 1 builds the tutorial and Case 1 only');
  });

  await run('unlock keeps the tutorial skippable', () => {
    assert(caseUnlocked(0, {}), 'case 0 locked');
    assert(caseUnlocked(1, {}), 'case 1 locked');
    assert(caseUnlocked(2, {}) === false, 'case 2 unlocked with nothing solved');
    assert(caseUnlocked(2, { 1: true }) === true, 'case 2 stayed locked after case 1');
  });

  await run('exactly one fixed fault per case', () => {
    for (const entry of listCases()) {
      assert(entry.fault && entry.fault.component && entry.fault.type, `${entry.id} missing fault`);
      assert(!entry.faults, `${entry.id} has a list of faults`);
      assert(FAULT_TYPES.includes(entry.fault.type), `${entry.id} fault type ${entry.fault.type}`);
      const part = entry.components.find((component) => component.id === entry.fault.component);
      assert(part, `${entry.id} fault refers to a missing component`);
      const fixed = FIXED_FAULTS[entry.number];
      assert(fixed, `no fixed fault row for case ${entry.number}`);
      assert(entry.fault.component === fixed.component && entry.fault.type === fixed.type, `${entry.id} does not match the fixed fault table`);
      assert(entry.override !== true, `${entry.id} uses an override`);
    }
  });

  await run('nodes and test points are valid', () => {
    for (const entry of listCases()) {
      assert(entry.nodes.includes(entry.ground), `${entry.id} ground is not a node`);
      const seen = new Set();
      for (const point of entry.testPoints) {
        assert(!seen.has(point.id), `${entry.id} duplicate ${point.id}`);
        seen.add(point.id);
        assert(entry.nodes.includes(point.node), `${point.id} maps to unknown node ${point.node}`);
      }
      for (const component of entry.components) {
        for (const node of component.nodes) {
          assert(entry.nodes.includes(node), `${component.id} uses unknown node ${node}`);
        }
      }
      assert(entry.nodes.includes(entry.supply.positive) && entry.nodes.includes(entry.supply.negative), 'supply node missing');
    }
  });

  await run('solver matches the hand-checked expected values', () => {
    for (const entry of listCases()) {
      for (const stateName of ['healthy', 'faulty']) {
        const faultActive = stateName === 'faulty';
        const table = entry.expected[stateName];
        for (const [pair, expected] of Object.entries(table.voltage)) {
          const actual = pairVoltage(entry, pair, faultActive);
          const deviation = Math.abs(actual - expected);
          logLine(log, `      ${entry.id} ${stateName} V ${pair} solver=${actual.toFixed(6)} hand=${expected} dev=${deviation.toExponential(2)}`);
          assert(deviation < 0.01, `${entry.id} ${stateName} ${pair} voltage off by ${deviation}`);
        }
        for (const [pair, expected] of Object.entries(table.resistance)) {
          const actual = pairOhms(entry, pair, faultActive);
          logLine(log, `      ${entry.id} ${stateName} R ${pair} solver=${actual} hand=${expected}`);
          if (expected === 'OL') assert(actual === 'OL', `${entry.id} ${stateName} ${pair} should be OL, got ${actual}`);
          else assert(typeof actual === 'number' && Math.abs(actual - expected) < 0.05, `${entry.id} ${stateName} ${pair} ohms ${actual}`);
        }
        const solved = solveCircuit(circuitOf(entry), { faultActive, powerOn: true });
        assert(solved.converged && !solved.singular, `${entry.id} ${stateName} did not converge`);
        for (const [id, expected] of Object.entries(table.current)) {
          const actual = solved.branches[id] ? solved.branches[id].current : 0;
          const deviation = Math.abs(actual - expected);
          logLine(log, `      ${entry.id} ${stateName} I ${id} solver=${actual.toExponential(6)} hand=${expected.toExponential(6)} dev=${deviation.toExponential(2)}`);
          assert(deviation < 1e-6, `${entry.id} ${stateName} current ${id} off by ${deviation}`);
        }
      }
    }
  });

  await run('KVL and KCL on both cases', () => {
    for (const entry of listCases()) {
      for (const faultActive of [false, true]) {
        const solved = solveCircuit(circuitOf(entry), { faultActive, powerOn: true });
        const balance = nodeCurrentBalance(entry, solved, { powerOn: true });
        for (const [node, residual] of Object.entries(balance)) {
          assert(Math.abs(residual) < 1e-8, `${entry.id} KCL at ${node} residual ${residual}`);
        }
        const vPos = solved.voltages.N_POS;
        const vMid = solved.voltages.N_MID;
        const vGnd = solved.voltages.N_GND;
        const loop = (vPos - vMid) + (vMid - vGnd) - (vPos - vGnd);
        assert(Math.abs(loop) < 1e-9, `${entry.id} KVL loop ${loop}`);
        if (!faultActive) {
          const resistor = entry.components.find((component) => component.id === 'R1');
          const led = entry.components.find((component) => component.id === 'D1');
          const current = (entry.supply.voltage - led.vf) / resistor.value;
          assert(Math.abs(solved.branches.R1.current - current) < 1e-9, 'Ohm current mismatch');
          assert(Math.abs((vPos - vMid) - current * resistor.value) < 1e-6, 'Ohm resistor drop mismatch');
          assert(Math.abs((vMid - vGnd) - led.vf) < 1e-6, 'LED drop mismatch');
        }
      }
    }
  });

  await run('worked example: 12 V, 1 kΩ, red LED 2 V, 10 mA', () => {
    const circuit = {
      id: 'worked-led',
      ground: 'N_GND',
      nodes: ['N_POS', 'N_MID', 'N_GND'],
      supply: { id: 'V1', voltage: 12, positive: 'N_POS', negative: 'N_GND' },
      components: [
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['N_POS', 'N_MID'] },
        { id: 'D1', type: 'led', color: 'red', vf: 2, nodes: ['N_MID', 'N_GND'] },
      ],
      fault: null,
    };
    const solved = solveCircuit(circuit, { faultActive: true, powerOn: true });
    assert(solved.converged, 'worked example did not converge');
    assert(Math.abs(solved.branches.R1.current - 0.01) < 1e-9, `current ${solved.branches.R1.current}`);
    assert(Math.abs(solved.voltages.N_MID - 2) < 1e-6, `LED node ${solved.voltages.N_MID}`);
    assert(Math.abs(solved.branches.R1.voltage - 10) < 1e-6, 'resistor drop');
    const openLed = solveCircuit({ ...circuit, fault: { component: 'D1', type: 'open' } }, { faultActive: true, powerOn: true });
    const acrossOpen = measureVoltage(
      { ...circuit, fault: { component: 'D1', type: 'open' } },
      'N_MID',
      'N_GND',
      { faultActive: true, powerOn: true },
    );
    assert(acrossOpen.ol === false, 'open LED voltage returned OL');
    assert(Math.abs(acrossOpen.volts - 12) < 0.01, `open LED voltage ${acrossOpen.volts}`);
    assert(Math.abs(openLed.branches.R1.current) < 1e-8, 'open LED still drew current');
  });

  await run('zener regulator holds 5.1 V', () => {
    const circuit = {
      id: 'zener',
      ground: 'N_GND',
      nodes: ['N_POS', 'N_Z', 'N_GND'],
      supply: { id: 'V1', voltage: 12, positive: 'N_POS', negative: 'N_GND' },
      components: [
        { id: 'R1', type: 'resistor', value: 1000, nodes: ['N_POS', 'N_Z'] },
        { id: 'DZ1', type: 'zener', vz: 5.1, vf: 0.7, nodes: ['N_GND', 'N_Z'] },
      ],
      fault: null,
    };
    const solved = solveCircuit(circuit, { powerOn: true });
    assert(solved.converged, 'zener did not converge');
    assert(solved.branches.DZ1.state === 'zener', `state ${solved.branches.DZ1.state}`);
    assert(Math.abs(solved.voltages.N_Z - 5.1) < 1e-6, `Vz ${solved.voltages.N_Z}`);
    assert(Math.abs(solved.branches.R1.current - 0.0069) < 1e-6, `Iz ${solved.branches.R1.current}`);
    const balance = nodeCurrentBalance(circuit, solved, { powerOn: true });
    for (const residual of Object.values(balance)) assert(Math.abs(residual) < 1e-8, `zener KCL ${residual}`);
  });

  await run('polarity, continuity threshold, powered ohms, short and leak', () => {
    const tutorial = getCase(0);
    const negative = pairVoltage(tutorial, 'TP3,TP1', false);
    assert(Math.abs(negative + 9) < 0.01, `polarity ${negative}`);
    const beep = measureContinuity({
      ground: 'N_GND',
      nodes: ['A', 'B', 'N_GND'],
      components: [{ id: 'R', type: 'resistor', value: 10, nodes: ['A', 'B'] }],
      supply: null,
      fault: null,
    }, 'A', 'B', { powerOn: false });
    assert(beep.beep === true && beep.ohms < 50, '10 Ω did not beep');
    const silent = measureContinuity({
      ground: 'N_GND',
      nodes: ['A', 'B', 'N_GND'],
      components: [{ id: 'R', type: 'resistor', value: 50, nodes: ['A', 'B'] }],
      supply: null,
      fault: null,
    }, 'A', 'B', { powerOn: false });
    assert(silent.beep === false, '50 Ω beeped; threshold is below 50');
    const powered = measureResistance(circuitOf(getCase(1)), 'N_POS', 'N_MID', { faultActive: true, powerOn: true });
    assert(powered.valid === false && powered.unstable === true && powered.ohms === null, 'powered ohms returned a clean value');
    const shorted = solveCircuit({
      ground: 'N_GND',
      nodes: ['N_POS', 'N_MID', 'N_GND'],
      supply: { id: 'V1', voltage: 5, positive: 'N_POS', negative: 'N_GND' },
      components: [{ id: 'R1', type: 'resistor', value: 330, nodes: ['N_POS', 'N_MID'] }],
      fault: { component: 'R1', type: 'short' },
    }, { faultActive: true, powerOn: true });
    assert(Math.abs(shorted.branches.R1.voltage) < 0.01, 'short did not collapse voltage');
    const leaky = measureResistance({
      ground: 'N_GND',
      nodes: ['A', 'B', 'N_GND'],
      components: [{ id: 'D1', type: 'led', vf: 2, nodes: ['A', 'B'] }],
      supply: null,
      fault: { component: 'D1', type: 'leaky', value: 10000 },
    }, 'A', 'B', { faultActive: true, powerOn: false });
    assert(leaky.ol === false && Math.abs(leaky.ohms - 10000) < 1, `leak ohms ${leaky.ohms}`);
  });

  await run('measurement path never reads expected', () => {
    const level = getCase(1);
    const proxy = new Proxy(level, {
      get(target, prop, receiver) {
        if (prop === 'expected') throw new Error('measurement path read expected');
        const value = Reflect.get(target, prop, receiver);
        if (prop === 'checks' || prop === 'testPoints' || prop === 'components') return value;
        return value;
      },
    });
    const reading = takeMeasurement(proxy, { mode: 'voltage', redId: 'TP2', blackId: 'TP3', powerOn: true });
    assert(reading.valid && reading.ol === false, 'proxy voltage failed');
    assert(Math.abs(reading.raw - 5) < 0.01, `case 1 LED node raw ${reading.raw}`);
    const report = buildFaultReport(proxy);
    assert(report.rows.some((row) => row.faulty === '5.00'), 'report did not show the solved 5.00 V');
    const before = JSON.stringify(level.components);
    takeMeasurement(level, { mode: 'resistance', redId: 'TP1', blackId: 'TP2', powerOn: false });
    assert(JSON.stringify(level.components) === before, 'measurement mutated the level');
  });

  await run('meter factor stays inside half a percent and does not touch raw', () => {
    const factor = meterFactor('case-1');
    assert(factor >= 0.995 && factor <= 1.005, `factor ${factor}`);
    assert(meterFactor('case-1') === factor, 'factor was not stable');
    const level = getCase(1);
    const first = takeMeasurement(level, { mode: 'voltage', redId: 'TP1', blackId: 'TP3', powerOn: true });
    const second = takeMeasurement(level, { mode: 'voltage', redId: 'TP1', blackId: 'TP3', powerOn: true });
    assert(first.display === second.display, 'display jitter was not reproducible');
    assert(first.exact === '5.00', `exact display ${first.exact}`);
    const shown = Number(first.display);
    assert(Math.abs(shown - first.raw) / Math.abs(first.raw) <= 0.005 + 1e-9, 'display left the 0.5% window');
    assert(METER_DELAY_MS === 300, 'meter delay is not 300 ms');
    const bad = takeMeasurement(level, { mode: 'resistance', redId: 'TP1', blackId: 'TP2', powerOn: true });
    assert(bad.display === 'Err' && bad.penalty === true && bad.raw === null, 'powered resistance was a clean number');
    const openVolts = takeMeasurement(level, { mode: 'voltage', redId: 'TP2', blackId: 'TP3', powerOn: true });
    assert(openVolts.display !== 'OL' && openVolts.ol === false, 'voltage mode showed OL');
  });

  await run('scoring, stars, xp and rank', () => {
    const clean = computeScore({ measurements: 4, hints: 0, poweredResistance: 0, wrongAttempts: 0, elapsedSec: 30, streak: 1 });
    assert(clean.score === 1500 && clean.stars === 3, `clean score ${clean.score}`);
    const streak = computeScore({ measurements: 4, hints: 0, poweredResistance: 0, wrongAttempts: 0, elapsedSec: 10, streak: 2 });
    assert(streak.score === 1650 && streak.multiplier === 1.1, `streak score ${streak.score}`);
    const messy = computeScore({ measurements: 10, hints: 1, poweredResistance: 1, wrongAttempts: 1, elapsedSec: 90, streak: 3 });
    assert(messy.score === 0 && messy.stars === 1, `messy score ${messy.score}`);
    const edge = computeScore({ measurements: 0, hints: 0, poweredResistance: 0, wrongAttempts: 0, elapsedSec: 60, streak: 1 });
    assert(edge.parts.timePenalty === 0 && edge.score === 1500, 'time penalty started too early');
    const later = computeScore({ measurements: 0, hints: 0, poweredResistance: 0, wrongAttempts: 0, elapsedSec: 61, streak: 1 });
    assert(later.parts.timePenalty === 2, 'time penalty step');
    const award = awardXp(1000, 800);
    assert(award.best === 1000 && award.gained === 0, 'xp went backwards');
    const better = awardXp(1000, 1200);
    assert(better.gained === 200 && better.best === 1200, 'xp gain');
    assert(rankFor(0).title === 'Apprentice', 'rank start');
    assert(rankFor(2000).title === 'Technician', 'rank technician');
    assert(diagnosisIsCorrect(getCase(1), 'D1', 'open') === true, 'case 1 key');
    assert(diagnosisIsCorrect(getCase(1), 'R1', 'open') === false, 'wrong part accepted');
    assert(diagnosisIsCorrect(getCase(0), 'R1', 'open') === true, 'tutorial key');
  });

  await run('localStorage failure stays safe', () => {
    const exploding = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    const loaded = loadSave(exploding);
    assert(loaded.xp === 0 && loaded.version === 1, 'load did not fall back');
    const written = writeSave(defaultSave(), exploding);
    assert(written.ok === false, 'write reported success while throwing');
    const missing = loadSave(null);
    assert(missing.version === 1, 'missing storage crashed');
    const memory = new Map();
    const fake = {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, value),
    };
    writeSave({ ...defaultSave(), xp: 40 }, fake);
    assert(loadSave(fake).xp === 40, 'round trip failed');
    assert(loadSave({ getItem: () => '{', setItem() {} }).version === 1, 'bad json crashed');
  });

  await run('leaderboard sanitizes names and online stays visible when down', async () => {
    assert(sanitizeNickname('<b>Ace</b>') === 'Ace', 'tag strip');
    assert(sanitizeNickname('Rajas<script>') === 'Rajas', 'script strip');
    assert(sanitizeNickname('1234567890123456789') === '1234567890123456', 'length');
    const saved = upsertLocal([], '  Ada ', 1500);
    assert(saved.error === null && saved.entries[0].name === 'Ada' && saved.entries[0].score === 1500, 'local save');
    assert(API_URL === '', 'an online URL was configured without a host');
    const online = await submitOnline('Ada', 1500);
    assert(online.ok === false && online.message === 'Online leaderboard unavailable', online.message);
  });

  await run('mentor resolves without reading the answer key', async () => {
    const level = getCase(0);
    const first = await getMentorHint(level, [], 1);
    assert(typeof first === 'string' && first.length > 30, 'empty hint');
    const pointed = await getMentorHint(level, [
      { mode: 'voltage', valid: true, raw: 0, display: '0.00', red: 'TP2', black: 'TP3' },
    ], 2);
    assert(/LED|supply|voltage/i.test(pointed), 'hint ignored the log');
    assert(!/R1 is open/i.test(pointed), 'hint revealed the answer');
    const caseOne = await getMentorHint(getCase(1), [
      { mode: 'voltage', valid: true, raw: 5, display: '5.00', red: 'TP2', black: 'TP3' },
    ], 3);
    assert(/2 V|full supply|LED/i.test(caseOne), 'case 1 hint was generic');
    assert(!/D1 is open/i.test(caseOne), 'case 1 hint named the fault');
  });

  await run('scope math matches the waveform model', () => {
    const sine = generateWaveform({ type: 'sine', amplitude: 5, frequency: 50, offset: 0 }, 1, 100);
    const read = measureWaveform(sine);
    assert(Math.abs(read.vpp - 10) < 1e-6, `sine Vpp ${read.vpp}`);
    assert(read.frequency === 50, 'sine frequency drifted from the model');
    const flat = generateWaveform({ type: 'dc', offset: 5, amplitude: 0, frequency: 0 });
    assert(Math.abs(measureWaveform(flat).vpp) < 1e-9, 'dc was not flat');
    const square = generateWaveform({ type: 'square', amplitude: 4, frequency: 1000, duty: 0.25, offset: 0 }, 1, 100);
    assert(Math.abs(square.vpp - 8) < 1e-6, 'square Vpp');
    assert(square.duty === 0.25 && measureWaveform(square).duty === 0.25, 'duty drifted');
    assert(listCases().every((entry) => !entry.scope), 'a Stage 1 case claims a scope screen');
  });

  await run('fault report is computed, not copied from expected', () => {
    const report = buildFaultReport(getCase(1));
    const led = report.rows.find((row) => row.label.startsWith('LED'));
    const resistor = report.rows.find((row) => row.label.startsWith('Resistor'));
    assert(led.healthy === '2.00' && led.faulty === '5.00', `LED row ${led.healthy} ${led.faulty}`);
    assert(resistor.healthy === '3.00' && resistor.faulty === '0.00', `R row ${resistor.healthy} ${resistor.faulty}`);
    assert(report.explanation.includes('D1 is open'), 'explanation names the wrong fault');
    const tutorial = buildFaultReport(getCase(0));
    const openR = tutorial.rows.find((row) => row.label.startsWith('Resistor'));
    assert(openR.healthy === '7.00' && openR.faulty === '9.00', `tutorial R ${openR.healthy} ${openR.faulty}`);
    const ohms = tutorial.rows.find((row) => row.mode === 'resistance');
    assert(ohms.healthy === '470' && ohms.faulty === 'OL', `tutorial ohms ${ohms.healthy} ${ohms.faulty}`);
  });

  const overrides = listCases().filter((entry) => entry.override === true).map((entry) => entry.id);
  logLine(log, overrides.length ? `Overrides: ${overrides.join(', ')}` : 'Overrides: none');
  logLine(log, `${passed} passed, ${failed} failed`);
  return { passed, failed, logs: [...results] };
}

const invokedDirectly = typeof process !== 'undefined'
  && process.argv?.[1]
  && process.argv[1].replaceAll('\\', '/').endsWith('/tests/run-tests.js');

if (invokedDirectly) {
  const summary = await runAllTests({ log: (line) => console.log(line) });
  process.exit(summary.failed ? 1 : 0);
}
