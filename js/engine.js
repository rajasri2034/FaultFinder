import { measureContinuity, measureResistance, measureVoltage } from './solver.js';

export const METER_DELAY_MS = 300;
export const OL_DISPLAY = 'OL';

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function meterFactor(caseId) {
  const h = hashString(String(caseId || 'case'));
  return 0.995 + ((h % 1001) / 1000) * 0.01;
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

export function formatVoltage(v) {
  return `${v.toFixed(2)}`;
}

export function formatOhms(ohms) {
  if (!Number.isFinite(ohms)) return OL_DISPLAY;
  if (ohms >= 1e6) return `${(ohms / 1e6).toFixed(2)} MΩ`;
  if (ohms >= 1e3) return `${(ohms / 1e3).toFixed(2)} kΩ`;
  return `${ohms.toFixed(ohms < 10 ? 2 : 1)} Ω`;
}

export function takeMeasurement(level, { mode = 'voltage', powerOn = true, redId, blackId }) {
  const circuit = plainCircuit(level);
  const redTp = level.testPoints.find((t) => t.id === redId);
  const blackTp = level.testPoints.find((t) => t.id === blackId);
  if (!redTp || !blackTp) throw new Error('Invalid test point');

  const opts = { faultActive: true, powerOn };
  if (mode === 'voltage') {
    const res = measureVoltage(circuit, redTp.node, blackTp.node, opts);
    const val = res.valid ? res.volts : 0;
    return {
      mode,
      powerOn,
      red: redId,
      black: blackId,
      valid: res.valid,
      ol: false,
      raw: val,
      display: formatVoltage(val),
      unit: 'V',
      warning: null,
      penalty: 0,
      beep: false,
    };
  }
  if (mode === 'resistance') {
    const res = measureResistance(circuit, redTp.node, blackTp.node, opts);
    if (!res.valid) {
      return {
        mode,
        powerOn,
        red: redId,
        black: blackId,
        valid: false,
        ol: false,
        raw: null,
        display: 'ERR',
        unit: '',
        warning: res.warning || 'Turn power OFF before measuring resistance!',
        penalty: 200,
        beep: false,
      };
    }
    return {
      mode,
      powerOn,
      red: redId,
      black: blackId,
      valid: true,
      ol: res.ol,
      raw: res.ohms,
      display: res.ol ? OL_DISPLAY : formatOhms(res.ohms),
      unit: '',
      warning: null,
      penalty: 0,
      beep: false,
    };
  }
  const res = measureContinuity(circuit, redTp.node, blackTp.node, opts);
  if (!res.valid) {
    return {
      mode,
      powerOn,
      red: redId,
      black: blackId,
      valid: false,
      ol: false,
      raw: null,
      display: 'ERR',
      unit: '',
      warning: res.warning || 'Turn power OFF before measuring continuity!',
      penalty: 200,
      beep: false,
    };
  }
  return {
    mode,
    powerOn,
    red: redId,
    black: blackId,
    valid: true,
    ol: res.ol,
    raw: res.ohms,
    display: res.ol ? OL_DISPLAY : formatOhms(res.ohms),
    unit: res.beep ? 'BEEP' : '',
    warning: null,
    penalty: 0,
    beep: res.beep,
  };
}

export function buildFaultReport(level) {
  const { component, type } = level.fault;
  return {
    explanation: level.explanation || `${component} is ${type}.`,
    learn: level.learn || '',
  };
}

export function computeScore({ measurements = 0, hints = 0, poweredResistance = 0, wrongAttempts = 0, elapsedSec = 0, streak = 1 }) {
  const base = 1000;
  const efficiency = measurements <= 4 ? 300 : Math.max(0, 300 - (measurements - 4) * 50);
  const noHints = hints === 0 ? 200 : 0;
  const extra = measurements > 6 ? (measurements - 6) * 25 : 0;
  const hintPenalty = hints * 150;
  const powerPenalty = poweredResistance * 200;
  const wrongPenalty = wrongAttempts * 300;
  const timePenalty = elapsedSec > 180 ? Math.min(200, Math.floor((elapsedSec - 180) / 10) * 10) : 0;
  const raw = base + efficiency + noHints - extra - hintPenalty - powerPenalty - wrongPenalty - timePenalty;
  const streakMult = streak > 1 ? 1 + Math.min(0.25, (streak - 1) * 0.05) : 1;
  const score = Math.max(100, Math.round(raw * streakMult));
  const stars = score >= 1300 ? 3 : score >= 900 ? 2 : 1;
  return { score, stars, streakMult, parts: { base, efficiency, noHints, extra, hintPenalty, powerPenalty, wrongPenalty, timePenalty } };
}

export function awardXp(prevBest, score) {
  const best = Math.max(prevBest || 0, score);
  const gained = Math.max(0, best - (prevBest || 0));
  return { best, gained };
}

export function rankFor(xp) {
  const ranks = [
    { title: 'Apprentice', at: 0 },
    { title: 'Technician', at: 2000 },
    { title: 'Engineer', at: 5000 },
    { title: 'Senior Engineer', at: 10000 },
    { title: 'Master Detective', at: 20000 },
  ];
  let idx = 0;
  for (let i = 0; i < ranks.length; i += 1) {
    if (xp >= ranks[i].at) idx = i;
  }
  const cur = ranks[idx];
  const next = ranks[idx + 1] || null;
  const progress = next ? (xp - cur.at) / (next.at - cur.at) : 1;
  return { title: cur.title, nextAt: next ? next.at : null, progress };
}

export function diagnosisIsCorrect(level, compId, faultType) {
  return Boolean(level.fault && level.fault.component === compId && level.fault.type === faultType);
}

export function buildShareCardText({ nickname = 'Detective', score = 0, rank = 'Apprentice', casesSolved = 0, stars = 3 } = {}) {
  const starStr = '★'.repeat(Math.max(0, Math.min(3, stars))) + '☆'.repeat(Math.max(0, 3 - stars));
  return `CIRCUIT SLEUTH – The Electronics Detective | ${nickname} | Score: ${score} pts (${starStr}) | Rank: ${rank} | Cases Solved: ${casesSolved}/21`;
}

export async function shareResults(summary, { navigatorObj = typeof navigator !== 'undefined' ? navigator : null } = {}) {
  const text = buildShareCardText(summary);
  if (navigatorObj && typeof navigatorObj.share === 'function') {
    try {
      await navigatorObj.share({ title: 'CIRCUIT SLEUTH Results', text });
      return { ok: true, method: 'share', text };
    } catch {
      // Fall through to clipboard
    }
  }
  if (navigatorObj && navigatorObj.clipboard && typeof navigatorObj.clipboard.writeText === 'function') {
    try {
      await navigatorObj.clipboard.writeText(text);
      return { ok: true, method: 'clipboard', text };
    } catch {
      // Fall through to text fallback
    }
  }
  return { ok: true, method: 'text', text };
}