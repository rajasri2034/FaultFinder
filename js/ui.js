/**
 * UI Rendering: Home screen, Case List, SVG Schematic with tap-friendly test points,
 * Virtual Multimeter display, and Measurements Log.
 */

import { rankFor } from './engine.js';
import { caseUnlocked } from './levels.js';

export function renderHome(save, cases) {
  const rank = rankFor(save.xp || 0);
  document.getElementById('hud-rank-badge').textContent = rank.title;
  document.getElementById('home-rank-label').textContent = `Rank: ${rank.title}`;
  document.getElementById('home-xp-label').textContent = rank.nextAt
    ? `${save.xp || 0} / ${rank.nextAt} XP`
    : `${save.xp || 0} XP (MAX)`;

  const pct = Math.min(100, Math.round((rank.progress || 0) * 100));
  document.getElementById('home-xp-fill').style.width = `${pct}%`;

  const caseList = document.getElementById('home-case-list');
  caseList.innerHTML = '';

  cases.forEach((lvl) => {
    const unlocked = caseUnlocked(lvl.number, save.solved);
    const best = save.best ? save.best[lvl.number] : null;
    const solved = save.solved ? save.solved[lvl.number] : false;
    const statusText = best ? `Best: ${best} pts` : solved ? 'Solved' : 'Ready';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-item-btn';
    btn.disabled = !unlocked;
    btn.dataset.caseNumber = String(lvl.number);
    btn.innerHTML = `
      <div>
        <div><strong>Case #${lvl.number}: ${lvl.title}</strong></div>
        <div class="case-item-meta">${lvl.chapter} · ${statusText}</div>
      </div>
      <div class="case-item-meta">${unlocked ? (solved ? '★★★' : 'Play →') : '🔒 Locked'}</div>
    `;
    caseList.appendChild(btn);
  });

  const lbEl = document.getElementById('home-leaderboard');
  const entries = save.leaderboard || [];
  if (entries.length === 0) {
    lbEl.innerHTML = '<p class="empty-log">Solve a case to post your first local score.</p>';
  } else {
    lbEl.innerHTML = entries
      .slice(0, 5)
      .map(
        (e, i) => `
        <div class="lb-row">
          <span>#${i + 1} ${e.name}</span>
          <strong>${e.score} pts</strong>
        </div>`
      )
      .join('');
  }
}

