/**
 * Measurement formatting, scoring and the fault report.
 * takeMeasurement and buildFaultReport never read level.expected.
 */

import { measureContinuity, measureResistance, measureVoltage, solveCircuit } from './solver.js';

export const METER_DELAY_MS = 300;
export const OL_DISPLAY = 'OL';

const RANKS = [
  { title: 'Apprentice', min: 0 },
  { title: 'Technician', min: 2000 },
  { title: 'Engineer', min: 5000 },
  { title: 'Senior Engineer', min: 10000 },
  { title: 'Master Detective', min: 20000 },
];

export function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** One calibration factor per case, ±0.5%, so every reading on that board shifts together. */
export function meterFactor(caseId) {
  const unit = (hashString(caseId) % 10001) / 10000;
  return 1 + (unit - 0.5) * 0.01;
}

export function plainCircuit(level) {
  return {
    id: level.id,
    nodes: level.nodes,
    ground: level.ground,
    components: level.components,
    supply: level.supply,
    fault: level.fault,
  };
}

function pointNode(level, pointId) {
  const point = (level.testPoints || []).find((entry) => entry.id === pointId);
  return point ? point.node : null;
}

export function formatVoltage(volts) {
  if (!Number.isFinite(volts)) return 'Err';
  const rounded = Math.round(volts * 100) / 100;
  const signed = Math.abs(rounded) < 0.005 ? 0 : rounded;
  return `${signed < 0 ? '-' : ''}${Math.abs(signed).toFixed(2)}`;
}

export function formatOhms(ohms) {
  if (!Number.isFinite(ohms)) return { text: OL_DISPLAY, unit: 'Ω' };
  const magnitude = Math.abs(ohms);
  if (magnitude < 100) return { text: (Math.round(magnitude * 10) / 10).toFixed(1), unit: 'Ω' };
  if (magnitude < 10000) return { text: String(Math.round(magnitude)), unit: 'Ω' };
  if (magnitude < 1e6) {
    const kilo = magnitude / 1000;
    const text = kilo < 10 ? kilo.toFixed(2) : kilo < 100 ? kilo.toFixed(1) : String(Math.round(kilo));
    return { text, unit: 'kΩ' };
  }
  return { text: (magnitude / 1e6).toFixed(2), unit: 'MΩ' };
}

function applyFactor(value, factor) {
  if (!Number.isFinite(value) || value === 0) return value;
  return value * factor;
}

export function takeMeasurement(level, request) {
  const mode = request.mode;
  const powerOn = Boolean(request.powerOn);
  const redId = request.redId;
  const blackId = request.blackId;
  const redNode = pointNode(level, redId);
  const blackNode = pointNode(level, blackId);
  const base = {
    mode,
    red: redId,
    black: blackId,
    powerOn,
    valid: false,
    ol: false,
    beep: false,
    warning: null,
    penalty: false,
    raw: null,
    display: '----',
    unit: '',
    exact: '----',
  };

  if (!redNode || !blackNode) {
    return { ...base, warning: 'Place both probes' };
  }

  const circuit = plainCircuit(level);
  const factor = meterFactor(level.id);

  if (mode === 'resistance' || mode === 'continuity') {
    if (powerOn) {
      return {
        ...base,
        valid: false,
        display: 'Err',
        unit: '',
        exact: 'Err',
        warning: 'Never measure resistance on a powered circuit',
        penalty: true,
        unstable: true,
      };
    }
    const reading = mode === 'continuity'
      ? measureContinuity(circuit, redNode, blackNode, { faultActive: true, powerOn: false })
      : measureResistance(circuit, redNode, blackNode, { faultActive: true, powerOn: false });
    if (!reading.valid) {
      return {
        ...base,
        display: 'Err',
        exact: 'Err',
        warning: reading.warning || 'Meter could not settle',
        unstable: true,
      };
    }
    if (reading.ol) {
      return {
        ...base,
        valid: true,
        ol: true,
        beep: false,
        raw: Infinity,
        display: OL_DISPLAY,
        exact: OL_DISPLAY,
        unit: 'Ω',
        warning: null,
      };
    }
    const jittered = applyFactor(reading.ohms, factor);
    const formatted = formatOhms(jittered);
    const exact = formatOhms(reading.ohms);
    const beep = mode === 'continuity' && reading.ohms < 50;
    return {
      ...base,
      valid: true,
      ol: false,
      beep,
      raw: reading.ohms,
      display: formatted.text,
      exact: exact.text,
      unit: formatted.unit,
    };
  }

  const reading = measureVoltage(circuit, redNode, blackNode, { faultActive: true, powerOn });
  if (!reading.valid) {
    return { ...base, display: 'Err', exact: 'Err', warning: 'Meter could not settle', unstable: true };
  }
  const jittered = applyFactor(reading.volts, factor);
  return {
    ...base,
    valid: true,
    ol: false,
    raw: reading.volts,
    display: formatVoltage(jittered),
    exact: formatVoltage(reading.volts),
    unit: 'V',
    warning: powerOn ? null : 'Power is off',
  };
}

