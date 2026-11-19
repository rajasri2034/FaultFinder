/**
 * Rule-based AI Mentor hint system (works 100% offline with zero API keys).
 * Returns a Promise<string> so an external LLM endpoint can be plugged in later.
 * Never reads level.expected or level.fault.
 */

function summarizeLog(measurements = []) {
  const count = measurements.length;
  const last = count > 0 ? measurements[count - 1] : null;
  const hasPowerOffOhm = measurements.some((m) => (m.mode === 'resistance' || m.mode === 'continuity') && !m.powerOn);
  const hasVoltage = measurements.some((m) => m.mode === 'voltage' && m.powerOn);
  const poweredOhmWarn = measurements.find((m) => m.warning);
  const shortReading = measurements.find((m) => (m.mode === 'resistance' || m.mode === 'continuity') && !m.ol && typeof m.raw === 'number' && m.raw < 1);
  const openReading = measurements.find((m) => m.mode === 'resistance' && m.ol);
  const zeroVoltReading = measurements.find((m) => m.mode === 'voltage' && m.valid && Math.abs(m.raw) < 0.05 && m.red !== m.black);
  return { count, last, hasPowerOffOhm, hasVoltage, poweredOhmWarn, shortReading, openReading, zeroVoltReading };
}

export async function getMentorHint(level, measurements = [], hintLevel = 1) {
  const safeLevel = Math.max(1, Math.min(3, Number(hintLevel) || 1));
  const log = summarizeLog(measurements);
  const baseHints = Array.isArray(level?.hints) ? level.hints : [];
  const checks = Array.isArray(level?.checks) ? level.checks : [];

  if (log.count === 0) {
    if (safeLevel === 1) {
      return `You haven't taken any measurements yet. Start with DC V (Power ON) across the supply or ${checks[0]?.label || 'the first test point'} to see where voltage is present.`;
    }
    if (safeLevel === 2) {
      return baseHints[1] || `Measure DC voltage at ${checks[0]?.red || 'TP2'} relative to ${level?.defaultBlack || 'GND'} first, then compare with upstream nodes.`;
    }
    return baseHints[2] || `Take a DC V reading at ${checks[0]?.red || 'TP2'} and then switch Power OFF to verify resistance (Ω) across the suspect branch.`;
  }

  if (safeLevel === 1) {
    if (log.poweredOhmWarn) {
      return `Your last ${log.poweredOhmWarn.mode} check was blocked because Bench Supply was ON. Switch POWER OFF before measuring Ω or Continuity.`;
    }
    if (log.zeroVoltReading) {
      return `You measured ${log.zeroVoltReading.display} V at ${log.zeroVoltReading.red}→${log.zeroVoltReading.black}. Ask yourself whether current is being blocked upstream or shorted to ground downstream.`;
    }
    if (log.last && log.last.mode === 'voltage') {
      return `You read ${log.last.display} V between ${log.last.red} and ${log.last.black}. ${baseHints[0] || 'Compare this with what a healthy stage should read.'}`;
    }
    return baseHints[0] || 'Compare your measured node voltages against the supply rail to narrow down which branch is misbehaving.';
  }

  if (safeLevel === 2) {
    if (!log.hasPowerOffOhm && checks.some((c) => c.mode === 'resistance')) {
      const resCheck = checks.find((c) => c.mode === 'resistance');
      return `You have ${log.count} reading(s), but haven't checked passive resistance yet. Switch POWER OFF and measure Ω at ${resCheck.red}→${resCheck.black} (${resCheck.label}).`;
    }
    if (log.openReading) {
      return `Your Ω reading at ${log.openReading.red}→${log.openReading.black} showed OL (open circuit). ${baseHints[1] || 'Check which component sits directly between those two test points.'}`;
    }
    if (log.shortReading) {
      return `Your Ω reading at ${log.shortReading.red}→${log.shortReading.black} was ${log.shortReading.display} (near 0 Ω). ${baseHints[1] || 'Look at the parallel component across those nodes.'}`;
    }
    return baseHints[1] || 'Trace from the supply rail toward ground and isolate the exact component between the last good node and the first bad node.';
  }

  const nextCheck = checks.find(
    (c) => !measurements.some((m) => m.mode === c.mode && m.red === c.red && m.black === c.black)
  );
  if (nextCheck) {
    return `${baseHints[2] || 'You are close.'} Try measuring ${nextCheck.mode.toUpperCase()} at ${nextCheck.red}→${nextCheck.black} (${nextCheck.label}) to confirm your diagnosis.`;
  }
  return baseHints[2] || 'You already have the key readings in your log—match the abnormal voltage drop or OL/0 Ω reading to the component directly across those test points.';
}