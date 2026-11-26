// Regras puras do turno: esteira, bancada, cortes, pausas e relatório. Sem DOM.

export const WIDTH = 1000;
export const HEIGHT = 520;
export const SHIFT_MS = 90000;
export const HOURS = 8;
export const HOUR_MS = SHIFT_MS / HOURS;
export const BELT_Y = 265;
export const RETURN_X = 640;
export const BENCH = { x: 500, y: 405, scale: 1.5 };
export const TARGET = 18;

// Números de balanceamento reunidos num só lugar.
export const TUNING = {
  // Corte
  tolerance: 30,          // desvio médio aceito (unidades do mundo, na bancada)
  coverageStart: 0.3,     // o traço precisa começar até 30% de uma ponta...
  coverageEnd: 0.7,       // ...e terminar a partir de 70% da outra
  minAlignment: 0.75,     // quanto do deslocamento precisa seguir a direção da linha
  maxTravelRatio: 2.2,    // percurso máximo em relação ao comprimento da linha
  maxDuration: 1800,      // ms; acima disso o traço é considerado impreciso
  minTravel: 20,          // traços menores são ignorados (cliques)
  cleanDeviation: 0.4,    // fração da tolerância para um corte "limpo"
  cleanDuration: 900,     // ms máximos para um corte "limpo"
  // Desgaste
  fatigueTolerance: 0.2,  // perda máxima de tolerância por fadiga
  accidentTolerance: 0.1, // perda extra de tolerância após um acidente
  tremorFatigue: 4,       // amplitude do tremor da lâmina por fadiga
  tremorAccident: 3,      // tremor extra após um acidente
  hastyMargin: 10,        // traço rápido a esta distância da zona de risco também machuca
  hastySpeed: 1.6,        // unidades por ms consideradas "pressa"
  fatiguePerSecond: 0.004,
  fatiguePerStroke: 0.008,
  fatiguePerAccident: 0.15,
  injuryMs: 1500,         // tempo sem conseguir cortar após um acidente
  // Pausa NR-36
  breakMs: 3500,
  breakRecovery: 0.25,
  breakCooldown: 9000,
};

const PAY = {
  base: 6400, piece: 60, streakBonus: 20,
  badReturn: 80, lost: 40, accident: 1250, maxDeduction: 4500,
};

// Coordenadas locais da peça (sem escala). Cada etapa é uma linha de corte.
export const CUTS = {
  peito: {
    risk: [0, 44, 14, 'mao'],
    steps: [[[-52, -16], [53, 14]], [[-30, -32], [-38, 24]], [[22, -34], [30, 22]]],
    names: ['Separar o filé', 'Tira esquerda', 'Tira direita'],
  },
  asa: {
    risk: [0, -12, 12, 'osso'],
    steps: [[[-36, -16], [-28, 28]], [[30, -20], [38, 24]]],
    names: ['Junta interna', 'Junta da ponta'],
  },
  coxa: {
    risk: [12, -30, 12, 'osso'],
    steps: [[[-48, -4], [46, -6]], [[-36, 20], [44, 14]], [[-10, -22], [-30, 18]]],
    names: ['Separar do osso', 'Desfiar', 'Desfiar'],
  },
};
const ORDER = ['peito', 'asa', 'coxa'];

const privateShift = new WeakMap();

export function speedAt(hour) {
  return 70 + 14 * Math.max(0, Math.min(HOURS - 1, hour));
}

function spawnInterval(hour) {
  return 4200 - 260 * Math.max(0, Math.min(HOURS - 1, hour));
}

export function hourAt(elapsed) {
  return Math.max(0, Math.min(HOURS - 1, Math.floor(elapsed / HOUR_MS)));
}

// A esteira acelera em degraus, um por hora do turno.
function beltDistance(elapsed) {
  let distance = 0;
  for (let hour = 0, rest = elapsed; rest > 0; hour++, rest -= HOUR_MS) {
    distance += speedAt(hour) * Math.min(rest, HOUR_MS) / 1000;
  }
  return distance;
}

