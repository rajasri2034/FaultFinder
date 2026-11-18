/**
 * FaultFinder Main Application Controller & Screen Router (Stage 1 + Stage 2).
 */

import {
  awardXp,
  buildFaultReport,
  computeScore,
  diagnosisIsCorrect,
  METER_DELAY_MS,
  takeMeasurement,
} from './engine.js';
import { upsertLocal } from './leaderboard.js';
import { FAULT_LABELS, FAULT_TYPES, getCase, listCases } from './levels.js';
import { getMentorHint } from './mentor.js';
import { generateWaveform, measureWaveform, OscilloscopeView, SCOPE_LAB } from './scope.js?v=2';
import { loadSave, writeSave } from './storage.js';
import { renderHome, renderMeasurementsLog, renderSchematic } from './ui.js';

const MODE_MAP = {
  DCV: 'voltage',
  RES: 'resistance',
  CONT: 'continuity',
};

const state = {
  save: loadSave(),
  currentLevel: null,
  redTp: 'TP1',
  blackTp: 'TP3',
  activeProbe: 'red',
  mode: 'voltage',
  powerOn: true,
  lives: 3,
  hintsUsed: 0,
  poweredOhmPenalties: 0,
  wrongAttempts: 0,
  streak: 1,
  measurements: [],
  elapsedSeconds: 0,
  timerHandle: null,
  solvedSuccess: false,
  tutorialStep: 0,
  lastScoreResult: null,
  scopeTp: 'TP2',
  scopeFaulty: true,
  scopeView: null,
};

function playTone(freq, durationMs = 70) {
  if (!state.save.sound) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Ignore audio errors
  }
}

function showScreen(screenId) {
  document.getElementById('screen-home').classList.toggle('hidden', screenId !== 'home');
  document.getElementById('screen-workbench').classList.toggle('hidden', screenId !== 'workbench');
  document.getElementById('screen-scope-lab').classList.toggle('hidden', screenId !== 'scope-lab');
  document.getElementById('hud-stats').classList.toggle('hidden', screenId !== 'workbench');

  if (state.scopeView) {
    if (screenId === 'scope-lab') state.scopeView.start();
    else state.scopeView.stop();
  }
}

function updateScopeLab() {
  const bank = state.scopeFaulty ? SCOPE_LAB.faultyWaveforms : SCOPE_LAB.healthyWaveforms;
  const model = bank[state.scopeTp] || bank.TP2;
  const stats = measureWaveform(generateWaveform(model, 2, 100));

  document.getElementById('scope-probe-badge').textContent = `Probe: ${state.scopeTp}`;
  document.getElementById('scope-signal-desc').textContent = `${state.scopeTp}: ${model.label}`;
  document.getElementById('scope-vpp').textContent = `Vpp: ${stats.vpp.toFixed(2)} V`;
  document.getElementById('scope-freq').textContent = `Freq: ${stats.frequency} Hz`;

  const dutyEl = document.getElementById('scope-duty');
  if (stats.duty !== null) {
    dutyEl.textContent = `Duty: ${Math.round(stats.duty * 100)}%`;
    dutyEl.classList.remove('hidden');
  } else {
    dutyEl.classList.add('hidden');
  }

  document.querySelectorAll('.scope-tp-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tp === state.scopeTp);
  });

  if (state.scopeView) {
    state.scopeView.setModel(model);
  }
}

function openScopeLab() {
  if (!state.scopeView) {
    const canvas = document.getElementById('scope-canvas');
    state.scopeView = new OscilloscopeView(canvas);
  }
  state.scopeTp = SCOPE_LAB.defaultTp;
  state.scopeFaulty = true;
  document.getElementById('btn-scope-fault-toggle').textContent = 'State: Faulty (D1 Open)';
  showScreen('scope-lab');
  updateScopeLab();
}

function updateHud() {
  if (!state.currentLevel) return;
  document.getElementById('hud-case').textContent = `#${state.currentLevel.number}`;
  document.getElementById('hud-lives').textContent = '♥'.repeat(state.lives) + '♡'.repeat(3 - state.lives);
  document.getElementById('hud-hints').textContent = String(state.hintsUsed);

  const liveScore = computeScore({
    measurements: state.measurements.length,
    hints: state.hintsUsed,
    poweredResistance: state.poweredOhmPenalties,
    wrongAttempts: state.wrongAttempts,
    elapsedSec: state.elapsedSeconds,
    streak: state.streak,
  });
  document.getElementById('hud-score').textContent = String(liveScore.score);

  const mins = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(state.elapsedSeconds % 60).padStart(2, '0');
  document.getElementById('hud-timer').textContent = `${mins}:${secs}`;
}