function exactReading(level, check, faultActive) {
  const circuit = plainCircuit(level);
  const redNode = pointNode(level, check.red);
  const blackNode = pointNode(level, check.black);
  if (check.mode === 'resistance' || check.mode === 'continuity') {
    const reading = measureResistance(circuit, redNode, blackNode, { faultActive, powerOn: false });
    if (!reading.valid) return 'Err';
    if (reading.ol) return OL_DISPLAY;
    return formatOhms(reading.ohms).text;
  }
  const reading = measureVoltage(circuit, redNode, blackNode, { faultActive, powerOn: true });
  if (reading.ol) return OL_DISPLAY;
  return formatVoltage(reading.volts);
}

export function buildFaultReport(level) {
  const rows = (level.checks || []).map((check) => ({
    label: check.label,
    mode: check.mode,
    healthy: exactReading(level, check, false),
    faulty: exactReading(level, check, true),
  }));
  const healthy = solveCircuit(plainCircuit(level), { faultActive: false, powerOn: true });
  const faulty = solveCircuit(plainCircuit(level), { faultActive: true, powerOn: true });
  return {
    rows,
    explanation: level.explanation,
    learn: level.learn,
    healthyLedCurrent: healthy.branches.D1?.current ?? 0,
    faultyLedCurrent: faulty.branches.D1?.current ?? 0,
  };
}

export function computeScore(input) {
  const measurements = input.measurements ?? 0;
  const hints = input.hints ?? 0;
  const poweredResistance = input.poweredResistance ?? 0;
  const wrongAttempts = input.wrongAttempts ?? 0;
  const elapsedSec = input.elapsedSec ?? 0;
  const streak = input.streak ?? 1;
  const extra = Math.max(0, measurements - 4) * 50;
  const hintPenalty = hints * 150;
  const powerPenalty = poweredResistance * 200;
  const wrongPenalty = wrongAttempts * 300;
  const timePenalty = Math.max(0, Math.floor(elapsedSec) - 60) * 2;
  const efficiency = measurements <= 4 ? 300 : 0;
  const noHints = hints === 0 ? 200 : 0;
  const subtotal = Math.max(
    0,
    1000 - extra - hintPenalty - powerPenalty - wrongPenalty - timePenalty + efficiency + noHints,
  );
  let multiplier = 1;
  if (wrongAttempts === 0) {
    if (streak >= 4) multiplier = 1.5;
    else if (streak === 3) multiplier = 1.25;
    else if (streak === 2) multiplier = 1.1;
  }
  const score = Math.round(subtotal * multiplier);
  const stars = score >= 900 ? 3 : score >= 600 ? 2 : 1;
  return {
    score,
    stars,
    multiplier,
    subtotal,
    parts: {
      base: 1000,
      extra,
      hintPenalty,
      powerPenalty,
      wrongPenalty,
      timePenalty,
      efficiency,
      noHints,
    },
  };
}

export function awardXp(previousBest, score) {
  const prior = previousBest || 0;
  const best = Math.max(prior, score);
  return { best, gained: best - prior };
}

export function rankFor(xp) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.min) current = rank;
  }
  const index = RANKS.indexOf(current);
  const next = RANKS[index + 1] || null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(1, (xp - current.min) / span) : 1;
  return { title: current.title, min: current.min, next: next ? next.title : null, nextAt: next ? next.min : null, progress };
}

export function diagnosisIsCorrect(level, componentId, faultType) {
  return Boolean(level.fault && level.fault.component === componentId && level.fault.type === faultType);
}