function timeAtDistance(distance) {
  let time = 0;
  for (let hour = 0; hour < HOURS; hour++) {
    const span = speedAt(hour) * HOUR_MS / 1000;
    if (distance <= span) return time + distance / speedAt(hour) * 1000;
    distance -= span;
    time += HOUR_MS;
  }
  return Infinity;
}

export function playable(x) {
  return x >= 65 && x <= WIDTH - 65;
}

function inside(x, y) {
  return x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;
}

export function expectedBy(elapsed) {
  return Math.round(TARGET * Math.min(elapsed, SHIFT_MS) / SHIFT_MS);
}

// Pontos de uma peça na bancada, em coordenadas do mundo.
export function benchPoint([x, y]) {
  return { x: BENCH.x + BENCH.scale * x, y: BENCH.y + BENCH.scale * y };
}

export function benchRisk(type) {
  const [x, y, r, kind] = CUTS[type].risk;
  return { ...benchPoint([x, y]), r: r * BENCH.scale, kind };
}

export function benchStep(piece, step = piece.step) {
  const line = CUTS[piece.type].steps[step];
  return line && { a: benchPoint(line[0]), b: benchPoint(line[1]) };
}

export function tolerance(state) {
  return TUNING.tolerance
    * (1 - TUNING.fatigueTolerance * state.fatigue - (state.accidents > 0 ? TUNING.accidentTolerance : 0));
}

export function tremor(state) {
  return TUNING.tremorFatigue * state.fatigue + (state.accidents > 0 ? TUNING.tremorAccident : 0);
}

function emit(state, kind, at, extra = {}) {
  const event = { kind, at, seq: state.events.length, ...extra };
  state.events.push(event);
  return event;
}

function addPiece(state, id, x, elapsed) {
  const type = ORDER[id % ORDER.length];
  state.pieces.push({
    id, type, x, y: BELT_Y, step: 0, steps: CUTS[type].steps.length,
    returned: false, origin: x - beltDistance(elapsed),
  });
}

export function createShift(now = 0) {
  const state = {
    elapsed: 0, finished: false, hour: 0, speed: speedAt(0),
    fatigue: 0, maxFatigue: 0,
    processed: 0, errors: 0, cleanCuts: 0, accidents: 0, lost: 0, badReturns: 0,
    breaks: 0, streak: 0, bestStreak: 0, bonus: 0,
    pieces: [], bench: null, stroke: null,
    breakUntil: null, breakReadyAt: 0, injuredUntil: 0,
    events: [],
  };
  privateShift.set(state, { start: now, nextSpawn: spawnInterval(0), nextId: 1, gesture: null });
  addPiece(state, 0, 320, 0);
  return state;
}

function setFatigue(state, value) {
  state.fatigue = Math.max(0, Math.min(1, value));
  state.maxFatigue = Math.max(state.maxFatigue, state.fatigue);
}

function clock(state, now) {
  return Math.max(0, Math.min(SHIFT_MS, now - privateShift.get(state).start));
}