function updatePowerUi() {
  const btn = document.getElementById('btn-power-toggle');
  btn.classList.toggle('is-on', state.powerOn);
  btn.setAttribute('aria-pressed', String(state.powerOn));
  document.getElementById('power-state-text').textContent = state.powerOn ? 'POWER ON' : 'POWER OFF';
}

function updateTutorialBanner() {
  const banner = document.getElementById('tutorial-banner');
  if (!state.currentLevel || !state.currentLevel.tutorial) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  const steps = state.currentLevel.tutorialSteps || [];
  const step = steps[Math.min(state.tutorialStep, Math.max(0, steps.length - 1))];
  document.getElementById('tutorial-step-text').textContent = step ? step.text : '';
}

function triggerMeasurement() {
  if (!state.currentLevel) return;
  const readoutEl = document.getElementById('dmm-readout');
  const statusEl = document.getElementById('dmm-status-badge');
  const warnEl = document.getElementById('dmm-warning');

  readoutEl.classList.add('flicker');
  statusEl.textContent = 'MEASURING...';

  window.setTimeout(() => {
    const res = takeMeasurement(state.currentLevel, {
      mode: state.mode,
      powerOn: state.powerOn,
      redId: state.redTp,
      blackId: state.blackTp,
    });

    readoutEl.classList.remove('flicker');
    readoutEl.textContent = res.unit ? `${res.display} ${res.unit}` : res.display;
    statusEl.textContent = res.warning ? 'WARNING' : 'HOLD';

    if (res.warning) {
      warnEl.textContent = res.warning;
      warnEl.classList.remove('hidden');
      if (res.penalty) state.poweredOhmPenalties += 1;
      playTone(220, 140);
    } else {
      warnEl.classList.add('hidden');
      playTone(res.beep ? 1200 : 680, 60);
    }

    state.measurements.push(res);
    renderMeasurementsLog(state.measurements);

    if (state.currentLevel.tutorial) {
      if (state.tutorialStep === 0 && res.red === 'TP2') state.tutorialStep = 2;
      else if (state.tutorialStep <= 2 && res.mode === 'voltage' && res.red === 'TP2') state.tutorialStep = 3;
      updateTutorialBanner();
    }

    updateHud();
  }, METER_DELAY_MS);
}

function startCase(caseNumber) {
  let lvl;
  try {
    lvl = getCase(caseNumber);
  } catch {
    return;
  }

  if (state.timerHandle) clearInterval(state.timerHandle);

  state.currentLevel = lvl;
  state.redTp = 'TP1';
  state.blackTp = lvl.defaultBlack || 'TP3';
  state.activeProbe = 'red';
  state.mode = 'voltage';
  state.powerOn = true;
  state.lives = 3;
  state.hintsUsed = 0;
  state.poweredOhmPenalties = 0;
  state.wrongAttempts = 0;
  state.measurements = [];
  state.elapsedSeconds = 0;
  state.solvedSuccess = false;
  state.tutorialStep = 0;

  document.getElementById('case-chapter').textContent = `Chapter: ${lvl.chapter}`;
  document.getElementById('case-title').textContent = `Case #${lvl.number}: ${lvl.title}`;
  document.getElementById('case-brief').textContent = lvl.brief;
  document.getElementById('mentor-box').classList.add('hidden');
  document.getElementById('dmm-warning').classList.add('hidden');
  document.getElementById('dmm-readout').textContent = '0.00 V';
  document.getElementById('btn-save-score').textContent = 'Save';

  document.querySelectorAll('.dmm-mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === 'DCV');
  });
  document.getElementById('dmm-mode-label').textContent = 'DC VOLTS';

  updatePowerUi();
  updateTutorialBanner();
  renderSchematic(lvl, state, handleTapTestPoint);
  renderMeasurementsLog(state.measurements);
  updateHud();
  showScreen('workbench');

  state.timerHandle = window.setInterval(() => {
    state.elapsedSeconds += 1;
    updateHud();
  }, 1000);
}

