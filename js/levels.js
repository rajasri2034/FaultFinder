/** Stage 1 cases. Expected numbers are for tests and the written verification only. */

export const FAULT_TYPES = ['open', 'short', 'wrong-value', 'reversed', 'dead', 'leaky'];

export const FAULT_LABELS = {
  open: 'Open circuit',
  short: 'Short circuit',
  'wrong-value': 'Wrong value',
  reversed: 'Reversed polarity',
  dead: 'Dead',
  leaky: 'Leaky',
};

const SERIES_LAYOUT = {
  type: 'series-led',
  width: 640,
  height: 420,
  points: {
    TP1: { x: 130, y: 150 },
    TP2: { x: 330, y: 150 },
    TP3: { x: 530, y: 150 },
  },
};

export const CASES = [
  {
    id: 'case-0',
    number: 0,
    chapter: 'Basics',
    title: 'Dark Indicator',
    tutorial: true,
    override: false,
    brief: 'Customer complaint: the indicator LED never lights.',
    pitch: 'A 9 V battery, one resistor and a red LED. Find the open part.',
    supply: { id: 'V1', voltage: 9, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_MID', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Series resistor', value: 470, tolerance: 0.01, nodes: ['N_POS', 'N_MID'] },
      { id: 'D1', type: 'led', name: 'Indicator LED', color: 'red', vf: 2, tolerance: 0.05, nodes: ['N_MID', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: 'Battery +' },
      { id: 'TP2', node: 'N_MID', label: 'TP2', name: 'LED anode' },
      { id: 'TP3', node: 'N_GND', label: 'TP3', name: 'GND' },
    ],
    defaultBlack: 'TP3',
    fault: { component: 'R1', type: 'open' },
    layout: SERIES_LAYOUT,
    checks: [
      { mode: 'voltage', red: 'TP1', black: 'TP3', label: 'Battery TP1 to TP3' },
      { mode: 'voltage', red: 'TP2', black: 'TP3', label: 'LED TP2 to TP3' },
      { mode: 'voltage', red: 'TP1', black: 'TP2', label: 'Resistor TP1 to TP2' },
      { mode: 'resistance', red: 'TP1', black: 'TP2', label: 'R1 ohms, power off' },
    ],
    hints: [
      'The LED is dark. In a series circuit that means the supply is missing, or something in the loop is open. One voltage reading will separate those.',
      'Keep the black probe on ground. Look at the LED anode and at both ends of R1.',
      'Power on, DC voltage. Red on TP2, black on TP3. Then red on TP1 and black on TP2.',
    ],
    tutorialSteps: [
      {
        text: 'The LED is out. One series part is open. This pass takes under 30 seconds, and you can skip it.',
        highlight: 'brief',
      },
      {
        text: 'Black is already on TP3, ground. Tap TP2 to put the red probe on the LED anode.',
        highlight: 'TP2',
        when: { red: 'TP2' },
      },
      {
        text: 'DC voltage is selected and the power is on. The meter is taking the reading.',
        highlight: 'meter',
        when: { measured: { mode: 'voltage', red: 'TP2', black: 'TP3' } },
      },
      {
        text: 'A healthy red LED would sit near 2 V. If this one does not, check the voltage across R1, then file the diagnosis.',
        highlight: 'submit',
      },
    ],
    explanation:
      'R1 is open. With the resistor removed, no current flows, so the LED never reaches its 2.00 V forward drop and the voltage at TP2 is 0.00 V. The battery still reads 9.00 V from TP1 to TP3, and that entire 9.00 V appears from TP1 to TP2, across the open resistor. If R1 were really 470 Ω, KVL would split the loop as 7.00 V on the resistor and 2.00 V on the LED: I = (9 − 2) / 470 = 14.9 mA. Power off, the ohms reading across R1 is OL instead of 470 Ω.',
    learn:
      'Series parts share one current. Ohm’s law says a part with no current across it drops no voltage, so the open gap is left holding the supply. Kirchhoff’s voltage law still closes: voltage across the open resistor plus voltage across the dark LED equals the battery.',
    expected: {
      healthy: {
        voltage: { 'TP1,TP3': 9, 'TP2,TP3': 2, 'TP1,TP2': 7 },
        resistance: { 'TP1,TP2': 470, 'TP2,TP3': 'OL' },
        current: { R1: 7 / 470, D1: 7 / 470 },
      },
      faulty: {
        voltage: { 'TP1,TP3': 9, 'TP2,TP3': 0, 'TP1,TP2': 9 },
        resistance: { 'TP1,TP2': 'OL', 'TP2,TP3': 'OL' },
        current: { D1: 0 },
      },
    },
  },
  {
    id: 'case-1',
    number: 1,
    chapter: 'Basics',
    title: 'Dead LED Indicator',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: the 5 V panel LED never lights. The fuse is fine.',
    pitch: 'Series resistor and a red LED on a 5 V rail. One part is open.',
    supply: { id: 'V1', voltage: 5, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_MID', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Series resistor', value: 330, tolerance: 0.01, nodes: ['N_POS', 'N_MID'] },
      { id: 'D1', type: 'led', name: 'Indicator LED', color: 'red', vf: 2, tolerance: 0.05, nodes: ['N_MID', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '5 V rail' },
      { id: 'TP2', node: 'N_MID', label: 'TP2', name: 'LED anode' },
      { id: 'TP3', node: 'N_GND', label: 'TP3', name: 'GND' },
    ],
    defaultBlack: 'TP3',
    fault: { component: 'D1', type: 'open' },
    layout: SERIES_LAYOUT,
    checks: [
      { mode: 'voltage', red: 'TP1', black: 'TP3', label: 'Supply TP1 to TP3' },
      { mode: 'voltage', red: 'TP2', black: 'TP3', label: 'LED TP2 to TP3' },
      { mode: 'voltage', red: 'TP1', black: 'TP2', label: 'Resistor TP1 to TP2' },
      { mode: 'resistance', red: 'TP1', black: 'TP2', label: 'R1 ohms, power off' },
    ],
    hints: [
      'A dark LED is a clue, not the verdict. A healthy red LED on this board would drop about 2 V while it is lit.',
      'Measure around the joint between R1 and D1. That is TP2. Also look at the voltage across the resistor.',
      'Power on, DC voltage. Red on TP2, black on TP3. Then red on TP1, black on TP2. Power off before you trust an ohms reading.',
    ],
    explanation:
      'D1 is open. No current can flow, so R1 drops 0.00 V from TP1 to TP2 and the full 5.00 V rail appears across the LED from TP2 to TP3. A healthy red LED would clamp TP2 at 2.00 V. R1, marked 330 Ω, would then drop the other 3.00 V: I = (5.00 − 2.00) / 330 = 9.09 mA. With power off, R1 still measures 330 Ω, so the resistor is doing its job and the open part is the LED. A red LED often reads OL in resistance mode even when it is healthy, because the meter’s 1 V test is below the 2 V forward drop. Use DC voltage to judge the LED.',
    learn:
      'A working LED holds a roughly fixed forward drop while the series resistor sets the current, I = (Vsupply − Vf) / R. When the LED is open it cannot clamp, the resistor current falls to zero, and the anode rises to the rail. Kirchhoff’s current law is satisfied because both branch currents are zero.',
    expected: {
      healthy: {
        voltage: { 'TP1,TP3': 5, 'TP2,TP3': 2, 'TP1,TP2': 3 },
        resistance: { 'TP1,TP2': 330, 'TP2,TP3': 'OL' },
        current: { R1: 3 / 330, D1: 3 / 330 },
      },
      faulty: {
        voltage: { 'TP1,TP3': 5, 'TP2,TP3': 5, 'TP1,TP2': 0 },
        resistance: { 'TP1,TP2': 330, 'TP2,TP3': 'OL' },
        current: { R1: 0, D1: 0 },
      },
    },
  },
];

export function listCases() {
  return [...CASES].sort((a, b) => a.number - b.number);
}

export function getCase(number) {
  const found = CASES.find((entry) => entry.number === number);
  if (!found) throw new Error(`Missing case ${number}`);
  return found;
}

export function getCaseById(id) {
  const found = CASES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing case ${id}`);
  return found;
}

/** Case 0 and Case 1 stay open so the tutorial can be skipped. Later cases need the previous solve. */
export function caseUnlocked(caseNumber, solvedMap) {
  if (caseNumber <= 1) return true;
  return Boolean(solvedMap && solvedMap[caseNumber - 1]);
}
