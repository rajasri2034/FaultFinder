/** Stage 3 cases (0-10). Expected numbers are for tests and written verification only. */

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
      { text: 'The LED is out. One series part is open. This pass takes under 30 seconds, and you can skip it.', highlight: 'brief' },
      { text: 'Black is already on TP3, ground. Tap TP2 to put the red probe on the LED anode.', highlight: 'TP2', when: { red: 'TP2' } },
      { text: 'DC voltage is selected and the power is on. The meter is taking the reading.', highlight: 'meter', when: { measured: { mode: 'voltage', red: 'TP2', black: 'TP3' } } },
      { text: 'A healthy red LED would sit near 2 V. If this one does not, check the voltage across R1, then file the diagnosis.', highlight: 'submit' },
    ],
    explanation:
      'R1 is open. With the resistor removed, no current flows, so the LED never reaches its 2.00 V forward drop and the voltage at TP2 is 0.00 V. The battery still reads 9.00 V from TP1 to TP3, and that entire 9.00 V appears from TP1 to TP2, across the open resistor. Power off, the ohms reading across R1 is OL instead of 470 Ω.',
    learn:
      'Series parts share one current. Ohm’s law says a part with no current across it drops no voltage, so the open gap is left holding the supply.',
    expected: {
      healthy: { voltage: { 'TP1,TP3': 9, 'TP2,TP3': 2, 'TP1,TP2': 7 }, resistance: { 'TP1,TP2': 470, 'TP2,TP3': 'OL' }, current: { R1: 7 / 470, D1: 7 / 470 } },
      faulty: { voltage: { 'TP1,TP3': 9, 'TP2,TP3': 0, 'TP1,TP2': 9 }, resistance: { 'TP1,TP2': 'OL', 'TP2,TP3': 'OL' }, current: { D1: 0 } },
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
      'D1 is open. No current can flow, so R1 drops 0.00 V from TP1 to TP2 and the full 5.00 V rail appears across the LED from TP2 to TP3. With power off, R1 still measures 330 Ω, proving D1 is open.',
    learn:
      'A working LED holds a roughly fixed forward drop while the series resistor sets the current, I = (Vsupply − Vf) / R. When the LED is open it cannot clamp, and the anode rises to the rail.',
    expected: {
      healthy: { voltage: { 'TP1,TP3': 5, 'TP2,TP3': 2, 'TP1,TP2': 3 }, resistance: { 'TP1,TP2': 330, 'TP2,TP3': 'OL' }, current: { R1: 3 / 330, D1: 3 / 330 } },
      faulty: { voltage: { 'TP1,TP3': 5, 'TP2,TP3': 5, 'TP1,TP2': 0 }, resistance: { 'TP1,TP2': 330, 'TP2,TP3': 'OL' }, current: { R1: 0, D1: 0 } },
    },
  },
  {
    id: 'case-2',
    number: 2,
    chapter: 'Basics',
    title: 'Dim LED',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: the 9 V indicator LED barely glows—you can only see it in a dark room.',
    pitch: 'A 9 V supply, one resistor, and a red LED. Wrong resistor fitted.',
    supply: { id: 'V1', voltage: 9, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_MID', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Series resistor (470 Ω marked)', value: 470, tolerance: 0.01, nodes: ['N_POS', 'N_MID'] },
      { id: 'D1', type: 'led', name: 'Indicator LED', color: 'red', vf: 2, nodes: ['N_MID', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '9 V rail' },
      { id: 'TP2', node: 'N_MID', label: 'TP2', name: 'LED anode' },
      { id: 'TP3', node: 'N_GND', label: 'TP3', name: 'GND' },
    ],
    defaultBlack: 'TP3',
    fault: { component: 'R1', type: 'wrong-value', value: 47000 },
    checks: [
      { mode: 'voltage', red: 'TP2', black: 'TP3', label: 'LED TP2 to TP3' },
      { mode: 'resistance', red: 'TP1', black: 'TP2', label: 'R1 ohms, power off' },
    ],
    hints: [
      'The voltages look almost normal because the LED still clamps around 2 V. Why is it so dim?',
      'A dim LED means current is 100x too small. Check R1 with power OFF.',
      'Switch POWER OFF, select Ω mode, and measure R1 between TP1 and TP2.',
    ],
    explanation: 'R1 was fitted as 47 kΩ instead of 470 Ω. By Ohm’s law, I = (9 − 2) / 47000 = 0.149 mA instead of 14.9 mA, leaving the LED barely visible.',
    learn: 'In a series LED circuit, the resistor sets the current via I = (Vsupply − Vf) / R. Even when voltages look normal, a resistor 100× too large starves the LED of current.',
    expected: {
      healthy: { voltage: { 'TP1,TP3': 9, 'TP2,TP3': 2, 'TP1,TP2': 7 }, resistance: { 'TP1,TP2': 470 }, current: { R1: 7 / 470 } },
      faulty: { voltage: { 'TP1,TP3': 9, 'TP2,TP3': 2, 'TP1,TP2': 7 }, resistance: { 'TP1,TP2': 47000 }, current: { R1: 7 / 47000 } },
    },
  },
  {
    id: 'case-3',
    number: 3,
    chapter: 'Basics',
    title: 'Voltage Divider',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: the 6 V reference output from this 12 V divider jumped to 12 V and overloaded the ADC.',
    pitch: '12 V supply feeding two 1 kΩ resistors in series.',
    supply: { id: 'V1', voltage: 12, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_OUT', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Top resistor', value: 1000, nodes: ['N_POS', 'N_OUT'] },
      { id: 'R2', type: 'resistor', name: 'Bottom resistor', value: 1000, nodes: ['N_OUT', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '12 V In' },
      { id: 'TP2', node: 'N_OUT', label: 'TP2', name: 'Vout (6 V)' },
      { id: 'TP3', node: 'N_GND', label: 'TP3', name: 'GND' },
    ],
    defaultBlack: 'TP3',
    fault: { component: 'R2', type: 'open' },
    checks: [
      { mode: 'voltage', red: 'TP2', black: 'TP3', label: 'Divider Out TP2 to TP3' },
      { mode: 'resistance', red: 'TP2', black: 'TP3', label: 'R2 ohms, power off' },
    ],
    hints: [
      'A 1 kΩ / 1 kΩ divider on 12 V should output 6.00 V at TP2.',
      'If TP2 sits at the full 12.00 V rail, the bottom path to ground is broken.',
      'Power OFF and measure resistance across R2 (TP2 to TP3).',
    ],
    explanation: 'R2 is open circuit. With no path to ground, zero current flows through R1 (0 V drop), pulling TP2 up to the full 12.00 V supply. Power off, R2 reads OL instead of 1 kΩ.',
    learn: 'A voltage divider relies on current flowing through both resistors: Vout = Vin × R2 / (R1 + R2). If the bottom resistor opens, Vout floats straight up to Vin.',
    expected: {
      healthy: { voltage: { 'TP1,TP3': 12, 'TP2,TP3': 6 }, resistance: { 'TP2,TP3': 1000 }, current: { R1: 0.006, R2: 0.006 } },
      faulty: { voltage: { 'TP1,TP3': 12, 'TP2,TP3': 12 }, resistance: { 'TP2,TP3': 'OL' }, current: { R1: 0, R2: 0 } },
    },
  },
  {
    id: 'case-4',
    number: 4,
    chapter: 'Basics',
    title: 'LED Reversed',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: after replacing the indicator LED, the board powers on (5 V) but the LED stays dark.',
    pitch: '5 V rail, 330 Ω resistor, and a newly soldered red LED.',
    supply: { id: 'V1', voltage: 5, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_MID', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Series resistor', value: 330, nodes: ['N_POS', 'N_MID'] },
      { id: 'D1', type: 'led', name: 'Indicator LED', color: 'red', vf: 2, nodes: ['N_MID', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '5 V rail' },
      { id: 'TP2', node: 'N_MID', label: 'TP2', name: 'LED pad' },
      { id: 'TP3', node: 'N_GND', label: 'TP3', name: 'GND' },
    ],
    defaultBlack: 'TP3',
    fault: { component: 'D1', type: 'reversed' },
    checks: [
      { mode: 'voltage', red: 'TP2', black: 'TP3', label: 'LED TP2 to TP3' },
      { mode: 'resistance', red: 'TP1', black: 'TP2', label: 'R1 ohms, power off' },
    ],
    hints: [
      'A freshly soldered LED that never lights is often installed backwards.',
      'Measure TP2 to GND: a reversed LED blocks current just like an open diode, leaving TP2 at 5.00 V.',
      'Verify R1 is 330 Ω with power OFF; since D1 was just replaced, its polarity is reversed.',
    ],
    explanation: 'D1 was soldered with reversed polarity. Reverse-biased, it blocks current so R1 drops 0.00 V and TP2 rises to 5.00 V instead of 2.00 V.',
    learn: 'Diodes and LEDs conduct in one direction only (anode to cathode). Reversing an LED puts it in reverse bias, blocking current and raising its anode pad to the supply rail.',
    expected: {
      healthy: { voltage: { 'TP1,TP3': 5, 'TP2,TP3': 2 }, resistance: { 'TP1,TP2': 330 }, current: { R1: 3 / 330 } },
      faulty: { voltage: { 'TP1,TP3': 5, 'TP2,TP3': 5 }, resistance: { 'TP1,TP2': 330 }, current: { R1: 0 } },
    },
  },
  {
    id: 'case-5',
    number: 5,
    chapter: 'Analog',
    title: 'Leaky Capacitor',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: the RC delay node never charges up to 10 V—it gets stuck halfway.',
    pitch: '10 V supply, 1 kΩ charging resistor, and a 100 µF electrolytic capacitor.',
    supply: { id: 'V1', voltage: 10, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_CAP', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Charge resistor', value: 1000, nodes: ['N_POS', 'N_CAP'] },
      { id: 'C1', type: 'capacitor', name: 'Timing cap (100 µF)', value: 100e-6, nodes: ['N_CAP', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '10 V' },
      { id: 'TP2', node: 'N_CAP', label: 'TP2', name: 'Cap +' },
      { id: 'TP3', node: 'N_GND', label: 'TP3', name: 'GND' },
    ],
    defaultBlack: 'TP3',
    fault: { component: 'C1', type: 'leaky', value: 1000 },
    checks: [
      { mode: 'voltage', red: 'TP2', black: 'TP3', label: 'Cap voltage TP2 to TP3' },
      { mode: 'resistance', red: 'TP2', black: 'TP3', label: 'C1 leakage ohms, power off' },
    ],
    hints: [
      'In DC steady state, a healthy capacitor charges to the full 10.00 V supply.',
      'If TP2 is stuck at 5.00 V, something is bleeding current to ground.',
      'Power OFF and measure resistance across C1 (TP2 to TP3). A healthy cap reads OL, not 1 kΩ.',
    ],
    explanation: 'C1 is leaky (~1 kΩ internal leakage). Combined with R1 (1 kΩ), it forms a voltage divider that clamps TP2 at 5.00 V instead of 10.00 V.',
    learn: 'An ideal capacitor blocks DC once charged (reading OL in Ω mode). A leaky electrolytic acts like a parallel resistor, pulling down the RC node voltage.',
    expected: {
      healthy: { voltage: { 'TP1,TP3': 10, 'TP2,TP3': 10 }, resistance: { 'TP2,TP3': 'OL' }, current: { R1: 0 } },
      faulty: { voltage: { 'TP1,TP3': 10, 'TP2,TP3': 5 }, resistance: { 'TP2,TP3': 1000 }, current: { R1: 0.005 } },
    },
  },
  {
    id: 'case-6',
    number: 6,
    chapter: 'Transistors & Motors',
    title: 'NPN Transistor Switch',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: the 5 V logic input is high, but the 9 V LED load driven by Q1 never turns on.',
    pitch: '5 V control signal -> R_B (1 kΩ) -> NPN Q1 switching a 9 V LED.',
    supply: { id: 'V1', voltage: 9, positive: 'N_VCC', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_VCC', 'N_IN', 'N_B', 'N_A', 'N_C', 'N_GND'],
    components: [
      { id: 'V_CTRL', type: 'vsource', name: '5 V Logic Input', value: 5, nodes: ['N_IN', 'N_GND'] },
      { id: 'R_B', type: 'resistor', name: 'Base resistor', value: 1000, nodes: ['N_IN', 'N_B'] },
      { id: 'Q1', type: 'npn', name: 'NPN Switch (2N2222)', nodes: ['N_B', 'N_C', 'N_GND'] },
      { id: 'R_C', type: 'resistor', name: 'Collector resistor', value: 470, nodes: ['N_VCC', 'N_A'] },
      { id: 'D1', type: 'led', name: 'Load LED', color: 'red', vf: 2, nodes: ['N_A', 'N_C'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_IN', label: 'TP1', name: '5 V Ctrl' },
      { id: 'TP2', node: 'N_B', label: 'TP2', name: 'Q1 Base' },
      { id: 'TP3', node: 'N_C', label: 'TP3', name: 'Q1 Collector' },
      { id: 'TP4', node: 'N_GND', label: 'TP4', name: 'GND' },
    ],
    defaultBlack: 'TP4',
    fault: { component: 'R_B', type: 'open' },
    checks: [
      { mode: 'voltage', red: 'TP2', black: 'TP4', label: 'Base voltage TP2 to TP4' },
      { mode: 'resistance', red: 'TP1', black: 'TP2', label: 'R_B ohms, power off' },
    ],
    hints: [
      'An ON NPN transistor has ~0.7 V at its base (TP2) and ~0.2 V at its collector (TP3).',
      'Check if base drive is actually reaching TP2 from TP1 (5 V).',
      'Power OFF and measure R_B between TP1 and TP2.',
    ],
    explanation: 'R_B is open circuit. No base current reaches Q1 (TP2 = 0.00 V instead of 0.70 V), so Q1 stays OFF and the collector floats near 9.00 V.',
    learn: 'An NPN low-side switch needs base current through R_B to turn ON (Vbe ≈ 0.7 V, Vce(sat) ≈ 0.2 V). If R_B opens, the transistor stays cut off.',
    expected: {
      healthy: { voltage: { 'TP1,TP4': 5, 'TP2,TP4': 0.7, 'TP3,TP4': 0.214 }, resistance: { 'TP1,TP2': 1000 }, current: { R_B: 0.0043 } },
      faulty: { voltage: { 'TP1,TP4': 5, 'TP2,TP4': 0, 'TP3,TP4': 8.99 }, resistance: { 'TP1,TP2': 'OL' }, current: { R_B: 0 } },
    },
  },
  {
    id: 'case-7',
    number: 7,
    chapter: 'Transistors & Motors',
    title: 'Motor Driver Mini-Circuit',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: Q1 is getting hot and the 12 V DC motor does not spin at all.',
    pitch: '12 V DC motor + flyback diode D1 switched by NPN transistor Q1.',
    supply: { id: 'V1', voltage: 12, positive: 'N_VCC', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_VCC', 'N_IN', 'N_B', 'N_C', 'N_GND'],
    components: [
      { id: 'V_CTRL', type: 'vsource', name: '5 V Logic Input', value: 5, nodes: ['N_IN', 'N_GND'] },
      { id: 'R_B', type: 'resistor', name: 'Base resistor', value: 1000, nodes: ['N_IN', 'N_B'] },
      { id: 'Q1', type: 'npn', name: 'Driver NPN', nodes: ['N_B', 'N_C', 'N_GND'] },
      { id: 'M1', type: 'motor', name: '12V DC Motor (100 Ω)', value: 100, nodes: ['N_VCC', 'N_C'] },
      { id: 'D1', type: 'diode', name: 'Flyback Diode', vf: 0.7, nodes: ['N_C', 'N_VCC'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_VCC', label: 'TP1', name: '12 V' },
      { id: 'TP2', node: 'N_C', label: 'TP2', name: 'Motor − / C' },
      { id: 'TP3', node: 'N_B', label: 'TP3', name: 'Q1 Base' },
      { id: 'TP4', node: 'N_GND', label: 'TP4', name: 'GND' },
    ],
    defaultBlack: 'TP4',
    fault: { component: 'D1', type: 'short' },
    checks: [
      { mode: 'voltage', red: 'TP1', black: 'TP2', label: 'Across Motor TP1 to TP2' },
      { mode: 'resistance', red: 'TP1', black: 'TP2', label: 'Motor + D1 ohms, power off' },
    ],
    hints: [
      'Check the voltage across the motor (TP1 to TP2). If Q1 is ON, the motor should drop ~11.7 V.',
      'TP2 is stuck right at 12 V (0.1 V across the motor) even though Q1 base is 0.70 V.',
      'Power OFF and measure resistance/continuity across TP1–TP2. A 0.01 Ω short means the flyback diode shorted.',
    ],
    explanation: 'Flyback diode D1 failed short circuit (0.01 Ω) directly across motor M1, bypassing all current away from the motor windings and pulling TP2 up to ~11.9 V.',
    learn: 'A flyback diode protects transistors from inductive voltage spikes when a motor turns off. If it fails short, it bypasses the motor completely and overloads the driver.',
    expected: {
      healthy: { voltage: { 'TP1,TP4': 12, 'TP3,TP4': 0.7, 'TP1,TP2': 11.68 }, resistance: { 'TP1,TP2': 100 }, current: { M1: 0.1168 } },
      faulty: { voltage: { 'TP1,TP4': 12, 'TP3,TP4': 0.7, 'TP1,TP2': 0.12 }, resistance: { 'TP1,TP2': 0.01 }, current: { M1: 0.0012 } },
    },
  },
  {
    id: 'case-8',
    number: 8,
    chapter: 'Analog',
    title: 'Sensor Module',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: 12 V power is connected, but the 5 V sensor output and status LED are both dead.',
    pitch: '12 V input -> 5 V regulator U1 -> sensor divider (R1, R2) + LED (R3, D1).',
    supply: { id: 'V1', voltage: 12, positive: 'N_VIN', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_VIN', 'N_5V', 'N_SENS', 'N_LED', 'N_GND'],
    components: [
      { id: 'U1', type: 'regulator', name: '7805 5V Regulator', vout: 5, nodes: ['N_VIN', 'N_5V', 'N_GND'] },
      { id: 'R1', type: 'resistor', name: 'Sensor top', value: 1000, nodes: ['N_5V', 'N_SENS'] },
      { id: 'R2', type: 'resistor', name: 'Sensor bottom', value: 1000, nodes: ['N_SENS', 'N_GND'] },
      { id: 'R3', type: 'resistor', name: 'LED resistor', value: 330, nodes: ['N_5V', 'N_LED'] },
      { id: 'D1', type: 'led', name: 'Status LED', color: 'red', vf: 2, nodes: ['N_LED', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_VIN', label: 'TP1', name: '12 V In' },
      { id: 'TP2', node: 'N_5V', label: 'TP2', name: '5 V Rail' },
      { id: 'TP3', node: 'N_SENS', label: 'TP3', name: 'Sensor Out' },
      { id: 'TP4', node: 'N_LED', label: 'TP4', name: 'LED Anode' },
      { id: 'TP5', node: 'N_GND', label: 'TP5', name: 'GND' },
    ],
    defaultBlack: 'TP5',
    fault: { component: 'U1', type: 'dead' },
    checks: [
      { mode: 'voltage', red: 'TP1', black: 'TP5', label: 'Input TP1 to TP5' },
      { mode: 'voltage', red: 'TP2', black: 'TP5', label: '5 V rail TP2 to TP5' },
    ],
    hints: [
      'Both the sensor divider and the status LED share one upstream rail.',
      'Check TP1 (12 V input) and TP2 (5 V regulator output).',
      'TP1 is 12.00 V while TP2 is 0.00 V—the 5 V regulator U1 is dead.',
    ],
    explanation: 'U1 (5 V regulator) is dead: 12.00 V is present at TP1, but TP2 outputs 0.00 V, starving both the sensor divider (TP3 = 0.00 V) and LED (TP4 = 0.00 V).',
    learn: 'When multiple downstream branches fail together, always probe the shared power rail first. A dead linear regulator drops the entire regulated bus to 0 V.',
    expected: {
      healthy: { voltage: { 'TP1,TP5': 12, 'TP2,TP5': 5, 'TP3,TP5': 2.5, 'TP4,TP5': 2 }, resistance: {}, current: { R1: 0.0025 } },
      faulty: { voltage: { 'TP1,TP5': 12, 'TP2,TP5': 0, 'TP3,TP5': 0, 'TP4,TP5': 0 }, resistance: {}, current: { R1: 0 } },
    },
  },
  {
    id: 'case-9',
    number: 9,
    chapter: 'Basics',
    title: 'Series Resistor Chain',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: total chain current is 1.00 mA instead of 4.00 mA, and tap voltages are skewed high.',
    pitch: '12 V supply across three 1 kΩ resistors in series (R1, R2, R3).',
    supply: { id: 'V1', voltage: 12, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_1', 'N_2', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Chain R1 (1 kΩ)', value: 1000, nodes: ['N_POS', 'N_1'] },
      { id: 'R2', type: 'resistor', name: 'Chain R2 (1 kΩ)', value: 1000, nodes: ['N_1', 'N_2'] },
      { id: 'R3', type: 'resistor', name: 'Chain R3 (1 kΩ marked)', value: 1000, nodes: ['N_2', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '12 V' },
      { id: 'TP2', node: 'N_1', label: 'TP2', name: 'Node 1 (8 V)' },
      { id: 'TP3', node: 'N_2', label: 'TP3', name: 'Node 2 (4 V)' },
      { id: 'TP4', node: 'N_GND', label: 'TP4', name: 'GND' },
    ],
    defaultBlack: 'TP4',
    fault: { component: 'R3', type: 'wrong-value', value: 10000 },
    checks: [
      { mode: 'voltage', red: 'TP3', black: 'TP4', label: 'Across R3 (TP3 to TP4)' },
      { mode: 'resistance', red: 'TP3', black: 'TP4', label: 'R3 ohms, power off' },
    ],
    hints: [
      'Three equal 1 kΩ resistors on 12 V should step down 12 V → 8 V → 4 V → 0 V.',
      'TP3 is 10.00 V instead of 4.00 V—R3 is taking 10/12 of the supply!',
      'Power OFF and measure R3 (TP3 to TP4) to confirm its actual value.',
    ],
    explanation: 'R3 is 10 kΩ instead of 1 kΩ. Total resistance rose from 3 kΩ to 12 kΩ (I = 1.00 mA), so R3 drops 10.00 V while R1 and R2 drop 1.00 V each.',
    learn: 'In a series chain, voltage divides in proportion to resistance. A resistor 10× larger than marked lowers total current and grabs most of the supply voltage.',
    expected: {
      healthy: { voltage: { 'TP1,TP4': 12, 'TP2,TP4': 8, 'TP3,TP4': 4 }, resistance: { 'TP3,TP4': 1000 }, current: { R3: 0.004 } },
      faulty: { voltage: { 'TP1,TP4': 12, 'TP2,TP4': 11, 'TP3,TP4': 10 }, resistance: { 'TP3,TP4': 10000 }, current: { R3: 0.001 } },
    },
  },
  {
    id: 'case-10',
    number: 10,
    chapter: 'Basics',
    title: 'Parallel LED Branches',
    tutorial: false,
    override: false,
    brief: 'Customer complaint: LED D1 lights normally on the 5 V rail, but parallel branch D2 stays completely dark.',
    pitch: 'Two parallel LED branches (R1+D1 and R2+D2) on a 5 V rail.',
    supply: { id: 'V1', voltage: 5, positive: 'N_POS', negative: 'N_GND' },
    ground: 'N_GND',
    nodes: ['N_POS', 'N_A1', 'N_A2', 'N_GND'],
    components: [
      { id: 'R1', type: 'resistor', name: 'Branch 1 R1', value: 330, nodes: ['N_POS', 'N_A1'] },
      { id: 'D1', type: 'led', name: 'Branch 1 LED', color: 'red', vf: 2, nodes: ['N_A1', 'N_GND'] },
      { id: 'R2', type: 'resistor', name: 'Branch 2 R2', value: 330, nodes: ['N_POS', 'N_A2'] },
      { id: 'D2', type: 'led', name: 'Branch 2 LED', color: 'red', vf: 2, nodes: ['N_A2', 'N_GND'] },
    ],
    testPoints: [
      { id: 'TP1', node: 'N_POS', label: 'TP1', name: '5 V rail' },
      { id: 'TP2', node: 'N_A1', label: 'TP2', name: 'D1 Anode' },
      { id: 'TP3', node: 'N_A2', label: 'TP3', name: 'D2 Anode' },
      { id: 'TP4', node: 'N_GND', label: 'TP4', name: 'GND' },
    ],
    defaultBlack: 'TP4',
    fault: { component: 'R2', type: 'open' },
    checks: [
      { mode: 'voltage', red: 'TP3', black: 'TP4', label: 'D2 Anode TP3 to TP4' },
      { mode: 'resistance', red: 'TP1', black: 'TP3', label: 'R2 ohms, power off' },
    ],
    hints: [
      'Branch 1 (TP2 = 2.00 V) proves the 5 V supply is healthy.',
      'Check TP3 (D2 anode): is it 0 V (upstream open) or 5 V (LED open)?',
      'TP3 is 0.00 V! Power OFF and measure R2 between TP1 and TP3.',
    ],
    explanation: 'R2 is open circuit. D1 still runs normally at 2.00 V (TP2), while TP3 sits at 0.00 V and R2 measures OL with power off.',
    learn: 'Parallel branches operate independently across the same supply rail. An open resistor in one branch shuts off only that branch without affecting the others.',
    expected: {
      healthy: { voltage: { 'TP1,TP4': 5, 'TP2,TP4': 2, 'TP3,TP4': 2 }, resistance: { 'TP1,TP3': 330 }, current: { R1: 3 / 330, R2: 3 / 330 } },
      faulty: { voltage: { 'TP1,TP4': 5, 'TP2,TP4': 2, 'TP3,TP4': 0 }, resistance: { 'TP1,TP3': 'OL' }, current: { R1: 3 / 330, R2: 0 } },
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

export function caseUnlocked(caseNumber, solvedMap) {
  if (caseNumber <= 1) return true;
  return Boolean(solvedMap && solvedMap[caseNumber - 1]);
}