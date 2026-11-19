/**
 * FaultFinder DC Circuit Solver (Modified Nodal Analysis + Ideal Piecewise-Linear Diodes, NPN, MOSFET, Op-Amp, Motor, Regulator)
 * Single source of truth for all voltage, resistance, continuity, and KVL/KCL checks.
 */

const R_OPEN = 1e12;
const R_DIODE_OFF = 1e8;
const R_SHORT = 0.01;
const R_BLEED = 1e11;
const OHM_OL_THRESHOLD = 4e7;

function solveLinearSystem(A, b) {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, idx) => [...row, b[idx]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const val = Math.abs(M[r][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-15) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }
    const pivot = M[col][col];
    for (let r = col + 1; r < n; r += 1) {
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      for (let c = col; c <= n; c += 1) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c += 1) {
      sum -= M[r][c] * x[c];
    }
    x[r] = sum / M[r][r];
  }
  return x;
}

function getEffectiveComponent(comp, fault, faultActive) {
  const isFaulty = Boolean(faultActive && fault && fault.component === comp.id);
  const fType = isFaulty ? fault.type : null;

  if (comp.type === 'vsource') {
    return { ...comp, kind: 'vsource', voltage: comp.value };
  }

  if (comp.type === 'resistor' || comp.type === 'motor') {
    if (fType === 'open' || fType === 'dead') return { ...comp, kind: 'resistor', r: R_OPEN };
    if (fType === 'short') return { ...comp, kind: 'resistor', r: R_SHORT };
    if (fType === 'wrong-value' || fType === 'wrong_value') {
      return { ...comp, kind: 'resistor', r: fault.value ?? comp.wrongValue ?? comp.value };
    }
    return { ...comp, kind: 'resistor', r: comp.value };
  }

  if (comp.type === 'led' || comp.type === 'diode' || comp.type === 'zener') {
    const nodes = fType === 'reversed' ? [comp.nodes[1], comp.nodes[0]] : [...comp.nodes];
    if (fType === 'open' || fType === 'dead') return { ...comp, nodes, kind: 'resistor', r: R_OPEN };
    if (fType === 'short') return { ...comp, nodes, kind: 'resistor', r: R_SHORT };
    const leakR = fType === 'leaky' ? (fault.value ?? comp.leakValue ?? 1000) : null;
    return {
      ...comp,
      nodes,
      kind: comp.type,
      vf: comp.vf ?? (comp.type === 'led' ? 2.0 : 0.7),
      vz: comp.vz ?? 5.1,
      leakR,
    };
  }

  if (comp.type === 'capacitor') {
    if (fType === 'short') return { ...comp, kind: 'resistor', r: R_SHORT };
    if (fType === 'leaky') return { ...comp, kind: 'resistor', r: fault.value ?? 1000 };
    return { ...comp, kind: 'resistor', r: R_OPEN };
  }

  if (comp.type === 'npn') {
    if (fType === 'open' || fType === 'dead') return { ...comp, kind: 'dead_npn' };
    if (fType === 'short') return { ...comp, kind: 'short_npn' };
    return { ...comp, kind: 'npn', vbe: comp.vbe ?? 0.7, vceSat: comp.vceSat ?? 0.2, rceSat: comp.rceSat ?? 1.0 };
  }

  if (comp.type === 'mosfet') {
    if (fType === 'open' || fType === 'dead') return { ...comp, kind: 'dead_mosfet' };
    if (fType === 'short') return { ...comp, kind: 'short_mosfet' };
    return { ...comp, kind: 'mosfet', vth: comp.vth ?? 2.0, rdsOn: comp.rdsOn ?? 0.2 };
  }

  if (comp.type === 'opamp') {
    if (fType === 'open' || fType === 'dead') return { ...comp, kind: 'dead_opamp' };
    return { ...comp, kind: 'opamp' };
  }

  if (comp.type === 'regulator') {
    if (fType === 'open' || fType === 'dead') return { ...comp, kind: 'dead_reg' };
    return { ...comp, kind: 'regulator', vout: comp.vout ?? 5.0 };
  }

  return { ...comp, kind: 'resistor', r: R_OPEN };
}

