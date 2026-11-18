/**
 * FaultFinder DC Circuit Solver (Modified Nodal Analysis + Ideal Piecewise-Linear Diodes)
 * Single source of truth for all voltage, resistance, continuity, and KVL/KCL checks.
 */

const R_OPEN = 1e12;
const R_DIODE_OFF = 1e8;
const R_SHORT = 0.01;
const R_BLEED = 1e11;
const OHM_OL_THRESHOLD = 4e7; // 40 MOhm DMM over-range

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
    if (maxAbs < 1e-15) {
      return null;
    }
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

  if (comp.type === 'resistor') {
    if (fType === 'open' || fType === 'dead') return { ...comp, kind: 'resistor', r: R_OPEN };
    if (fType === 'short') return { ...comp, kind: 'resistor', r: R_SHORT };
    if (fType === 'wrong_value') return { ...comp, kind: 'resistor', r: fault.value ?? comp.wrongValue ?? comp.value };
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
    if (fType === 'leaky') return { ...comp, kind: 'resistor', r: fault.value ?? 470 };
    return { ...comp, kind: 'resistor', r: R_OPEN };
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
  const diodeStates = new Map(diodes.map((d) => [d.id, 'off']));

  let solution = null;
  let converged = false;
  let activeSources = [];

  for (let iter = 0; iter < 40; iter += 1) {
    activeSources = [];
    if (powerOn && circuit.supply) {
      activeSources.push({
        id: circuit.supply.id || 'V1',
        pos: circuit.supply.positive,
        neg: circuit.supply.negative,
        voltage: circuit.supply.voltage,
        isSupply: true,
      });
    }
    for (const d of diodes) {
      const st = diodeStates.get(d.id);
      if (st === 'fwd') {
        activeSources.push({ id: d.id, pos: d.nodes[0], neg: d.nodes[1], voltage: d.vf, isDiode: true });
      } else if (st === 'zener') {
        activeSources.push({ id: d.id, pos: d.nodes[1], neg: d.nodes[0], voltage: d.vz, isDiode: true, reversed: true });
      }
    }

    const dim = numV + activeSources.length;
    const A = Array.from({ length: dim }, () => new Array(dim).fill(0));
    const z = new Array(dim).fill(0);

    for (let i = 0; i < numV; i += 1) {
      A[i][i] += 1 / R_BLEED;
    }

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

    for (const c of effComps) {
      if (c.kind === 'resistor') {
        stampResistor(c.nodes[0], c.nodes[1], c.r);
      } else {
        if (c.leakR) stampResistor(c.nodes[0], c.nodes[1], c.leakR);
        if (diodeStates.get(c.id) === 'off') {
          stampResistor(c.nodes[0], c.nodes[1], R_DIODE_OFF);
        }
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

    solution = solveLinearSystem(A, z);
    if (!solution) {
      return { converged: false, singular: true, voltages: {}, branches: {} };
    }

    const getV = (node) => (node === ground ? 0 : solution[varMap.get(node)] ?? 0);
    let changed = false;

    for (const d of diodes) {
      const va = getV(d.nodes[0]);
      const vc = getV(d.nodes[1]);
      const vDrop = va - vc;
      const prev = diodeStates.get(d.id);
      let next = prev;

      if (prev === 'off') {
        if (vDrop > d.vf + 1e-6) next = 'fwd';
        else if (d.kind === 'zener' && -vDrop > d.vz + 1e-6) next = 'zener';
      } else {
        const srcIdx = activeSources.findIndex((s) => s.id === d.id);
        const rawI = srcIdx >= 0 ? solution[numV + srcIdx] : 0;
        if (rawI < -1e-9) next = 'off';
      }

      if (next !== prev) {
        diodeStates.set(d.id, next);
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
      branches[c.id] = { voltage: vDiff, current: vDiff / c.r };
    } else {
      const st = diodeStates.get(c.id);
      const srcIdx = activeSources.findIndex((s) => s.id === c.id);
      let current = srcIdx >= 0 ? solution[numV + srcIdx] : vDiff / R_DIODE_OFF;
      if (st === 'zener') current = -current;
      if (c.leakR) current += vDiff / c.leakR;
      branches[c.id] = { voltage: vDiff, current, state: st };
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
  for (const node of circuit.nodes) {
    balance[node] = 0;
  }

  for (const comp of circuit.components) {
    const br = solved.branches[comp.id];
    if (!br) continue;
    balance[comp.nodes[0]] -= br.current;
    balance[comp.nodes[1]] += br.current;
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
  if (!solved.converged || solved.singular) {
    return { valid: false, ol: false, volts: null };
  }
  const vRed = solved.voltages[redNode] ?? 0;
  const vBlack = solved.voltages[blackNode] ?? 0;
  return { valid: true, ol: false, volts: vRed - vBlack };
}

export function measureResistance(circuit, redNode, blackNode, options = {}) {
  if (options.powerOn) {
    return {
      valid: false,
      unstable: true,
      ol: false,
      ohms: null,
      warning: 'Never measure resistance on a powered circuit',
    };
  }
  if (redNode === blackNode) {
    return { valid: true, unstable: false, ol: false, ohms: 0 };
  }

  const faultActive = options.faultActive !== false;
  const edges = [];
  const adj = new Map(circuit.nodes.map((n) => [n, []]));

  for (const comp of circuit.components) {
    const eff = getEffectiveComponent(comp, circuit.fault, faultActive);
    const r = eff.kind === 'resistor' ? eff.r : (eff.leakR ?? R_OPEN);
    const [n1, n2] = eff.nodes;
    edges.push([n1, n2, r]);
    if (adj.has(n1)) adj.get(n1).push(n2);
    if (adj.has(n2)) adj.get(n2).push(n1);
  }

  // BFS from blackNode so only connected nodes enter MNA (no bleed resistor bias)
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

  if (!reachable.has(redNode)) {
    return { valid: true, unstable: false, ol: true, ohms: Infinity };
  }

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
  if (!x) {
    return { valid: false, unstable: true, ol: false, ohms: null };
  }

  const ohms = Math.abs(x[ia]);
  if (ohms > OHM_OL_THRESHOLD) {
    return { valid: true, unstable: false, ol: true, ohms: Infinity };
  }
  return { valid: true, unstable: false, ol: false, ohms };
}

export function measureContinuity(circuit, redNode, blackNode, options = {}) {
  const res = measureResistance(circuit, redNode, blackNode, options);
  if (!res.valid) return { ...res, beep: false };
  return { ...res, beep: !res.ol && res.ohms < 50 };
}