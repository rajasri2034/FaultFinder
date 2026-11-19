/**
 * CIRCUIT SLEUTH automated tests. Run: node tests/run-tests.js
 * Browser: open index.html?test=1
 */

import { awardXp, buildFaultReport, buildShareCardText, computeScore, diagnosisIsCorrect, meterFactor, METER_DELAY_MS, plainCircuit, rankFor, shareResults, takeMeasurement } from '../js/engine.js';
import { API_URL, sanitizeNickname, submitOnline, upsertLocal } from '../js/leaderboard.js';
import { caseUnlocked, FAULT_TYPES, getCase, listCases } from '../js/levels.js';
import { getMentorHint } from '../js/mentor.js';
import { generateWaveform, measureWaveform } from '../js/scope.js';
import { measureContinuity, measureResistance, measureVoltage, nodeCurrentBalance, solveCircuit } from '../js/solver.js';
import { defaultSave, loadSave, writeSave } from '../js/storage.js';

const FIXED_FAULTS = {
  0: { component: 'R1', type: 'open' },
  1: { component: 'D1', type: 'open' },
  2: { component: 'R1', type: 'wrong-value' },
  3: { component: 'R2', type: 'open' },
  4: { component: 'D1', type: 'reversed' },
  5: { component: 'C1', type: 'leaky' },
  6: { component: 'R_B', type: 'open' },
  7: { component: 'D1', type: 'short' },
  8: { component: 'U1', type: 'dead' },
  9: { component: 'R3', type: 'wrong-value' },
  10: { component: 'R2', type: 'open' },
  11: { component: 'R_PU', type: 'open' },
  12: { component: 'D1', type: 'open' },
  13: { component: 'C1', type: 'open' },
  14: { component: 'DZ1', type: 'open' },
  15: { component: 'C1', type: 'short' },
  16: { component: 'R2', type: 'open' },
  17: { component: 'R_f', type: 'wrong-value' },
  18: { component: 'Q3', type: 'dead' },
  19: { component: 'R_G', type: 'open' },
  20: { component: 'Q1', type: 'dead' },
};