export function advance(state, now) {
  const shift = privateShift.get(state);
  if (!Number.isFinite(now)) return;
  const elapsed = clock(state, now);
  if (elapsed <= state.elapsed) return;
  const previous = state.elapsed;
  const pending = [];

  // Fadiga passiva no trabalho, recuperação durante a pausa.
  let resting = 0;
  if (state.breakUntil !== null) {
    const breakStart = state.breakUntil - TUNING.breakMs;
    resting = Math.max(0, Math.min(elapsed, state.breakUntil) - Math.max(previous, breakStart));
  }
  const working = elapsed - previous - resting;
  setFatigue(state, state.fatigue + working / 1000 * TUNING.fatiguePerSecond
    - resting * TUNING.breakRecovery / TUNING.breakMs);
  if (state.breakUntil !== null && elapsed >= state.breakUntil) {
    pending.push({ kind: 'break-end', at: state.breakUntil });
    state.breakUntil = null;
  }

  while (shift.nextSpawn <= elapsed) {
    const spawn = shift.nextSpawn;
    addPiece(state, shift.nextId++, -75, spawn);
    shift.nextSpawn += spawnInterval(hourAt(spawn));
  }

  const hour = hourAt(elapsed);
  for (let h = state.hour + 1; h <= hour; h++) {
    pending.push({ kind: 'hour', at: h * HOUR_MS, hour: h, expected: expectedBy(h * HOUR_MS), speed: speedAt(h) });
  }
  state.hour = hour;
  state.speed = speedAt(hour);
  state.elapsed = elapsed;

  const distance = beltDistance(elapsed);
  const kept = [];
  for (const piece of state.pieces) {
    piece.x = piece.origin + distance;
    if (piece.x <= WIDTH + 75) {
      kept.push(piece);
    } else if (!piece.returned) {
      state.lost++;
      pending.push({ kind: 'lost', at: timeAtDistance(WIDTH + 75 - piece.origin), id: piece.id });
    }
  }
  state.pieces = kept;

  // Eventos de um mesmo avanço saem em ordem cronológica, independentemente da taxa de quadros.
  pending.sort((a, b) => a.at - b.at);
  for (const { kind, at, ...extra } of pending) {
    if (kind === 'hour') extra.processed = state.processed;
    emit(state, kind, at, extra);
  }

  if (elapsed === SHIFT_MS) {
    state.finished = true;
    cancelStroke(state);
    if (state.bench) {
      state.lost++;
      emit(state, 'lost', elapsed, { id: state.bench.id });
      state.bench = null;
    }
  }
}

// Peça mais à direita ainda ao alcance, sem ter sido processada.
export function grabbable(state) {
  let best = null;
  for (const piece of state.pieces) {
    if (!piece.returned && playable(piece.x) && (!best || piece.x > best.x)) best = piece;
  }
  return best;
}

export function grabPiece(state, now) {
  advance(state, now);
  if (state.finished || state.bench) return null;
  const at = state.elapsed;
  if (state.breakUntil !== null) {
    emit(state, 'blocked', at, { reason: 'break' });
    return 'blocked';
  }
  const piece = grabbable(state);
  if (!piece) {
    emit(state, 'empty', at);
    return 'empty';
  }
  state.pieces = state.pieces.filter(candidate => candidate !== piece);
  state.bench = piece;
  emit(state, 'grab', at, { id: piece.id, type: piece.type });
  return 'grab';
}

export function releasePiece(state, now) {
  advance(state, now);
  if (state.finished || !state.bench) return null;
  cancelStroke(state);
  const piece = state.bench;
  const at = state.elapsed;
  state.bench = null;
  piece.returned = true;
  piece.x = RETURN_X;
  piece.origin = RETURN_X - beltDistance(at);
  state.pieces.push(piece);
  const complete = piece.step >= piece.steps;
  if (complete) state.processed++;
  else state.badReturns++;
  emit(state, complete ? 'done' : 'bad', at, { id: piece.id, step: piece.step, steps: piece.steps });
  return complete ? 'done' : 'bad';
}

// E: pega se a bancada estiver vazia, devolve se estiver ocupada.
export function togglePiece(state, now) {
  advance(state, now);
  return state.bench ? releasePiece(state, now) : grabPiece(state, now);
}

export function breakStatus(state) {
  if (state.finished) return { ready: false, reason: 'finished' };
  if (state.breakUntil !== null) return { ready: false, reason: 'break', remaining: state.breakUntil - state.elapsed };
  if (state.elapsed < state.breakReadyAt) return { ready: false, reason: 'cooldown', remaining: state.breakReadyAt - state.elapsed };
  if (state.bench) return { ready: false, reason: 'busy' };
  return { ready: true };
}

