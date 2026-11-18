/**
 * Rule-based mentor. No API key.
 *
 * To plug in an LLM later, set MENTOR_API_URL and uncomment the fetch block.
 * getMentorHint must keep returning Promise<string>.
 */

export const MENTOR_API_URL = '';

function latestVoltage(measurements) {
  for (let index = measurements.length - 1; index >= 0; index -= 1) {
    const entry = measurements[index];
    if (entry.mode === 'voltage' && entry.valid && Number.isFinite(entry.raw)) return entry;
  }
  return null;
}

function contextual(level, measurements) {
  const last = latestVoltage(measurements);
  if (!last) return '';
  const supply = level.supply?.voltage ?? 0;
  const shown = `${last.display} V`;
  const acrossLed = last.red === 'TP2' && last.black === 'TP3';
  const acrossResistor = (last.red === 'TP1' && last.black === 'TP2') || (last.red === 'TP2' && last.black === 'TP1');
  if (acrossLed && Math.abs(last.raw) < 0.25) {
    return `You measured ${shown} across the LED, and the supply is ${supply.toFixed(2)} V. The LED is not conducting. Where is the voltage sitting instead?`;
  }
  if (acrossLed && Math.abs(Math.abs(last.raw) - supply) < 0.35) {
    return `You measured about the full supply across the LED (${shown}). A healthy red LED would sit near 2 V, not on the rail.`;
  }
  if (acrossLed && Math.abs(Math.abs(last.raw) - 2) < 0.35) {
    return `That ${shown} reading is a normal red LED drop. This LED is conducting. Look at the other part.`;
  }
  if (acrossResistor && Math.abs(Math.abs(last.raw) - supply) < 0.35) {
    return `You measured ${shown} across R1, close to the full ${supply.toFixed(2)} V supply. That is a lot for a healthy series resistor on a lit LED.`;
  }
  if (acrossResistor && Math.abs(last.raw) < 0.25) {
    return `You measured ${shown} across R1. Little voltage there means little current in the resistor. Check the LED voltage next.`;
  }
  return '';
}

function ruleHint(level, measurements, hintLevel) {
  const scripted = (level.hints && level.hints[hintLevel - 1]) || 'Measure the supply first, then the voltage across each series part.';
  const extra = contextual(level, measurements);
  if (hintLevel <= 1 || !extra) return scripted;
  if (hintLevel === 2) return extra;
  return `${scripted} ${extra}`;
}

export function getMentorHint(level, measurements, hintLevel) {
  const step = Math.min(3, Math.max(1, hintLevel | 0));
  // Optional LLM plug-in. Leave MENTOR_API_URL empty to stay on the offline mentor.
  // if (MENTOR_API_URL) {
  //   return fetch(MENTOR_API_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       caseId: level.id,
  //       hintLevel: step,
  //       measurements: (measurements || []).map((entry) => ({
  //         mode: entry.mode,
  //         red: entry.red,
  //         black: entry.black,
  //         display: entry.display,
  //       })),
  //     }),
  //   }).then((response) => {
  //     if (!response.ok) throw new Error('mentor unavailable');
  //     return response.json();
  //   }).then((data) => String(data.hint || ''));
  // }
  return Promise.resolve(ruleHint(level, measurements || [], step));
}