export function renderSchematic(level, state, onTapTestPoint) {
  const container = document.getElementById('schematic-container');
  const isLedLit =
    state.powerOn &&
    state.solvedSuccess &&
    level.components.some((c) => c.type === 'led');

  const r1 = level.components.find((c) => c.id === 'R1');
  const d1 = level.components.find((c) => c.id === 'D1');
  const supplyV = level.supply ? level.supply.voltage : 5;

  // Series-LED schematic layout aligned with level.layout.points (TP1:130, TP2:330, TP3:530)
  const glowColor = isLedLit ? '#22e58a' : '#475569';
  const glowClass = isLedLit ? 'led-glow-on' : '';

  const tpMap = Object.fromEntries(level.testPoints.map((tp) => [tp.id, tp]));
  const pts = (level.layout && level.layout.points) || {
    TP1: { x: 130, y: 150 },
    TP2: { x: 330, y: 150 },
    TP3: { x: 530, y: 150 },
  };

  const tpSvg = Object.entries(pts)
    .map(([tpId, pos]) => {
      const tp = tpMap[tpId] || { id: tpId, label: tpId, name: tpId };
      const hasRed = state.redTp === tpId;
      const hasBlack = state.blackTp === tpId;
      return `
        <g class="tp-node" data-tp="${tpId}" tabindex="0" role="button" aria-label="Test point ${tp.label} ${tp.name}">
          <circle class="tp-hit" cx="${pos.x}" cy="${pos.y}" r="26" />
          <circle class="tp-ring" cx="${pos.x}" cy="${pos.y}" r="11" fill="#0b1016" stroke="#9fb0c4" stroke-width="2" />
          <circle cx="${pos.x}" cy="${pos.y}" r="4.5" fill="#00e5ff" />
          <text x="${pos.x}" y="${pos.y - 18}" text-anchor="middle" fill="#eef4fb" font-size="12" font-weight="700" font-family="JetBrains Mono, monospace">${tp.label}</text>
          <text x="${pos.x}" y="${pos.y - 33}" text-anchor="middle" fill="#9fb0c4" font-size="10">${tp.name}</text>
          ${
            hasRed
              ? `<g class="probe-marker" transform="translate(${pos.x - 12}, ${pos.y + 20})">
                   <circle cx="0" cy="0" r="9" fill="#ff4d5a" stroke="#fff" stroke-width="1.5" />
                   <text x="0" y="3.5" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">+</text>
                 </g>`
              : ''
          }
          ${
            hasBlack
              ? `<g class="probe-marker" transform="translate(${pos.x + 12}, ${pos.y + 20})">
                   <circle cx="0" cy="0" r="9" fill="#0f172a" stroke="#e2e8f0" stroke-width="2" />
                   <text x="0" y="3.5" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">−</text>
                 </g>`
              : ''
          }
        </g>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg class="schematic-svg" viewBox="0 0 640 300" role="img" aria-label="${level.title} schematic">
      <!-- Wires -->
      <line x1="80" y1="210" x2="80" y2="150" stroke="#4f6b8a" stroke-width="3" stroke-linecap="round" />
      <line x1="80" y1="150" x2="195" y2="150" stroke="#4f6b8a" stroke-width="3" stroke-linecap="round" />
      <line x1="275" y1="150" x2="395" y2="150" stroke="#4f6b8a" stroke-width="3" stroke-linecap="round" />
      <line x1="455" y1="150" x2="530" y2="150" stroke="#4f6b8a" stroke-width="3" stroke-linecap="round" />
      <line x1="530" y1="150" x2="530" y2="250" stroke="#4f6b8a" stroke-width="3" stroke-linecap="round" />
      <line x1="80" y1="250" x2="530" y2="250" stroke="#4f6b8a" stroke-width="3" stroke-linecap="round" />

      <!-- Supply V1 -->
      <g transform="translate(80, 210)">
        <circle cx="0" cy="0" r="28" fill="#121c28" stroke="#00e5ff" stroke-width="2.2" />
        <text x="0" y="-4" text-anchor="middle" fill="#eef4fb" font-size="11" font-weight="700">V1</text>
        <text x="0" y="13" text-anchor="middle" fill="#00e5ff" font-size="12" font-family="JetBrains Mono, monospace">${supplyV}V</text>
      </g>

      <!-- Resistor R1 -->
      <g transform="translate(235, 150)">
        <rect x="-40" y="-16" width="80" height="32" rx="6" fill="#182433" stroke="#9fb0c4" stroke-width="2" />
        <text x="0" y="-23" text-anchor="middle" fill="#eef4fb" font-size="12" font-weight="700">${r1 ? r1.id : 'R1'}</text>
        <text x="0" y="5" text-anchor="middle" fill="#ffb020" font-size="12" font-family="JetBrains Mono, monospace">${r1 ? `${r1.value} Ω` : ''}</text>
      </g>

      <!-- LED D1 -->
      <g transform="translate(425, 150)" class="${glowClass}">
        ${isLedLit ? '<circle cx="0" cy="0" r="32" fill="rgba(34,229,138,0.22)" />' : ''}
        <polygon points="-16,-16 -16,16 14,0" fill="${isLedLit ? '#22e58a' : '#1e293b'}" stroke="${glowColor}" stroke-width="2.2" />
        <line x1="16" y1="-16" x2="16" y2="16" stroke="${glowColor}" stroke-width="2.5" />
        <text x="0" y="-23" text-anchor="middle" fill="#eef4fb" font-size="12" font-weight="700">${d1 ? d1.id : 'D1'}</text>
        <text x="0" y="32" text-anchor="middle" fill="#9fb0c4" font-size="11">Red LED</text>
      </g>

      ${tpSvg}
    </svg>
  `;

  container.querySelectorAll('.tp-node').forEach((node) => {
    const tpId = node.dataset.tp;
    node.addEventListener('click', () => onTapTestPoint(tpId));
    node.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        onTapTestPoint(tpId);
      }
    });
  });

  document.getElementById('legend-red-tp').textContent = state.redTp;
  document.getElementById('legend-black-tp').textContent = state.blackTp;
  document.getElementById('dmm-probes-label').textContent = `RED: ${state.redTp} · BLK: ${state.blackTp}`;
}

export function renderMeasurementsLog(measurements) {
  const logEl = document.getElementById('measurements-log');
  document.getElementById('log-count-badge').textContent = `${measurements.length} reading${measurements.length === 1 ? '' : 's'}`;

  if (measurements.length === 0) {
    logEl.innerHTML = '<p class="empty-log">No measurements taken yet. Tap a test point to probe the circuit.</p>';
    return;
  }

  logEl.innerHTML = [...measurements]
    .reverse()
    .map(
      (m, idx) => `
      <div class="log-item">
        <span>#${measurements.length - idx} · <strong>${m.mode.toUpperCase()}</strong> (${m.red} → ${m.black}, ${m.powerOn ? 'ON' : 'OFF'})</span>
        <span class="log-item-value ${m.warning ? 'warn' : ''}">${m.display}${m.unit ? ` ${m.unit}` : ''}</span>
      </div>`
    )
    .join('');
}