export function takeBreak(state, now) {
  advance(state, now);
  if (state.finished) return null;
  const status = breakStatus(state);
  if (!status.ready) {
    emit(state, 'blocked', state.elapsed, { reason: status.reason, remaining: status.remaining });
    return 'blocked';
  }
  cancelStroke(state);
  state.breakUntil = Math.min(SHIFT_MS, state.elapsed + TUNING.breakMs);
  state.breakReadyAt = state.breakUntil + TUNING.breakCooldown;
  state.breaks++;
  emit(state, 'break', state.elapsed, { until: state.breakUntil });
  return 'break';
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared : 0;
  const fraction = Math.max(0, Math.min(1, projection));
  return Math.hypot(point.x - (a.x + fraction * dx), point.y - (a.y + fraction * dy));
}

function recordAccident(state, kind, at) {
  state.accidents++;
  state.streak = 0;
  state.injuredUntil = at + TUNING.injuryMs;
  setFatigue(state, state.fatigue + TUNING.fatiguePerAccident);
  emit(state, 'accident', at, { risk: kind });
}

function sample(state, x, y, now) {
  const shift = privateShift.get(state);
  const gesture = shift.gesture;
  const last = gesture.samples.at(-1);
  const elapsed = Math.max(last?.elapsed ?? 0, clock(state, now));
  const amplitude = tremor(state);
  const point = {
    x: x + amplitude * Math.sin(elapsed / 37),
    y: y + amplitude * Math.sin(elapsed / 53),
    elapsed,
  };
  if (last && last.x === point.x && last.y === point.y) return;
  gesture.samples.push(point);
  state.stroke.points.push({ x: point.x, y: point.y });
  if (!last) return;

  const distance = Math.hypot(point.x - last.x, point.y - last.y);
  gesture.travel += distance;
  const risk = benchRisk(gesture.piece.type);
  const gap = distanceToSegment(risk, last, point) - risk.r;
  const hasty = distance > TUNING.hastySpeed * Math.max(1, elapsed - last.elapsed);
  if (gap <= 0 || (hasty && gap <= TUNING.hastyMargin)) {
    state.stroke = null;
    shift.gesture = null;
    recordAccident(state, risk.kind, elapsed);
  }
}

// Motivo pelo qual não é possível cortar agora, ou null.
export function cutBlocker(state) {
  if (state.breakUntil !== null) return 'break';
  if (!state.bench) return 'no-piece';
  if (state.elapsed < state.injuredUntil) return 'injured';
  if (state.bench.step >= state.bench.steps) return 'complete';
  return null;
}

export function beginStroke(state, x, y, now) {
  advance(state, now);
  if (state.finished || state.stroke || !inside(x, y) || !Number.isFinite(now)) return null;
  const reason = cutBlocker(state);
  if (reason) {
    emit(state, 'blocked', state.elapsed, { reason });
    return reason;
  }
  privateShift.get(state).gesture = { piece: state.bench, samples: [], travel: 0 };
  state.stroke = { points: [] };
  sample(state, x, y, now);
  return 'stroke';
}

export function moveStroke(state, x, y, now) {
  advance(state, now);
  if (!state.stroke) return;
  if (!inside(x, y) || !Number.isFinite(now)) {
    cancelStroke(state);
    return;
  }
  sample(state, x, y, now);
}

export function cancelStroke(state) {
  state.stroke = null;
  privateShift.get(state).gesture = null;
}

export function judgeStroke(state, samples, line) {
  const first = samples[0];
  const last = samples.at(-1);
  const { a, b } = line;
  let travel = 0;
  let deviationSum = 0;
  for (let i = 1; i < samples.length; i++) {
    const from = samples[i - 1];
    const to = samples[i];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    travel += length;
    deviationSum += length * (distanceToSegment(from, a, b)
      + 4 * distanceToSegment(middle, a, b) + distanceToSegment(to, a, b)) / 6;
  }
  if (travel < TUNING.minTravel) return null;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const project = point => ((point.x - a.x) * dx + (point.y - a.y) * dy) / length;
  const start = project(first);
  const end = project(last);
  const displacement = Math.hypot(last.x - first.x, last.y - first.y);
  const duration = last.elapsed - first.elapsed;
  const deviation = deviationSum / travel;
  const limit = tolerance(state);
  const valid = duration <= TUNING.maxDuration
    && Math.min(start, end) <= length * TUNING.coverageStart
    && Math.max(start, end) >= length * TUNING.coverageEnd
    && Math.abs(end - start) >= displacement * TUNING.minAlignment
    && travel <= length * TUNING.maxTravelRatio
    && deviation <= limit;
  if (!valid) return { kind: 'error', deviation };
  const clean = deviation <= limit * TUNING.cleanDeviation && duration <= TUNING.cleanDuration;
  return { kind: clean ? 'clean' : 'cut', deviation };
}

