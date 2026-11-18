/**
 * UI Rendering: Midnight Neon Blueprint Work Orders, Certification Progress,
 * 2D Cel-Shaded PCB Schematics (Cases 0-10), and Measurements Log.
 */

import { rankFor } from './engine.js';
import { caseUnlocked } from './levels.js';

function getOrderIcon(lvl) {
  if (lvl.components.some((c) => c.type === 'motor')) return 'M1';
  if (lvl.components.some((c) => c.type === 'regulator')) return 'IC';
  if (lvl.components.some((c) => c.type === 'npn')) return 'Q1';
  if (lvl.components.some((c) => c.type === 'capacitor')) return 'C1';
  if (lvl.components.some((c) => c.type === 'led')) return 'LED';
  return 'R/V';
}

export function renderHome(save, cases) {
  const rank = rankFor(save.xp || 0);
  document.getElementById('hud-rank-badge').textContent = rank.title;
  document.getElementById('home-rank-label').textContent = `Certification: ${rank.title}`;
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
    const statusText = best ? `PASS · ${best} pts` : solved ? 'PASS' : 'OPEN';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-item-btn';
    btn.disabled = !unlocked;
    btn.dataset.caseNumber = String(lvl.number);
    btn.innerHTML = `
      <div class="work-order-left">
        <span class="work-order-icon">${getOrderIcon(lvl)}</span>
        <div>
          <div><strong>WO-${String(lvl.number).padStart(2, '0')} · ${lvl.title}</strong></div>
          <div class="case-item-meta">${lvl.chapter} · ${statusText}</div>
        </div>
      </div>
      <div class="case-item-meta">${unlocked ? (solved ? '★★★' : 'INSPECT →') : '🔒 LOCKED'}</div>
    `;
    caseList.appendChild(btn);
  });

  const lbEl = document.getElementById('home-leaderboard');
  const entries = save.leaderboard || [];
  if (entries.length === 0) {
    lbEl.innerHTML = '<p class="empty-log">Complete a work order to log your first score.</p>';
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

  const supplyV = level.supply ? level.supply.voltage : 5;
  const n = level.number;
  const tpMap = Object.fromEntries(level.testPoints.map((tp) => [tp.id, tp]));

  let tpCoords = { TP1: { x: 130, y: 95 }, TP2: { x: 320, y: 95 }, TP3: { x: 490, y: 195 } };
  let boardSvg = '';

  if (n <= 2 || n === 4) {
    const r1 = level.components.find((c) => c.id === 'R1');
    const ledColor = isLedLit ? '#00F5FF' : '#293657';
    boardSvg = `
      <line x1="75" y1="145" x2="75" y2="95" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="95" x2="185" y2="95" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="265" y1="95" x2="405" y2="95" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="405" y1="95" x2="490" y2="95" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="490" y1="95" x2="490" y2="195" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="195" x2="490" y2="195" stroke="#293657" stroke-width="2.5" />
      <g transform="translate(75, 145)">
        <circle cx="0" cy="0" r="24" fill="#111A33" stroke="#F7E600" stroke-width="2" />
        <text x="0" y="-3" text-anchor="middle" fill="#EAF0FF" font-size="10" font-weight="700">V1</text>
        <text x="0" y="11" text-anchor="middle" fill="#F7E600" font-size="11" font-family="JetBrains Mono, monospace">${supplyV}V</text>
      </g>
      <g transform="translate(225, 95)">
        <rect x="-40" y="-14" width="80" height="28" rx="3" fill="#1B2745" stroke="#EAF0FF" stroke-width="1.8" />
        <rect x="-24" y="-14" width="5" height="28" fill="#F7E600" />
        <rect x="-10" y="-14" width="5" height="28" fill="#00F5FF" />
        <rect x="6" y="-14" width="5" height="28" fill="#FF2D95" />
        <text x="0" y="-20" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700">R1 (${r1.value} Ω)</text>
      </g>
      <g transform="translate(405, 95)" class="${isLedLit ? 'led-glow-on' : ''}">
        ${isLedLit ? '<circle cx="0" cy="0" r="28" fill="rgba(0,245,255,0.2)" />' : ''}
        <polygon points="-14,-14 -14,14 14,0" fill="${isLedLit ? '#00F5FF' : '#1B2745'}" stroke="${ledColor}" stroke-width="2" />
        <line x1="16" y1="-14" x2="16" y2="14" stroke="${ledColor}" stroke-width="2.2" />
        <text x="0" y="-20" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700">D1 (LED)</text>
      </g>
    `;
  } else if (n === 3 || n === 5) {
    tpCoords = { TP1: { x: 130, y: 80 }, TP2: { x: 350, y: 80 }, TP3: { x: 250, y: 200 } };
    const second = level.components[1];
    boardSvg = `
      <line x1="75" y1="140" x2="75" y2="80" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="80" x2="390" y2="80" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="390" y1="80" x2="390" y2="200" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="200" x2="390" y2="200" stroke="#293657" stroke-width="2.5" />
      <g transform="translate(75, 140)">
        <circle cx="0" cy="0" r="24" fill="#111A33" stroke="#F7E600" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#F7E600" font-size="11" font-family="JetBrains Mono, monospace">${supplyV}V</text>
      </g>
      <g transform="translate(230, 80)">
        <rect x="-36" y="-14" width="72" height="28" rx="3" fill="#1B2745" stroke="#EAF0FF" stroke-width="1.8" />
        <text x="0" y="-20" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700">R1 (1 kΩ)</text>
      </g>
      <g transform="translate(390, 140)">
        ${
          second.type === 'capacitor'
            ? `<rect x="-20" y="-22" width="40" height="44" rx="3" fill="#1B2745" stroke="#F7E600" stroke-width="1.8" />
               <text x="28" y="4" fill="#00F5FF" font-size="11" font-weight="700">C1 (100 µF)</text>`
            : `<rect x="-14" y="-28" width="28" height="56" rx="3" fill="#1B2745" stroke="#EAF0FF" stroke-width="1.8" />
               <text x="24" y="4" fill="#EAF0FF" font-size="11" font-weight="700">R2 (1 kΩ)</text>`
        }
      </g>
    `;
  } else if (n === 6 || n === 7) {
    tpCoords = n === 6
      ? { TP1: { x: 115, y: 155 }, TP2: { x: 255, y: 155 }, TP3: { x: 390, y: 110 }, TP4: { x: 390, y: 215 } }
      : { TP1: { x: 390, y: 48 }, TP2: { x: 390, y: 118 }, TP3: { x: 255, y: 155 }, TP4: { x: 390, y: 215 } };
    boardSvg = `
      <line x1="75" y1="155" x2="310" y2="155" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="390" y1="48" x2="390" y2="215" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="215" x2="390" y2="215" stroke="#293657" stroke-width="2.5" />
      <g transform="translate(75, 155)">
        <circle cx="0" cy="0" r="22" fill="#111A33" stroke="#F7E600" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#F7E600" font-size="10" font-family="JetBrains Mono, monospace">5V IN</text>
      </g>
      <g transform="translate(185, 155)">
        <rect x="-32" y="-12" width="64" height="24" rx="3" fill="#1B2745" stroke="#EAF0FF" stroke-width="1.8" />
        <text x="0" y="-17" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700">R_B (1 kΩ)</text>
      </g>
      <g transform="translate(345, 155)">
        <circle cx="0" cy="0" r="24" fill="#1B2745" stroke="#00F5FF" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700">Q1 NPN</text>
      </g>
      <g transform="translate(390, 82)">
        <rect x="-46" y="-14" width="92" height="28" rx="3" fill="#1B2745" stroke="#F7E600" stroke-width="1.8" />
        <text x="0" y="4" text-anchor="middle" fill="#F7E600" font-size="10" font-weight="700">${n === 7 ? 'M1 + D1 Flyback' : 'R_C + D1 LED'}</text>
      </g>
      <text x="455" y="52" fill="#F7E600" font-size="11" font-family="JetBrains Mono, monospace">${supplyV}V VCC</text>
    `;
  } else if (n === 8) {
    tpCoords = { TP1: { x: 110, y: 75 }, TP2: { x: 265, y: 75 }, TP3: { x: 375, y: 140 }, TP4: { x: 495, y: 140 }, TP5: { x: 265, y: 215 } };
    boardSvg = `
      <line x1="75" y1="75" x2="495" y2="75" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="375" y1="75" x2="375" y2="215" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="495" y1="75" x2="495" y2="215" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="215" x2="495" y2="215" stroke="#293657" stroke-width="2.5" />
      <g transform="translate(190, 75)">
        <rect x="-38" y="-18" width="76" height="36" rx="3" fill="#1B2745" stroke="#F7E600" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700">U1 7805</text>
      </g>
      <text x="375" y="110" text-anchor="middle" fill="#00F5FF" font-size="10">R1 / R2</text>
      <text x="495" y="110" text-anchor="middle" fill="#00F5FF" font-size="10">R3 + D1</text>
    `;
  } else if (n === 9) {
    tpCoords = { TP1: { x: 115, y: 90 }, TP2: { x: 255, y: 90 }, TP3: { x: 395, y: 90 }, TP4: { x: 255, y: 200 } };
    boardSvg = `
      <line x1="75" y1="145" x2="75" y2="90" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="90" x2="480" y2="90" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="480" y1="90" x2="480" y2="200" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="200" x2="480" y2="200" stroke="#293657" stroke-width="2.5" />
      <g transform="translate(185, 90)"><rect x="-30" y="-12" width="60" height="24" rx="3" fill="#1B2745" stroke="#EAF0FF" /><text x="0" y="-17" text-anchor="middle" fill="#EAF0FF" font-size="10">R1 1k</text></g>
      <g transform="translate(325, 90)"><rect x="-30" y="-12" width="60" height="24" rx="3" fill="#1B2745" stroke="#EAF0FF" /><text x="0" y="-17" text-anchor="middle" fill="#EAF0FF" font-size="10">R2 1k</text></g>
      <g transform="translate(480, 145)"><rect x="-14" y="-26" width="28" height="52" rx="3" fill="#1B2745" stroke="#F7E600" /><text x="22" y="4" fill="#F7E600" font-size="10">R3</text></g>
    `;
  } else {
    tpCoords = { TP1: { x: 115, y: 75 }, TP2: { x: 280, y: 140 }, TP3: { x: 430, y: 140 }, TP4: { x: 280, y: 215 } };
    boardSvg = `
      <line x1="75" y1="75" x2="430" y2="75" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="280" y1="75" x2="280" y2="215" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="430" y1="75" x2="430" y2="215" stroke="#00F5FF" stroke-width="2.5" />
      <line x1="75" y1="215" x2="430" y2="215" stroke="#293657" stroke-width="2.5" />
      <text x="280" y="112" text-anchor="middle" fill="#00F5FF" font-size="10">R1 (330 Ω)</text>
      <text x="430" y="112" text-anchor="middle" fill="#00F5FF" font-size="10">R2 (330 Ω)</text>
      <text x="280" y="182" text-anchor="middle" fill="#F7E600" font-size="10">D1 LED</text>
      <text x="430" y="182" text-anchor="middle" fill="#9AA7C7" font-size="10">D2 LED</text>
    `;
  }

  const tpSvg = Object.entries(tpCoords)
    .map(([tpId, pos]) => {
      const tp = tpMap[tpId] || { id: tpId, label: tpId, name: tpId };
      const hasRed = state.redTp === tpId;
      const hasBlack = state.blackTp === tpId;
      return `
        <g class="tp-node" data-tp="${tpId}" tabindex="0" role="button" aria-label="Test point ${tp.label} ${tp.name}">
          <circle class="tp-hit" cx="${pos.x}" cy="${pos.y}" r="24" />
          <circle class="tp-ring" cx="${pos.x}" cy="${pos.y}" r="10" fill="#080B1A" stroke="#00F5FF" stroke-width="2" />
          <circle cx="${pos.x}" cy="${pos.y}" r="4" fill="#F7E600" />
          <text x="${pos.x}" y="${pos.y - 16}" text-anchor="middle" fill="#EAF0FF" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">${tp.label}</text>
          ${
            hasRed
              ? `<g class="probe-marker" transform="translate(${pos.x - 11}, ${pos.y + 18})">
                   <circle cx="0" cy="0" r="8" fill="#FF2D95" stroke="#EAF0FF" stroke-width="1.5" />
                   <text x="0" y="3.5" text-anchor="middle" fill="#EAF0FF" font-size="9" font-weight="700">+</text>
                 </g>`
              : ''
          }
          ${
            hasBlack
              ? `<g class="probe-marker" transform="translate(${pos.x + 11}, ${pos.y + 18})">
                   <circle cx="0" cy="0" r="8" fill="#080B1A" stroke="#EAF0FF" stroke-width="2" />
                   <text x="0" y="3.5" text-anchor="middle" fill="#EAF0FF" font-size="10" font-weight="700">−</text>
                 </g>`
              : ''
          }
        </g>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg class="schematic-svg" viewBox="0 0 560 250" role="img" aria-label="${level.title} schematic">
      ${boardSvg}
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