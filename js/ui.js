/**
 * UI Rendering: Modern Editorial Case Cards with 3D Clay Component Icons,
 * Clean Light-Mode Interactive Schematics (Cases 0-20), and Measurement Inspector.
 */

import { rankFor } from './engine.js';
import { caseUnlocked } from './levels.js';

function getClayThumbSvg(lvl) {
  if (lvl.hasScope) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="18" rx="5" fill="#1C1D1F"/><path d="M7 16 Q11 9 16 16 T25 16" fill="none" stroke="#A435F0" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'mosfet')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="7" y="7" width="18" height="14" rx="4" fill="#6D28D2"/><rect x="10" y="21" width="3" height="6" rx="1" fill="#1C1D1F"/><rect x="15" y="21" width="3" height="6" rx="1" fill="#1C1D1F"/><rect x="20" y="21" width="3" height="6" rx="1" fill="#1C1D1F"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'motor')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="6" y="8" width="20" height="16" rx="8" fill="#6D28D2"/><rect x="24" y="13" width="5" height="6" rx="2" fill="#CBD5E1"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'regulator')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="8" y="8" width="16" height="14" rx="4" fill="#1C1D1F"/><rect x="10" y="22" width="3" height="6" rx="1" fill="#A435F0"/><rect x="15" y="22" width="3" height="6" rx="1" fill="#A435F0"/><rect x="20" y="22" width="3" height="6" rx="1" fill="#A435F0"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'npn')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="14" r="9" fill="#1C1D1F"/><rect x="10" y="22" width="2.5" height="6" fill="#6D28D2"/><rect x="15" y="22" width="2.5" height="6" fill="#6D28D2"/><rect x="20" y="22" width="2.5" height="6" fill="#6D28D2"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'zener')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="6" y="11" width="20" height="10" rx="5" fill="#1C1D1F"/><rect x="19" y="11" width="4" height="10" rx="1" fill="#A435F0"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'capacitor')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="9" y="6" width="14" height="18" rx="6" fill="#A435F0"/><rect x="11" y="6" width="4" height="18" rx="2" fill="#D8B4FE"/></svg>`;
  }
  if (lvl.components.some((c) => c.type === 'led')) {
    return `<svg width="32" height="32" viewBox="0 0 32 32"><path d="M10 21 L10 13 A6 6 0 0 1 22 13 L22 21 Z" fill="#FB7185"/><rect x="8" y="21" width="16" height="3" rx="1.5" fill="#1C1D1F"/></svg>`;
  }
  return `<svg width="32" height="32" viewBox="0 0 32 32"><rect x="5" y="11" width="22" height="10" rx="5" fill="#F4D3B2"/><rect x="11" y="11" width="3" height="10" fill="#6D28D2"/><rect x="17" y="11" width="3" height="10" fill="#A435F0"/></svg>`;
}

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
    const statusText = best ? `Solved · ${best} pts` : solved ? 'Solved' : lvl.chapter;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-item-btn';
    btn.disabled = !unlocked;
    btn.dataset.caseNumber = String(lvl.number);
    btn.innerHTML = `
      <div class="case-card-top">
        <span class="case-clay-thumb">${getClayThumbSvg(lvl)}</span>
        <span class="badge ${unlocked ? '' : 'badge-muted'}">Case #${lvl.number}</span>
      </div>
      <div>
        <div><strong>${lvl.title}</strong></div>
        <div class="case-item-meta">${statusText}</div>
      </div>
      <div class="case-card-footer">
        <span>${unlocked ? (solved ? '★★★ Replay' : 'Investigate') : 'Locked'}</span>
        <span>${unlocked ? '→' : '🔒'}</span>
      </div>
    `;
    caseList.appendChild(btn);
  });

  const lbEl = document.getElementById('home-leaderboard');
  const entries = save.leaderboard || [];
  if (entries.length === 0) {
    lbEl.innerHTML = '<p class="empty-log">Solve a case to post your first score.</p>';
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
    const ledColor = isLedLit ? '#15803D' : '#64748B';
    boardSvg = `
      <line x1="75" y1="145" x2="75" y2="95" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="95" x2="185" y2="95" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="265" y1="95" x2="405" y2="95" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="405" y1="95" x2="490" y2="95" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="490" y1="95" x2="490" y2="195" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="195" x2="490" y2="195" stroke="#94A3B8" stroke-width="2.5" />
      <g transform="translate(75, 145)">
        <circle cx="0" cy="0" r="24" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2.2" />
        <text x="0" y="-3" text-anchor="middle" fill="#595C73" font-size="10" font-weight="700">V1</text>
        <text x="0" y="11" text-anchor="middle" fill="#6D28D2" font-size="11" font-family="JetBrains Mono, monospace">${supplyV}V</text>
      </g>
      <g transform="translate(225, 95)">
        <rect x="-40" y="-14" width="80" height="28" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
        <text x="0" y="-20" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">R1 (${r1.value} Ω)</text>
      </g>
      <g transform="translate(405, 95)" class="${isLedLit ? 'led-glow-on' : ''}">
        ${isLedLit ? '<circle cx="0" cy="0" r="28" fill="rgba(21,128,61,0.16)" />' : ''}
        <polygon points="-14,-14 -14,14 14,0" fill="${isLedLit ? '#15803D' : '#FFFFFF'}" stroke="${ledColor}" stroke-width="2" />
        <line x1="16" y1="-14" x2="16" y2="14" stroke="${ledColor}" stroke-width="2.2" />
        <text x="0" y="-20" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">D1 (LED)</text>
      </g>
    `;
  } else if (n === 3 || n === 5 || n === 11 || n === 14 || n === 15) {
    tpCoords = { TP1: { x: 130, y: 80 }, TP2: { x: 350, y: 80 }, TP3: { x: 250, y: 200 } };
    const c1 = level.components[0];
    const c2 = level.components[1];
    const label1 = `${c1.id} (${c1.value >= 1000 ? `${c1.value / 1000} kΩ` : `${c1.value} Ω`})`;
    const label2 =
      c2.type === 'capacitor' ? `${c2.id} (Cap)` :
      c2.type === 'zener' ? `${c2.id} (5.1V) || R_L` :
      c2.id === 'R_IN' ? 'R_IN (100k)' : `${c2.id} (${c2.value} Ω)`;
    boardSvg = `
      <line x1="75" y1="140" x2="75" y2="80" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="80" x2="390" y2="80" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="390" y1="80" x2="390" y2="200" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="200" x2="390" y2="200" stroke="#94A3B8" stroke-width="2.5" />
      <g transform="translate(75, 140)">
        <circle cx="0" cy="0" r="24" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2.2" />
        <text x="0" y="4" text-anchor="middle" fill="#6D28D2" font-size="11" font-family="JetBrains Mono, monospace">${n === 15 ? '5V~' : `${supplyV}V`}</text>
      </g>
      <g transform="translate(230, 80)">
        <rect x="-42" y="-14" width="84" height="28" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
        <text x="0" y="-20" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">${label1}</text>
      </g>
      <g transform="translate(390, 140)">
        <rect x="-20" y="-24" width="40" height="48" rx="8" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
        <text x="28" y="4" fill="#1C1D1F" font-size="11" font-weight="700">${label2}</text>
      </g>
    `;
  } else if (n === 12 || n === 13) {
    tpCoords = { TP1: { x: 130, y: 85 }, TP2: { x: 350, y: 85 }, TP3: { x: 250, y: 200 } };
    boardSvg = `
      <line x1="75" y1="145" x2="75" y2="85" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="85" x2="410" y2="85" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="410" y1="85" x2="410" y2="200" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="200" x2="410" y2="200" stroke="#94A3B8" stroke-width="2.5" />
      <g transform="translate(75, 145)">
        <circle cx="0" cy="0" r="24" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#6D28D2" font-size="11" font-family="JetBrains Mono, monospace">12V~</text>
      </g>
      <g transform="translate(230, 85)">
        <polygon points="-14,-14 -14,14 14,0" fill="#FFFFFF" stroke="#E11D48" stroke-width="2" />
        <line x1="16" y1="-14" x2="16" y2="14" stroke="#E11D48" stroke-width="2.2" />
        <text x="0" y="-20" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">D1 (1N4007)</text>
      </g>
      <g transform="translate(410, 142)">
        <rect x="-26" y="-24" width="52" height="48" rx="8" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
        <text x="34" y="4" fill="#1C1D1F" font-size="11" font-weight="700">${n === 13 ? 'C1 || R1' : 'R1 1kΩ'}</text>
      </g>
    `;
  } else if (n === 6 || n === 7) {
    tpCoords = n === 6
      ? { TP1: { x: 115, y: 155 }, TP2: { x: 255, y: 155 }, TP3: { x: 390, y: 110 }, TP4: { x: 390, y: 215 } }
      : { TP1: { x: 390, y: 48 }, TP2: { x: 390, y: 118 }, TP3: { x: 255, y: 155 }, TP4: { x: 390, y: 215 } };
    boardSvg = `
      <line x1="75" y1="155" x2="310" y2="155" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="390" y1="48" x2="390" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="215" x2="390" y2="215" stroke="#94A3B8" stroke-width="2.5" />
      <g transform="translate(75, 155)">
        <circle cx="0" cy="0" r="22" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#6D28D2" font-size="10" font-family="JetBrains Mono, monospace">5V IN</text>
      </g>
      <g transform="translate(185, 155)">
        <rect x="-32" y="-12" width="64" height="24" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
        <text x="0" y="-17" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">R_B (1 kΩ)</text>
      </g>
      <g transform="translate(345, 155)">
        <circle cx="0" cy="0" r="24" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">Q1 NPN</text>
      </g>
      <g transform="translate(390, 82)">
        <rect x="-46" y="-14" width="92" height="28" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">${n === 7 ? 'M1 + D1 Flyback' : 'R_C + D1 LED'}</text>
      </g>
      <text x="455" y="52" fill="#6D28D2" font-size="11" font-family="JetBrains Mono, monospace">${supplyV}V VCC</text>
    `;
  } else if (n === 8) {
    tpCoords = { TP1: { x: 110, y: 75 }, TP2: { x: 265, y: 75 }, TP3: { x: 375, y: 140 }, TP4: { x: 495, y: 140 }, TP5: { x: 265, y: 215 } };
    boardSvg = `
      <line x1="75" y1="75" x2="495" y2="75" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="375" y1="75" x2="375" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="495" y1="75" x2="495" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="215" x2="495" y2="215" stroke="#94A3B8" stroke-width="2.5" />
      <g transform="translate(190, 75)">
        <rect x="-38" y="-18" width="76" height="36" rx="6" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
        <text x="0" y="4" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">U1 7805</text>
      </g>
      <text x="375" y="110" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R1 / R2</text>
      <text x="495" y="110" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R3 + D1</text>
    `;
  } else if (n === 9 || n === 16) {
    tpCoords = { TP1: { x: 115, y: 90 }, TP2: { x: 255, y: 90 }, TP3: { x: 395, y: 90 }, TP4: { x: 255, y: 200 } };
    boardSvg = `
      <line x1="75" y1="145" x2="75" y2="90" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="90" x2="480" y2="90" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="480" y1="90" x2="480" y2="200" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="200" x2="480" y2="200" stroke="#94A3B8" stroke-width="2.5" />
      <g transform="translate(185, 90)"><rect x="-30" y="-12" width="60" height="24" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" /><text x="0" y="-17" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R1 1k</text></g>
      <g transform="translate(325, 90)"><rect x="-30" y="-12" width="60" height="24" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" /><text x="0" y="-17" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">${n === 16 ? 'R2 10k' : 'R2 1k'}</text></g>
      <g transform="translate(480, 145)"><rect x="-18" y="-26" width="36" height="52" rx="6" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" /><text x="26" y="4" fill="#6D28D2" font-size="10" font-weight="700">${n === 16 ? 'C1 10µF' : 'R3'}</text></g>
    `;
  } else if (n === 17) {
    tpCoords = { TP1: { x: 110, y: 100 }, TP2: { x: 245, y: 145 }, TP3: { x: 425, y: 115 }, TP4: { x: 245, y: 215 } };
    boardSvg = `
      <line x1="110" y1="100" x2="225" y2="100" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="245" y1="145" x2="245" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="245" y1="145" x2="425" y2="145" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="330" y1="115" x2="475" y2="115" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="475" y1="115" x2="475" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="215" x2="475" y2="215" stroke="#94A3B8" stroke-width="2.5" />
      <polygon points="225,80 225,150 330,115" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2.2" />
      <text x="265" y="119" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">U1</text>
      <text x="335" y="165" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R_f (10k?)</text>
      <text x="200" y="185" text-anchor="middle" fill="#595C73" font-size="10" font-weight="700">R_g 1k</text>
    `;
  } else if (n === 18) {
    tpCoords = { TP1: { x: 115, y: 55 }, TP2: { x: 170, y: 165 }, TP3: { x: 265, y: 95 }, TP4: { x: 405, y: 95 }, TP5: { x: 335, y: 215 } };
    boardSvg = `
      <line x1="115" y1="55" x2="265" y2="55" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="265" y1="55" x2="265" y2="95" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="265" y1="95" x2="405" y2="95" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="405" y1="95" x2="405" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="115" y1="165" x2="380" y2="165" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="115" y1="215" x2="430" y2="215" stroke="#94A3B8" stroke-width="2.5" />
      <rect x="295" y="75" width="80" height="40" rx="8" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
      <text x="335" y="99" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700">M1 (100 Ω)</text>
      <circle cx="405" cy="165" r="22" fill="#FFFFFF" stroke="#E11D48" stroke-width="2" />
      <text x="405" y="169" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">Q3</text>
      <text x="200" y="74" text-anchor="middle" fill="#595C73" font-size="10" font-weight="700">Q2 ON</text>
    `;
  } else if (n === 19 || n === 20) {
    tpCoords = n === 19
      ? { TP1: { x: 110, y: 155 }, TP2: { x: 255, y: 155 }, TP3: { x: 395, y: 110 }, TP4: { x: 395, y: 215 } }
      : { TP1: { x: 395, y: 48 }, TP2: { x: 110, y: 75 }, TP3: { x: 255, y: 155 }, TP4: { x: 395, y: 115 }, TP5: { x: 395, y: 215 } };
    boardSvg = `
      <line x1="110" y1="155" x2="335" y2="155" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="395" y1="48" x2="395" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="85" y1="215" x2="430" y2="215" stroke="#94A3B8" stroke-width="2.5" />
      ${n === 20 ? '<rect x="85" y="55" width="76" height="36" rx="6" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" /><text x="123" y="77" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">U1 5V</text>' : ''}
      <rect x="155" y="143" width="66" height="24" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
      <text x="188" y="138" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R_G 100Ω</text>
      <circle cx="360" cy="155" r="24" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2" />
      <text x="360" y="159" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">Q1 FET</text>
      <rect x="350" y="65" width="90" height="28" rx="6" fill="#FFFFFF" stroke="#1C1D1F" stroke-width="2" />
      <text x="395" y="83" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">M1 12V</text>
    `;
  } else {
    tpCoords = { TP1: { x: 115, y: 75 }, TP2: { x: 280, y: 140 }, TP3: { x: 430, y: 140 }, TP4: { x: 280, y: 215 } };
    boardSvg = `
      <line x1="75" y1="75" x2="430" y2="75" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="280" y1="75" x2="280" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="430" y1="75" x2="430" y2="215" stroke="#1C1D1F" stroke-width="2.5" />
      <line x1="75" y1="215" x2="430" y2="215" stroke="#94A3B8" stroke-width="2.5" />
      <text x="280" y="112" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R1 (330 Ω)</text>
      <text x="430" y="112" text-anchor="middle" fill="#1C1D1F" font-size="10" font-weight="700">R2 (330 Ω)</text>
      <text x="280" y="182" text-anchor="middle" fill="#6D28D2" font-size="10" font-weight="700">D1 LED</text>
      <text x="430" y="182" text-anchor="middle" fill="#595C73" font-size="10" font-weight="700">D2 LED</text>
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
          <circle class="tp-ring" cx="${pos.x}" cy="${pos.y}" r="10" fill="#FFFFFF" stroke="#6D28D2" stroke-width="2.2" />
          <circle cx="${pos.x}" cy="${pos.y}" r="4" fill="#6D28D2" />
          <text x="${pos.x}" y="${pos.y - 16}" text-anchor="middle" fill="#1C1D1F" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">${tp.label}</text>
          ${
            hasRed
              ? `<g class="probe-marker" transform="translate(${pos.x - 11}, ${pos.y + 18})">
                   <circle cx="0" cy="0" r="8" fill="#E11D48" stroke="#FFFFFF" stroke-width="1.5" />
                   <text x="0" y="3.5" text-anchor="middle" fill="#FFFFFF" font-size="9" font-weight="700">+</text>
                 </g>`
              : ''
          }
          ${
            hasBlack
              ? `<g class="probe-marker" transform="translate(${pos.x + 11}, ${pos.y + 18})">
                   <circle cx="0" cy="0" r="8" fill="#1C1D1F" stroke="#FFFFFF" stroke-width="1.5" />
                   <text x="0" y="3.5" text-anchor="middle" fill="#FFFFFF" font-size="10" font-weight="700">−</text>
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