export function endStroke(state, x, y, now) {
  const shift = privateShift.get(state);
  moveStroke(state, x, y, now);
  const gesture = shift.gesture;
  if (!gesture) return null;
  cancelStroke(state);
  const piece = gesture.piece;
  if (state.bench !== piece || piece.step >= piece.steps) return null;
  const result = judgeStroke(state, gesture.samples, benchStep(piece));
  if (!result) return null;

  const at = gesture.samples.at(-1).elapsed;
  setFatigue(state, state.fatigue + TUNING.fatiguePerStroke);
  if (result.kind === 'error') {
    state.errors++;
    state.streak = 0;
    emit(state, 'error', at, { deviation: result.deviation });
    return 'error';
  }
  const step = piece.step++;
  if (result.kind === 'clean') {
    state.cleanCuts++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (state.streak >= 3) state.bonus += PAY.streakBonus;
  } else {
    state.streak = 0;
  }
  emit(state, result.kind, at, {
    step, steps: piece.steps, complete: piece.step >= piece.steps, streak: state.streak,
  });
  return result.kind;
}

export function report(state) {
  const {
    processed, errors, accidents, fatigue, maxFatigue, lost, badReturns,
    cleanCuts, bestStreak, breaks, bonus,
  } = state;
  const gross = PAY.base + processed * PAY.piece + bonus;
  const deductions = Math.min(gross, PAY.maxDeduction,
    badReturns * PAY.badReturn + lost * PAY.lost + accidents * PAY.accident);
  return {
    processed, target: TARGET, lost, badReturns, cleanCuts, bestStreak,
    fatigue, maxFatigue, errors, accidents, breaks,
    gross, bonus, deductions, net: gross - deductions,
  };
}

export function reflect(result) {
  const { processed, target, accidents, breaks, maxFatigue, lost } = result;
  const met = processed >= target;
  const fatigue = `${Math.round(maxFatigue * 100)}%`;
  const lines = [];
  if (met && accidents > 0) {
    lines.push(`Você bateu a meta, mas sofreu ${accidents} ${accidents === 1 ? 'acidente' : 'acidentes'}. O ritmo que garante a produção é o mesmo que machuca.`);
  } else if (met) {
    lines.push('Meta cumprida sem acidentes. Repare no esforço que isso exigiu em 90 segundos; um turno real dura oito horas, todos os dias.');
  } else if (accidents > 0) {
    lines.push(`A meta não foi atingida e houve ${accidents} ${accidents === 1 ? 'acidente' : 'acidentes'}. Quem se machuca produz menos e ainda arca com descontos.`);
  } else {
    lines.push(`A esteira não espera: ${lost} ${lost === 1 ? 'peça passou' : 'peças passaram'} sem processamento. Trabalhar com cuidado custou produção.`);
  }
  if (breaks === 0 && maxFatigue >= 0.6) {
    lines.push(`Sem pausas, a fadiga chegou a ${fatigue}. A NR-36 prevê pausas de recuperação justamente para reduzir lesões por esforço repetitivo.`);
  } else if (breaks > 0) {
    lines.push(`Você fez ${breaks} ${breaks === 1 ? 'pausa' : 'pausas'}. A esteira continuou andando, mas a fadiga máxima ficou em ${fatigue}.`);
  }
  return lines.join(' ');
}