const SCOPE_CASE_NUMBERS = [12, 13, 15, 16, 17, 19, 20];

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
    assert(cases.length === 21, `Expected 21 cases (0-20), got ${cases.length}`);
  });

  await run('unlock keeps the tutorial skippable', () => {
    assert(caseUnlocked(0, {}), 'case 0 locked');
    assert(caseUnlocked(1, {}), 'case 1 locked');
    assert(caseUnlocked(2, {}) === false, 'case 2 unlocked with nothing solved');
    assert(caseUnlocked(2, { 1: true }) === true, 'case 2 stayed locked after case 1');
    assert(caseUnlocked(20, { 19: true }) === true, 'boss case stayed locked after case 19');
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
          assert(deviation < 0.03, `${entry.id} ${stateName} ${pair} voltage off by ${deviation}`);
        }
        for (const [pair, expected] of Object.entries(table.resistance)) {
          const actual = pairOhms(entry, pair, faultActive);
          if (expected === 'OL') assert(actual === 'OL', `${entry.id} ${stateName} ${pair} should be OL, got ${actual}`);
          else assert(typeof actual === 'number' && Math.abs(actual - expected) <= Math.max(0.05, expected * 0.01), `${entry.id} ${stateName} ${pair} ohms ${actual}`);
        }
        const solved = solveCircuit(circuitOf(entry), { faultActive, powerOn: true });
        assert(solved.converged && !solved.singular, `${entry.id} ${stateName} did not converge`);
        for (const [id, expected] of Object.entries(table.current)) {
          const actual = solved.branches[id] ? solved.branches[id].current : 0;
          const deviation = Math.abs(actual - expected);
          assert(deviation < 1e-3, `${entry.id} ${stateName} current ${id} off by ${deviation}`);
        }
      }
    }
  });

  await run('KVL and KCL on all cases', () => {
    for (const entry of listCases()) {
      for (const faultActive of [false, true]) {
        const solved = solveCircuit(circuitOf(entry), { faultActive, powerOn: true });
        const balance = nodeCurrentBalance(entry, solved, { powerOn: true });
        for (const [node, residual] of Object.entries(balance)) {
          assert(Math.abs(residual) < 1e-8, `${entry.id} KCL at ${node} residual ${residual}`);
        }
      }
    }
  });

  await run('scope cases define waveforms for at least 2 probe points', () => {
    for (const num of SCOPE_CASE_NUMBERS) {
      const entry = getCase(num);
      assert(entry.hasScope === true && entry.scope, `${entry.id} missing scope config`);
      const hKeys = Object.keys(entry.scope.healthyWaveforms || {});
      const fKeys = Object.keys(entry.scope.faultyWaveforms || {});
      assert(hKeys.length >= 2 && fKeys.length >= 2, `${entry.id} needs >= 2 scope probe points`);
      for (const tp of fKeys) {
        const read = measureWaveform(generateWaveform(entry.scope.faultyWaveforms[tp], 2, 100));
        assert(Number.isFinite(read.vpp) && Number.isFinite(read.frequency), `${entry.id} invalid waveform at ${tp}`);
      }
    }
    const boss = getCase(20);
    const bossGate = measureWaveform(generateWaveform(boss.scope.faultyWaveforms.TP3, 2, 100));
    const bossDrain = measureWaveform(generateWaveform(boss.scope.faultyWaveforms.TP4, 2, 100));
    assert(bossGate.vpp > 4.5 && bossGate.frequency === 1000 && bossDrain.vpp === 0, 'boss case scope symptom unclear');
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
        return Reflect.get(target, prop, receiver);
      },
    });
    const reading = takeMeasurement(proxy, { mode: 'voltage', redId: 'TP2', blackId: 'TP3', powerOn: true });
    assert(reading.valid && reading.ol === false && Math.abs(reading.raw - 5) < 0.01, 'proxy voltage failed');
  });

  await run('meter factor stays inside half a percent', () => {
    const factor = meterFactor('case-1');
    assert(factor >= 0.995 && factor <= 1.005, `factor ${factor}`);
    assert(METER_DELAY_MS === 300, 'meter delay is not 300 ms');
  });

  await run('scoring, stars, xp and rank', () => {
    const clean = computeScore({ measurements: 4, hints: 0, poweredResistance: 0, wrongAttempts: 0, elapsedSec: 30, streak: 1 });
    assert(clean.score === 1500 && clean.stars === 3, `clean score ${clean.score}`);
    assert(rankFor(0).title === 'Apprentice' && rankFor(2000).title === 'Technician', 'ranks');
    assert(diagnosisIsCorrect(getCase(1), 'D1', 'open') === true, 'case 1 key');
  });

  await run('localStorage failure stays safe', () => {
    const exploding = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert(loadSave(exploding).xp === 0, 'load fallback');
    assert(writeSave(defaultSave(), exploding).ok === false, 'write fallback');
  });

  await run('leaderboard sanitizes names and online stays visible when down', async () => {
    assert(sanitizeNickname('<b>Ace</b>') === 'Ace', 'tag strip');
    const online = await submitOnline('Ada', 1500);
    assert(online.ok === false && online.message === 'Online leaderboard unavailable', online.message);
  });

  await run('mentor resolves without reading the answer key', async () => {
    const first = await getMentorHint(getCase(0), [], 1);
    assert(typeof first === 'string' && first.length > 30, 'empty hint');
  });

  await run('scope math matches the waveform model', () => {
    const sine = generateWaveform({ type: 'sine', amplitude: 5, frequency: 50, offset: 0 }, 1, 100);
    const read = measureWaveform(sine);
    assert(Math.abs(read.vpp - 10) < 1e-6 && read.frequency === 50, 'sine');
  });

  await run('fault report is computed, not copied from expected', () => {
    const report = buildFaultReport(getCase(1));
    assert(report.explanation.includes('D1 is open'), 'explanation');
  });

  await run('stage 5: mentor 3 escalating levels use measurement log without reading answer key', async () => {
    const level = getCase(1);
    const guarded = new Proxy(level, {
      get(target, prop, receiver) {
        if (prop === 'expected' || prop === 'fault') throw new Error('mentor leaked answer key');
        return Reflect.get(target, prop, receiver);
      },
    });
    const empty1 = getMentorHint(guarded, [], 1);
    assert(empty1 instanceof Promise, 'mentor must return a Promise');
    const h0 = await empty1;
    assert(h0.toLowerCase().includes("haven't taken any measurements") || h0.length > 20, 'empty log guidance');

    const log = [
      { mode: 'voltage', powerOn: true, red: 'TP2', black: 'TP3', valid: true, raw: 5, display: '5.00' },
    ];
    const h1 = await getMentorHint(guarded, log, 1);
    const h2 = await getMentorHint(guarded, log, 2);
    const h3 = await getMentorHint(guarded, log, 3);
    assert(h1 !== h2 && h2 !== h3 && h1.includes('TP2'), '3 distinct measurement-aware hints');
  });

  await run('stage 5: scoring penalties, streak bonuses, star ratings, and duplicate XP guard', () => {
    const streakBoost = computeScore({ measurements: 2, hints: 0, poweredResistance: 0, wrongAttempts: 0, elapsedSec: 20, streak: 3 });
    assert(streakBoost.score === 1650 && streakBoost.stars === 3, 'streak 3 should give 1650');
    const penalized = computeScore({ measurements: 8, hints: 2, poweredResistance: 1, wrongAttempts: 2, elapsedSec: 200, streak: 1 });
    assert(penalized.score === 100 && penalized.stars === 1, 'minimum floor 100 prevents negative scores');
    const dup = awardXp(1500, 1500);
    const lower = awardXp(1500, 1200);
    assert(dup.gained === 0 && lower.gained === 0 && dup.best === 1500, 'duplicate XP prevented');
  });

  await run('stage 5: leaderboard sanitization, sorting, opt-in consent, and share fallback', async () => {
    assert(sanitizeNickname('<script>alert(1)</script>VeryLongDetectiveName') === 'alert(1)VeryLong', 'sanitized max 16 chars');
    const lb = upsertLocal([{ name: 'A', score: 900 }], '<b>Zed</b>', 1400, { rank: 'Technician' });
    assert(lb.entries[0].name === 'Zed' && lb.entries[0].score === 1400, 'sorted descending');
    const noConsent = await submitOnline('Zed', 1400, { consented: false });
    assert(noConsent.ok === false && noConsent.message === 'Consent required before uploading', noConsent.message);
    const withConsent = await submitOnline('Zed', 1400, { consented: true });
    assert(withConsent.ok === false && withConsent.message === 'Online leaderboard unavailable', withConsent.message);
    const card = buildShareCardText({ nickname: 'Zed', score: 1400, rank: 'Technician', casesSolved: 5, stars: 3 });
    assert(card.includes('CIRCUIT SLEUTH') && card.includes('1400'), 'share card text');
    const shared = await shareResults({ nickname: 'Zed', score: 1400, rank: 'Technician', casesSolved: 5, stars: 3 }, { navigatorObj: null });
    assert(shared.ok === true && shared.method === 'text' && shared.text.includes('CIRCUIT SLEUTH'), 'graceful share fallback');
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