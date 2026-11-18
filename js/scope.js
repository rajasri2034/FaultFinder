/**
 * Waveform math for later oscilloscope cases.
 * Stage 1 does not mount a scope panel. No case here has a scope flag.
 * Samples are generated from parameters so a future readout can stay consistent
 * with the model: Vpp from the samples, frequency and duty from the spec.
 */

function sampleAt(params, phase) {
  const offset = params.offset || 0;
  const amplitude = params.amplitude || 0;
  if (params.type === 'zero') return 0;
  if (params.type === 'dc') return offset;
  if (params.type === 'sine') return offset + amplitude * Math.sin(2 * Math.PI * phase);
  if (params.type === 'square') {
    const duty = params.duty ?? 0.5;
    return offset + ((phase % 1) < duty ? amplitude : -amplitude);
  }
  throw new Error(`Unknown waveform type ${params.type}`);
}

export function generateWaveform(params, cycles = 1, samplesPerCycle = 100) {
  const count = Math.max(16, Math.round(samplesPerCycle * Math.max(1, cycles)));
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    const phase = (index / count) * cycles;
    samples.push(sampleAt(params, phase));
  }
  let max = samples[0];
  let min = samples[0];
  for (const value of samples) {
    if (value > max) max = value;
    if (value < min) min = value;
  }
  const duty = params.type === 'square' ? (params.duty ?? 0.5) : null;
  return {
    samples,
    vpp: max - min,
    frequency: params.frequency || 0,
    duty,
    type: params.type,
  };
}

export function measureWaveform(waveform) {
  return {
    vpp: waveform.vpp,
    frequency: waveform.frequency,
    duty: waveform.duty,
  };
}