export function solveCircuit(circuit, options = {}) {
  const faultActive = options.faultActive !== false;
  const powerOn = options.powerOn !== false;
  const ground = circuit.ground || 'N_GND';
  const nonGnd = circuit.nodes.filter((n) => n !== ground);
  const varMap = new Map(nonGnd.map((n, i) => [n, i]));
  const numV = nonGnd.length;

  const effComps = circuit.components.map((c) => getEffectiveComponent(c, circuit.fault, faultActive));
  const diodes = effComps.filter((c) => c.kind === 'led' || c.kind === 'diode' || c.kind === 'zener');
  const npns = effComps.filter((c) => c.kind === 'npn');
  const mosfets = effComps.filter((c) => c.kind === 'mosfet');
  const opamps = effComps.filter((c) => c.kind === 'opamp');
  const regs = effComps.filter((c) => c.kind === 'regulator');
  const vsources = effComps.filter((c) => c.kind === 'vsource');

  const diodeStates = new Map(diodes.map((d) => [d.id, 'off']));
  const npnStates = new Map(npns.map((q) => [q.id, { be: 'off', ce: 'off' }]));
  const mosfetStates = new Map(mosfets.map((m) => [m.id, 'off']));

  let solution = null;
  let converged = false;
  let activeSources = [];
  let activeOpamps = [];

  for (let iter = 0; iter < 40; iter += 1) {
    activeSources = [];
    activeOpamps = powerOn ? opamps : [];

    if (powerOn && circuit.supply) {
      activeSources.push({
        id: circuit.supply.id || 'V1',
        pos: circuit.supply.positive,
        neg: circuit.supply.negative,
        voltage: circuit.supply.voltage,
      });
    }
    if (powerOn) {
      for (const vs of vsources) {
        activeSources.push({ id: vs.id, pos: vs.nodes[0], neg: vs.nodes[1], voltage: vs.voltage });
      }
      for (const reg of regs) {
        activeSources.push({ id: reg.id, pos: reg.nodes[1], neg: reg.nodes[2], voltage: reg.vout });
      }
    }
    for (const d of diodes) {
      const st = diodeStates.get(d.id);
      if (st === 'fwd') activeSources.push({ id: d.id, pos: d.nodes[0], neg: d.nodes[1], voltage: d.vf });
      else if (st === 'zener') activeSources.push({ id: d.id, pos: d.nodes[1], neg: d.nodes[0], voltage: d.vz });
    }
    for (const q of npns) {
      const st = npnStates.get(q.id);
      if (st.be === 'on') activeSources.push({ id: `${q.id}_BE`, pos: q.nodes[0], neg: q.nodes[2], voltage: q.vbe });
    }

    const dim = numV + activeSources.length + activeOpamps.length;
    const A = Array.from({ length: dim }, () => new Array(dim).fill(0));
    const z = new Array(dim).fill(0);

    for (let i = 0; i < numV; i += 1) A[i][i] += 1 / R_BLEED;

    const stampResistor = (n1, n2, r) => {
      const g = 1 / Math.max(r, 1e-9);
      const i1 = varMap.get(n1);
      const i2 = varMap.get(n2);
      if (i1 !== undefined) A[i1][i1] += g;
      if (i2 !== undefined) A[i2][i2] += g;
      if (i1 !== undefined && i2 !== undefined) {
        A[i1][i2] -= g;
        A[i2][i1] -= g;
      }
    };

    const stampNorton = (nPos, nNeg, g, iSrc) => {
      const ip = varMap.get(nPos);
      const ineg = varMap.get(nNeg);
      if (ip !== undefined) {
        A[ip][ip] += g;
        z[ip] += iSrc;
      }
      if (ineg !== undefined) {
        A[ineg][ineg] += g;
        z[ineg] -= iSrc;
      }
      if (ip !== undefined && ineg !== undefined) {
        A[ip][ineg] -= g;
        A[ineg][ip] -= g;
      }
    };

    for (const c of effComps) {
      if (c.kind === 'resistor') {
        stampResistor(c.nodes[0], c.nodes[1], c.r);
      } else if (c.kind === 'led' || c.kind === 'diode' || c.kind === 'zener') {
        if (c.leakR) stampResistor(c.nodes[0], c.nodes[1], c.leakR);
        if (diodeStates.get(c.id) === 'off') stampResistor(c.nodes[0], c.nodes[1], R_DIODE_OFF);
      } else if (c.kind === 'npn') {
        const st = npnStates.get(c.id);
        if (st.be === 'off') stampResistor(c.nodes[0], c.nodes[2], R_DIODE_OFF);
        if (st.ce === 'on') stampNorton(c.nodes[1], c.nodes[2], 1 / c.rceSat, c.vceSat / c.rceSat);
        else stampResistor(c.nodes[1], c.nodes[2], R_OPEN);
      } else if (c.kind === 'dead_npn') {
        stampResistor(c.nodes[0], c.nodes[2], R_OPEN);
        stampResistor(c.nodes[1], c.nodes[2], R_OPEN);
      } else if (c.kind === 'short_npn') {
        stampResistor(c.nodes[1], c.nodes[2], R_SHORT);
      } else if (c.kind === 'mosfet') {
        stampResistor(c.nodes[0], c.nodes[2], R_OPEN);
        const st = mosfetStates.get(c.id);
        stampResistor(c.nodes[1], c.nodes[2], st === 'on' ? c.rdsOn : R_OPEN);
      } else if (c.kind === 'dead_mosfet') {
        stampResistor(c.nodes[0], c.nodes[2], R_OPEN);
        stampResistor(c.nodes[1], c.nodes[2], R_OPEN);
      } else if (c.kind === 'short_mosfet') {
        stampResistor(c.nodes[0], c.nodes[2], R_OPEN);
        stampResistor(c.nodes[1], c.nodes[2], R_SHORT);
      } else if (c.kind === 'dead_reg') {
        stampResistor(c.nodes[1], c.nodes[2], R_OPEN);
      } else if (c.kind === 'dead_opamp') {
        stampResistor(c.nodes[2], ground, R_OPEN);
      }
    }

    activeSources.forEach((src, k) => {
      const row = numV + k;
      const ip = varMap.get(src.pos);
      const ineg = varMap.get(src.neg);
      if (ip !== undefined) {
        A[ip][row] += 1;
        A[row][ip] += 1;
      }
      if (ineg !== undefined) {
        A[ineg][row] -= 1;
        A[row][ineg] -= 1;
      }
      z[row] = src.voltage;
    });

    activeOpamps.forEach((oa, k) => {
      const row = numV + activeSources.length + k;
      const iOut = varMap.get(oa.nodes[2]);
      const iPos = varMap.get(oa.nodes[0]);
      const iNeg = varMap.get(oa.nodes[1]);
      if (iOut !== undefined) A[iOut][row] += 1;
      if (iPos !== undefined) A[row][iPos] += 1;
      if (iNeg !== undefined) A[row][iNeg] -= 1;
      z[row] = 0;
    });

    solution = solveLinearSystem(A, z);
    if (!solution) return { converged: false, singular: true, voltages: {}, branches: {} };

    const getV = (node) => (node === ground ? 0 : solution[varMap.get(node)] ?? 0);
    let changed = false;

    for (const d of diodes) {
      const vDrop = getV(d.nodes[0]) - getV(d.nodes[1]);
      const prev = diodeStates.get(d.id);
      let next = prev;
      if (prev === 'off') {
        if (vDrop > d.vf + 1e-6) next = 'fwd';
        else if (d.kind === 'zener' && -vDrop > d.vz + 1e-6) next = 'zener';
      } else {
        const idx = activeSources.findIndex((s) => s.id === d.id);
        if ((idx >= 0 ? solution[numV + idx] : 0) < -1e-9) next = 'off';
      }
      if (next !== prev) {
        diodeStates.set(d.id, next);
        changed = true;
      }
    }

    for (const q of npns) {
      const st = npnStates.get(q.id);
      const vbe = getV(q.nodes[0]) - getV(q.nodes[2]);
      const vce = getV(q.nodes[1]) - getV(q.nodes[2]);
      let nextBe = st.be;
      if (st.be === 'off' && vbe > q.vbe + 1e-6) nextBe = 'on';
      else if (st.be === 'on') {
        const idx = activeSources.findIndex((s) => s.id === `${q.id}_BE`);
        if ((idx >= 0 ? solution[numV + idx] : 0) < 1e-6) nextBe = 'off';
      }
      const nextCe = nextBe === 'on' && vce >= q.vceSat - 1e-6 ? 'on' : 'off';
      if (nextBe !== st.be || nextCe !== st.ce) {
        npnStates.set(q.id, { be: nextBe, ce: nextCe });
        changed = true;
      }
    }

    for (const m of mosfets) {
      const vgs = getV(m.nodes[0]) - getV(m.nodes[2]);
      const prev = mosfetStates.get(m.id);
      const next = powerOn && vgs > m.vth ? 'on' : 'off';
      if (next !== prev) {
        mosfetStates.set(m.id, next);
        changed = true;
      }
    }

    if (!changed) {
      converged = true;
      break;
    }
  }

  const voltages = { [ground]: 0 };
  nonGnd.forEach((n, i) => {
    voltages[n] = solution[i];
  });

  const branches = {};
  for (const c of effComps) {
    const v1 = voltages[c.nodes[0]] ?? 0;
    const v2 = voltages[c.nodes[1]] ?? 0;
    const vDiff = v1 - v2;

    if (c.kind === 'resistor') {
      branches[c.id] = { voltage: vDiff, current: vDiff / c.r, nodes: c.nodes };
    } else if (c.kind === 'vsource') {
      const idx = activeSources.findIndex((s) => s.id === c.id);
      branches[c.id] = { voltage: vDiff, current: idx >= 0 ? solution[numV + idx] : 0, nodes: c.nodes };
    } else if (c.kind === 'led' || c.kind === 'diode' || c.kind === 'zener') {
      const st = diodeStates.get(c.id);
      const idx = activeSources.findIndex((s) => s.id === c.id);
      let current = idx >= 0 ? solution[numV + idx] : vDiff / R_DIODE_OFF;
      if (st === 'zener') current = -current;
      if (c.leakR) current += vDiff / c.leakR;
      branches[c.id] = { voltage: vDiff, current, state: st, nodes: c.nodes };
    } else if (c.kind === 'npn') {
      const st = npnStates.get(c.id);
      const vb = voltages[c.nodes[0]] ?? 0;
      const vc = voltages[c.nodes[1]] ?? 0;
      const ve = voltages[c.nodes[2]] ?? 0;
      const idx = activeSources.findIndex((s) => s.id === `${c.id}_BE`);
      const ib = idx >= 0 ? solution[numV + idx] : (vb - ve) / R_DIODE_OFF;
      const ic = st.ce === 'on' ? (vc - ve - c.vceSat) / c.rceSat : (vc - ve) / R_OPEN;
      branches[c.id] = {
        voltage: vc - ve,
        current: ic,
        terminalCurrents: { [c.nodes[0]]: ib, [c.nodes[1]]: ic, [c.nodes[2]]: -(ib + ic) },
      };
    } else if (c.kind === 'dead_npn') {
      const vb = voltages[c.nodes[0]] ?? 0;
      const vc = voltages[c.nodes[1]] ?? 0;
      const ve = voltages[c.nodes[2]] ?? 0;
      const ib = (vb - ve) / R_OPEN;
      const ic = (vc - ve) / R_OPEN;
      branches[c.id] = {
        voltage: vc - ve,
        current: ic,
        terminalCurrents: { [c.nodes[0]]: ib, [c.nodes[1]]: ic, [c.nodes[2]]: -(ib + ic) },
      };
    } else if (c.kind === 'mosfet' || c.kind === 'dead_mosfet' || c.kind === 'short_mosfet') {
      const vg = voltages[c.nodes[0]] ?? 0;
      const vd = voltages[c.nodes[1]] ?? 0;
      const vs = voltages[c.nodes[2]] ?? 0;
      const ig = (vg - vs) / R_OPEN;
      const rds = c.kind === 'short_mosfet' ? R_SHORT : c.kind === 'mosfet' && mosfetStates.get(c.id) === 'on' ? c.rdsOn : R_OPEN;
      const id = (vd - vs) / rds;
      branches[c.id] = {
        voltage: vd - vs,
        current: id,
        terminalCurrents: { [c.nodes[0]]: ig, [c.nodes[1]]: id, [c.nodes[2]]: -(ig + id) },
      };
    } else if (c.kind === 'opamp') {
      const idx = activeOpamps.findIndex((o) => o.id === c.id);
      const iOut = idx >= 0 ? solution[numV + activeSources.length + idx] : 0;
      branches[c.id] = {
        voltage: voltages[c.nodes[2]] ?? 0,
        current: -iOut,
        terminalCurrents: { [c.nodes[0]]: 0, [c.nodes[1]]: 0, [c.nodes[2]]: iOut, [ground]: -iOut },
      };
    } else if (c.kind === 'dead_opamp') {
      const vOut = voltages[c.nodes[2]] ?? 0;
      const iOut = vOut / R_OPEN;
      branches[c.id] = {
        voltage: vOut,
        current: iOut,
        terminalCurrents: { [c.nodes[0]]: 0, [c.nodes[1]]: 0, [c.nodes[2]]: iOut, [ground]: -iOut },
      };
    } else if (c.kind === 'regulator') {
      const idx = activeSources.findIndex((s) => s.id === c.id);
      const iOut = idx >= 0 ? solution[numV + idx] : 0;
      branches[c.id] = {
        voltage: (voltages[c.nodes[1]] ?? 0) - (voltages[c.nodes[2]] ?? 0),
        current: -iOut,
        terminalCurrents: { [c.nodes[0]]: 0, [c.nodes[1]]: iOut, [c.nodes[2]]: -iOut },
      };
    } else if (c.kind === 'dead_reg') {
      const vOut = (voltages[c.nodes[1]] ?? 0) - (voltages[c.nodes[2]] ?? 0);
      const iOut = vOut / R_OPEN;
      branches[c.id] = {
        voltage: vOut,
        current: iOut,
        terminalCurrents: { [c.nodes[0]]: 0, [c.nodes[1]]: iOut, [c.nodes[2]]: -iOut },
      };
    }
  }

  if (powerOn && circuit.supply) {
    const supId = circuit.supply.id || 'V1';
    const vSup = (voltages[circuit.supply.positive] ?? 0) - (voltages[circuit.supply.negative] ?? 0);
    branches[supId] = { voltage: vSup, current: solution[numV] ?? 0 };
  }

  return { converged, singular: false, voltages, branches };
}