function handleTapTestPoint(tpId) {
  if (state.activeProbe === 'red') state.redTp = tpId;
  else state.blackTp = tpId;

  if (state.currentLevel && state.currentLevel.tutorial && state.tutorialStep === 0 && tpId === 'TP2') {
    state.tutorialStep = 1;
    updateTutorialBanner();
  }

  renderSchematic(state.currentLevel, state, handleTapTestPoint);
  triggerMeasurement();
}

function openDiagnosisModal() {
  const lvl = state.currentLevel;
  if (!lvl) return;

  const selectComp = document.getElementById('select-component');
  selectComp.innerHTML = lvl.components
    .map((c) => `<option value="${c.id}">${c.id} (${c.name || c.type})</option>`)
    .join('');

  const selectFault = document.getElementById('select-fault-type');
  selectFault.innerHTML = FAULT_TYPES
    .map((ft) => `<option value="${ft}">${FAULT_LABELS[ft] || ft}</option>`)
    .join('');

  document.getElementById('diag-feedback').classList.add('hidden');
  document.getElementById('modal-diagnosis').classList.remove('hidden');
}

function handleDiagnosisSubmit(ev) {
  ev.preventDefault();
  const lvl = state.currentLevel;
  const compId = document.getElementById('select-component').value;
  const faultType = document.getElementById('select-fault-type').value;
  const feedbackEl = document.getElementById('diag-feedback');
  const modalCard = document.querySelector('#modal-diagnosis .modal-card');

  if (diagnosisIsCorrect(lvl, compId, faultType)) {
    if (state.timerHandle) clearInterval(state.timerHandle);
    state.solvedSuccess = true;
    state.powerOn = true;
    updatePowerUi();
    renderSchematic(lvl, state, handleTapTestPoint);
    playTone(980, 140);

    const scoreRes = computeScore({
      measurements: state.measurements.length,
      hints: state.hintsUsed,
      poweredResistance: state.poweredOhmPenalties,
      wrongAttempts: state.wrongAttempts,
      elapsedSec: state.elapsedSeconds,
      streak: state.streak,
    });
    state.lastScoreResult = scoreRes;
    if (state.wrongAttempts === 0) state.streak += 1;

    const prevBest = state.save.best[lvl.number] || 0;
    const xpRes = awardXp(prevBest, scoreRes.score);
    state.save.best[lvl.number] = xpRes.best;
    state.save.solved[lvl.number] = true;
    state.save.xp = (state.save.xp || 0) + xpRes.gained;
    writeSave(state.save);

    const report = buildFaultReport(lvl);
    document.getElementById('modal-diagnosis').classList.add('hidden');
    document.getElementById('result-stars').textContent = '★'.repeat(scoreRes.stars) + '☆'.repeat(3 - scoreRes.stars);
    document.getElementById('result-title').textContent = `Case #${lvl.number}: ${lvl.title} — Solved!`;
    document.getElementById('result-explanation').textContent = report.explanation;
    document.getElementById('result-learn').innerHTML = `<strong>Learn:</strong> ${report.learn}`;
    document.getElementById('result-score-breakdown').innerHTML = `
      Base: ${scoreRes.parts.base} | Efficiency Bonus: +${scoreRes.parts.efficiency} | No-Hint Bonus: +${scoreRes.parts.noHints}<br/>
      Penalties: -${scoreRes.parts.extra + scoreRes.parts.hintPenalty + scoreRes.parts.powerPenalty + scoreRes.parts.wrongPenalty + scoreRes.parts.timePenalty}<br/>
      <strong>Final Score: ${scoreRes.score} pts (+${xpRes.gained} XP)</strong>
    `;

    const allCases = listCases();
    const nextLvl = allCases.find((c) => c.number === lvl.number + 1);
    document.getElementById('btn-next-case').textContent = nextLvl
      ? `Next: Case #${nextLvl.number} →`
      : 'Back to Home';

    document.getElementById('modal-result').classList.remove('hidden');
    return;
  }

  state.wrongAttempts += 1;
  state.streak = 1;
  state.lives = Math.max(0, state.lives - 1);
  playTone(180, 180);
  updateHud();

  modalCard.classList.remove('shake');
  void modalCard.offsetWidth;
  modalCard.classList.add('shake');

  if (state.lives === 0) {
    feedbackEl.textContent = 'Out of lives! Resetting case with full lives so you can try again.';
    feedbackEl.classList.remove('hidden');
    window.setTimeout(() => {
      document.getElementById('modal-diagnosis').classList.add('hidden');
      startCase(lvl.number);
    }, 1200);
  } else {
    feedbackEl.textContent = `Not quite — ${compId} (${FAULT_LABELS[faultType] || faultType}) doesn't match the measurements. -300 pts, ${state.lives} lives left.`;
    feedbackEl.classList.remove('hidden');
  }
}

