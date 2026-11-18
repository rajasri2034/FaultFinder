/**
 * FaultFinder Oscilloscope Engine & Midnight Neon Blueprint Canvas Renderer.
 * Supports sine, rectified, ripple, square/pwm, rc, dc/flat, and zero waveforms.
 */

export const SCOPE_LAB = {
  id: 'scope-lab',
  title: 'Scope Lab: Half-Wave Rectifier',
  chapter: 'Oscilloscope Preview (Case 12 Topology)',
  brief: 'Probe TP1 (AC Secondary) and TP2 (Rectifier Output) to see how an open diode D1 flattens the rectified output.',
  hasScope: true,
  defaultTp: 'TP2',
  faultyWaveforms: {
    TP1: { type: 'sine', amplitude: 12, frequency: 50, offset: 0, label: '12 Vpk 50 Hz AC Secondary' },
    TP2: { type: 'zero', amplitude: 0, frequency: 0, offset: 0, label: 'Output dead (D1 open)' },
    TP3: { type: 'zero', amplitude: 0, frequency: 0, offset: 0, label: 'Ground reference' },
  },
  healthyWaveforms: {
    TP1: { type: 'sine', amplitude: 12, frequency: 50, offset: 0, label: '12 Vpk 50 Hz AC Secondary' },
    TP2: { type: 'rectified', amplitude: 12, vf: 0.7, frequency: 50, offset: 0, label: 'Half-wave rectified (11.3 Vpk)' },
    TP3: { type: 'zero', amplitude: 0, frequency: 0, offset: 0, label: 'Ground reference' },
  },
};

export function generateWaveform(model = {}, cycles = 2, samplesPerCycle = 100) {
  const type = model.type || 'zero';
  const amplitude = Number(model.amplitude ?? 0);
  const frequency = Number(model.frequency ?? 0);
  const offset = Number(model.offset ?? 0);
  const duty = model.duty !== undefined ? Number(model.duty) : null;
  const vf = Number(model.vf ?? 0.7);
  const totalSamples = Math.max(2, Math.round(cycles * samplesPerCycle));
  const samples = new Array(totalSamples);

  for (let i = 0; i < totalSamples; i += 1) {
    const phase = (i / samplesPerCycle) % 1;
    let v = offset;

    if (type === 'sine') {
      v = offset + amplitude * Math.sin(2 * Math.PI * phase);
    } else if (type === 'rectified') {
      const raw = amplitude * Math.sin(2 * Math.PI * phase) - vf;
      v = offset + Math.max(0, raw);
    } else if (type === 'ripple') {
      const ripple = Number(model.ripple ?? amplitude);
      v = offset + (0.5 - phase) * ripple;
    } else if (type === 'square' || type === 'pwm') {
      const d = duty ?? 0.5;
      if (model.unipolar) {
        v = phase < d ? offset + amplitude : offset;
      } else {
        v = phase < d ? offset + amplitude : offset - amplitude;
      }
    } else if (type === 'rc') {
      const tau = 0.35;
      if (phase < 0.5) {
        v = offset + amplitude * (1 - Math.exp(-(phase / 0.5) / tau));
      } else {
        v = offset + amplitude * Math.exp(-((phase - 0.5) / 0.5) / tau);
      }
    } else if (type === 'dc' || type === 'flat') {
      v = offset;
    } else if (type === 'zero') {
      v = 0;
    }

    samples[i] = v;
  }

  let vmin = Infinity;
  let vmax = -Infinity;
  let sum = 0;
  for (const s of samples) {
    if (s < vmin) vmin = s;
    if (s > vmax) vmax = s;
    sum += s;
  }

  return {
    type,
    samples,
    frequency: type === 'dc' || type === 'flat' || type === 'zero' ? 0 : frequency,
    duty: type === 'square' || type === 'pwm' ? (duty ?? 0.5) : null,
    offset,
    vpp: vmax - vmin,
    vmin,
    vmax,
    vavg: sum / samples.length,
  };
}

export function measureWaveform(waveform) {
  if (!waveform || !Array.isArray(waveform.samples) || waveform.samples.length === 0) {
    return { vpp: 0, frequency: 0, duty: null, vmin: 0, vmax: 0, vavg: 0 };
  }
  return {
    vpp: waveform.vpp,
    frequency: waveform.frequency,
    duty: waveform.duty,
    vmin: waveform.vmin,
    vmax: waveform.vmax,
    vavg: waveform.vavg,
  };
}

export function sampleModelAtTime(model, tSec) {
  const type = model.type || 'zero';
  const amplitude = Number(model.amplitude ?? 0);
  const frequency = Number(model.frequency ?? 0);
  const offset = Number(model.offset ?? 0);
  const vf = Number(model.vf ?? 0.7);
  const duty = Number(model.duty ?? 0.5);

  if (type === 'zero') return 0;
  if (type === 'dc' || type === 'flat' || frequency <= 0) return offset;

  const phase = ((tSec * frequency) % 1 + 1) % 1;
  if (type === 'sine') return offset + amplitude * Math.sin(2 * Math.PI * phase);
  if (type === 'rectified') return offset + Math.max(0, amplitude * Math.sin(2 * Math.PI * phase) - vf);
  if (type === 'ripple') {
    const ripple = Number(model.ripple ?? amplitude);
    return offset + (0.5 - phase) * ripple;
  }
  if (type === 'square' || type === 'pwm') {
    if (model.unipolar) return phase < duty ? offset + amplitude : offset;
    return phase < duty ? offset + amplitude : offset - amplitude;
  }
  if (type === 'rc') {
    const tau = 0.35;
    if (phase < 0.5) return offset + amplitude * (1 - Math.exp(-(phase / 0.5) / tau));
    return offset + amplitude * Math.exp(-((phase - 0.5) / 0.5) / tau);
  }
  return offset;
}

export class OscilloscopeView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.voltsPerDiv = 5;
    this.timePerDivMs = 5;
    this.offsetDiv = 0;
    this.frozen = false;
    this.phaseTime = 0;
    this.rafId = null;
    this.lastFrameTs = 0;
    this.model = { type: 'zero', amplitude: 0, frequency: 0, offset: 0 };
  }

  setModel(model) {
    this.model = model || { type: 'zero', amplitude: 0, frequency: 0, offset: 0 };
  }

  start() {
    if (this.rafId) return;
    const loop = (ts) => {
      if (!this.lastFrameTs) this.lastFrameTs = ts;
      const dt = (ts - this.lastFrameTs) / 1000;
      this.lastFrameTs = ts;
      if (!this.frozen) {
        this.phaseTime += dt * 0.02;
      }
      this.draw();
      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  draw() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = '#111A33';
    ctx.fillRect(0, 0, w, h);

    const cols = 10;
    const rows = 8;
    ctx.strokeStyle = 'rgba(41, 54, 87, 0.85)';
    ctx.lineWidth = 1;

    for (let c = 1; c < cols; c += 1) {
      const x = (w / cols) * c;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r += 1) {
      const y = (h / rows) * r;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#293657';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    const totalTimeSec = (this.timePerDivMs / 1000) * cols;
    const pxPerDivY = h / rows;
    const centerY = h / 2 - this.offsetDiv * pxPerDivY;

    ctx.strokeStyle = '#00F5FF';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    const steps = Math.max(200, Math.round(w));
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * w;
      const t = (i / steps) * totalTimeSec + this.phaseTime;
      const v = sampleModelAtTime(this.model, t);
      const y = centerY - (v / this.voltsPerDiv) * pxPerDivY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}