export function nodeCurrentBalance(circuit, solved, options = {}) {
  const powerOn = options.powerOn !== false;
  const balance = {};
  for (const node of circuit.nodes) balance[node] = 0;

  for (const comp of circuit.components) {
    const br = solved.branches[comp.id];
    if (!br) continue;
    if (br.terminalCurrents) {
      for (const [node, curr] of Object.entries(br.terminalCurrents)) {
        balance[node] -= curr;
      }
    } else {
      const [n0, n1] = br.nodes || comp.nodes;
      balance[n0] -= br.current;
      balance[n1] += br.current;
    }
  }

  if (powerOn && circuit.supply) {
    const supId = circuit.supply.id || 'V1';
    const br = solved.branches[supId];
    if (br) {
      balance[circuit.supply.positive] -= br.current;
      balance[circuit.supply.negative] += br.current;
    }
  }

  return balance;
}

export function measureVoltage(circuit, redNode, blackNode, options = {}) {
  const solved = solveCircuit(circuit, options);
  if (!solved.converged || solved.singular) return { valid: false, ol: false, volts: null };
  return { valid: true, ol: false, volts: (solved.voltages[redNode] ?? 0) - (solved.voltages[blackNode] ?? 0) };
}

export function measureResistance(circuit, redNode, blackNode, options = {}) {
  if (options.powerOn) {
    return { valid: false, unstable: true, ol: false, ohms: null, warning: 'Never measure resistance on a powered circuit' };
  }
  if (redNode === blackNode) return { valid: true, unstable: false, ol: false, ohms: 0 };

  const faultActive = options.faultActive !== false;
  const edges = [];
  const adj = new Map(circuit.nodes.map((n) => [n, []]));

  for (const comp of circuit.components) {
    const eff = getEffectiveComponent(comp, circuit.fault, faultActive);
    if (eff.kind === 'vsource') continue;
    if (eff.kind === 'resistor') {
      const [n1, n2] = eff.nodes;
      edges.push([n1, n2, eff.r]);
      if (adj.has(n1)) adj.get(n1).push(n2);
      if (adj.has(n2)) adj.get(n2).push(n1);
    } else if (eff.kind === 'led' || eff.kind === 'diode' || eff.kind === 'zener') {
      const [n1, n2] = eff.nodes;
      edges.push([n1, n2, eff.leakR ?? R_OPEN]);
      if (adj.has(n1)) adj.get(n1).push(n2);
      if (adj.has(n2)) adj.get(n2).push(n1);
    }
  }

  const reachable = new Set([blackNode]);
  const queue = [blackNode];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nxt of adj.get(cur) || []) {
      if (!reachable.has(nxt)) {
        reachable.add(nxt);
        queue.push(nxt);
      }
    }
  }

  if (!reachable.has(redNode)) return { valid: true, unstable: false, ol: true, ohms: Infinity };

  const otherNodes = [...reachable].filter((n) => n !== blackNode);
  const varMap = new Map(otherNodes.map((n, i) => [n, i]));
  const dim = otherNodes.length;
  const A = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const z = new Array(dim).fill(0);

  for (const [n1, n2, r] of edges) {
    if (!reachable.has(n1) || !reachable.has(n2)) continue;
    const g = 1 / Math.max(r, 1e-9);
    const i1 = varMap.get(n1);
    const i2 = varMap.get(n2);
    if (i1 !== undefined) A[i1][i1] += g;
    if (i2 !== undefined) A[i2][i2] += g;
    if (i1 !== undefined && i2 !== undefined) {
      A[i1][i2] -= g;
      A[i2][i1] -= g;
    }
  }

  const ia = varMap.get(redNode);
  if (ia !== undefined) z[ia] = 1.0;

  const x = solveLinearSystem(A, z);
  if (!x) return { valid: false, unstable: true, ol: false, ohms: null };

  const ohms = Math.abs(x[ia]);
  if (ohms > OHM_OL_THRESHOLD) return { valid: true, unstable: false, ol: true, ohms: Infinity };
  return { valid: true, unstable: false, ol: false, ohms };
}

export function measureContinuity(circuit, redNode, blackNode, options = {}) {
  const res = measureResistance(circuit, redNode, blackNode, options);
  if (!res.valid) return { ...res, beep: false };
  return { ...res, beep: !res.ol && res.ohms < 50 };
}