function bindEvents() {
  document.getElementById('btn-home-logo').addEventListener('click', () => {
    if (state.timerHandle) clearInterval(state.timerHandle);
    renderHome(state.save, listCases());
    showScreen('home');
  });

  document.getElementById('btn-start-investigation').addEventListener('click', () => {
    startCase(state.save.solved && state.save.solved[0] ? 1 : 0);
  });

  document.getElementById('btn-skip-to-case1').addEventListener('click', () => startCase(1));
  document.getElementById('btn-skip-tutorial').addEventListener('click', () => startCase(1));
  document.getElementById('btn-open-scope-lab').addEventListener('click', openScopeLab);

  document.getElementById('btn-scope-back-home').addEventListener('click', () => {
    renderHome(state.save, listCases());
    showScreen('home');
  });

  document.getElementById('btn-scope-fault-toggle').addEventListener('click', (ev) => {
    state.scopeFaulty = !state.scopeFaulty;
    ev.currentTarget.textContent = state.scopeFaulty ? 'State: Faulty (D1 Open)' : 'State: Healthy';
    updateScopeLab();
  });

  document.getElementById('btn-dismiss-scope-hint').addEventListener('click', () => {
    document.getElementById('scope-first-hint').classList.add('hidden');
  });

  document.querySelectorAll('.scope-tp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.scopeTp = btn.dataset.tp;
      updateScopeLab();
    });
  });

  document.querySelectorAll('.scope-tp').forEach((node) => {
    node.addEventListener('click', () => {
      state.scopeTp = node.dataset.scopeTp;
      updateScopeLab();
    });
  });

  document.getElementById('scope-vdiv').addEventListener('change', (ev) => {
    if (state.scopeView) state.scopeView.voltsPerDiv = Number(ev.target.value);
  });

  document.getElementById('scope-tdiv').addEventListener('change', (ev) => {
    if (state.scopeView) state.scopeView.timePerDivMs = Number(ev.target.value);
  });

  document.getElementById('scope-pos').addEventListener('input', (ev) => {
    const val = Number(ev.target.value);
    document.getElementById('scope-pos-val').textContent = val.toFixed(1);
    if (state.scopeView) state.scopeView.offsetDiv = val;
  });

  document.getElementById('btn-scope-freeze').addEventListener('click', (ev) => {
    if (!state.scopeView) return;
    state.scopeView.frozen = !state.scopeView.frozen;
    ev.currentTarget.textContent = state.scopeView.frozen ? 'Resume' : 'Freeze';
  });

  document.getElementById('home-case-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.case-item-btn');
    if (btn && !btn.disabled) {
      startCase(Number(btn.dataset.caseNumber));
    }
  });

  document.getElementById('btn-select-red').addEventListener('click', () => {
    state.activeProbe = 'red';
    document.getElementById('btn-select-red').classList.add('active-red');
    document.getElementById('btn-select-black').classList.remove('active-black');
  });

  document.getElementById('btn-select-black').addEventListener('click', () => {
    state.activeProbe = 'black';
    document.getElementById('btn-select-black').classList.add('active-black');
    document.getElementById('btn-select-red').classList.remove('active-red');
  });

  document.getElementById('btn-power-toggle').addEventListener('click', () => {
    state.powerOn = !state.powerOn;
    updatePowerUi();
    renderSchematic(state.currentLevel, state, handleTapTestPoint);
    triggerMeasurement();
  });

  document.querySelectorAll('.dmm-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = MODE_MAP[btn.dataset.mode] || 'voltage';
      document.querySelectorAll('.dmm-mode-btn').forEach((b) => b.classList.toggle('active', b === btn));
      const modeNames = { voltage: 'DC VOLTS', resistance: 'RESISTANCE (Ω)', continuity: 'CONTINUITY' };
      document.getElementById('dmm-mode-label').textContent = modeNames[state.mode];
      triggerMeasurement();
    });
  });

  document.getElementById('btn-take-reading').addEventListener('click', triggerMeasurement);
  document.getElementById('btn-open-diagnosis').addEventListener('click', openDiagnosisModal);
  document.getElementById('btn-close-diag').addEventListener('click', () => {
    document.getElementById('modal-diagnosis').classList.add('hidden');
  });
  document.getElementById('btn-cancel-diag').addEventListener('click', () => {
    document.getElementById('modal-diagnosis').classList.add('hidden');
  });
  document.getElementById('form-diagnosis').addEventListener('submit', handleDiagnosisSubmit);

  document.getElementById('btn-ask-mentor').addEventListener('click', async () => {
    if (!state.currentLevel) return;
    state.hintsUsed += 1;
    const hintText = await getMentorHint(state.currentLevel, state.measurements, Math.min(3, state.hintsUsed));
    const box = document.getElementById('mentor-box');
    box.textContent = `Mentor (Hint ${state.hintsUsed}): ${hintText}`;
    box.classList.remove('hidden');
    updateHud();
  });

  document.getElementById('btn-back-cases').addEventListener('click', () => {
    if (state.timerHandle) clearInterval(state.timerHandle);
    renderHome(state.save, listCases());
    showScreen('home');
  });

  document.getElementById('btn-save-score').addEventListener('click', () => {
    if (!state.currentLevel || !state.lastScoreResult) return;
    const nick = document.getElementById('input-nickname').value;
    const res = upsertLocal(state.save.leaderboard, nick, state.lastScoreResult.score);
    state.save.leaderboard = res.entries;
    writeSave(state.save);
    document.getElementById('btn-save-score').textContent = 'Saved ✓';
  });

  document.getElementById('btn-result-home').addEventListener('click', () => {
    document.getElementById('modal-result').classList.add('hidden');
    renderHome(state.save, listCases());
    showScreen('home');
  });

  document.getElementById('btn-next-case').addEventListener('click', () => {
    document.getElementById('modal-result').classList.add('hidden');
    const allCases = listCases();
    const nextLvl = allCases.find((c) => c.number === state.currentLevel.number + 1);
    if (nextLvl) {
      startCase(nextLvl.number);
    } else {
      renderHome(state.save, allCases);
      showScreen('home');
    }
  });

  document.getElementById('btn-how-to-play').addEventListener('click', () => {
    document.getElementById('modal-how-to').classList.remove('hidden');
  });
  document.getElementById('btn-close-howto').addEventListener('click', () => {
    document.getElementById('modal-how-to').classList.add('hidden');
  });
  document.getElementById('btn-ok-howto').addEventListener('click', () => {
    document.getElementById('modal-how-to').classList.add('hidden');
  });

  document.getElementById('btn-sound-toggle').addEventListener('click', (ev) => {
    state.save.sound = !state.save.sound;
    writeSave(state.save);
    ev.currentTarget.textContent = state.save.sound ? '🔊' : '🔇';
    ev.currentTarget.setAttribute('aria-pressed', String(state.save.sound));
  });

  document.getElementById('btn-close-tests').addEventListener('click', () => {
    document.getElementById('test-runner-panel').classList.add('hidden');
  });
}

async function maybeRunBrowserTests() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return;
  const panel = document.getElementById('test-runner-panel');
  const out = document.getElementById('test-output');
  panel.classList.remove('hidden');
  try {
    const mod = await import('../tests/run-tests.js');
    const report = await mod.runAllTests({
      log: (line) => {
        out.textContent += `${line}\n`;
      },
    });
    if (!out.textContent.trim()) {
      out.textContent = report.logs.join('\n');
    }
  } catch (err) {
    out.textContent = `Test runner error: ${err.message}`;
  }
}

bindEvents();
renderHome(state.save, listCases());
showScreen('home');
maybeRunBrowserTests();