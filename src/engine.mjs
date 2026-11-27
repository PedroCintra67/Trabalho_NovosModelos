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
  cutMs: 1600,
  minCutMs: 950,
  fatigueCutMs: 650,
  injuryCutMs: 180,
  goodLeadMs: 520,
  perfectLeadMs: 250,
  perfectMs: 180,
  minPerfectMs: 70,
  fatiguePerfectMs: 90,
  injuryPerfectMs: 35,
  guidedGoodLeadMs: 80,
  guidedPerfectMs: 100,
  perfectPoints: 100,
  goodPoints: 60,
  fatiguePerSecond: 0.004,
  fatiguePerCut: 0.008,
  fatiguePerAccident: 0.15,
  injuryMs: 1500,
  // Pausa NR-36
  breakMs: 3500,
  breakRecovery: 0.25,
  breakCooldown: 9000,
};

const PAY = {
  base: 6400, piece: 60, streakBonus: 20,
  badReturn: 80, lost: 40, accident: 1250, maxDeduction: 4500,
};

const ORDER = ['peito', 'asa', 'coxa'];

const privateShift = new WeakMap();

const BELT_SPEED = 70;
const SPAWN_INTERVAL = 4200;

export function hourAt(elapsed) {
  return Math.max(0, Math.min(HOURS - 1, Math.floor(elapsed / HOUR_MS)));
}

function beltDistance(elapsed) {
  return elapsed * BELT_SPEED / 1000;
}

function timeAtDistance(distance) {
  return distance * 1000 / BELT_SPEED;
}

export function playable(x) {
  return x >= 65 && x <= WIDTH - 65;
}

export function expectedBy(elapsed) {
  return Math.round(TARGET * Math.min(elapsed, SHIFT_MS) / SHIFT_MS);
}

function cutTiming(state, guided) {
  const injured = Number(state.accidents > 0);
  const duration = Math.max(TUNING.minCutMs,
    TUNING.cutMs - TUNING.fatigueCutMs * state.fatigue - TUNING.injuryCutMs * injured);
  const perfectMs = Math.max(TUNING.minPerfectMs,
    TUNING.perfectMs - TUNING.fatiguePerfectMs * state.fatigue - TUNING.injuryPerfectMs * injured)
    + (guided ? TUNING.guidedPerfectMs : 0);
  const deadline = state.elapsed + duration;
  const center = deadline - TUNING.perfectLeadMs;
  return {
    startedAt: state.elapsed,
    goodFrom: deadline - TUNING.goodLeadMs - (guided ? TUNING.guidedGoodLeadMs : 0),
    perfectFrom: center - perfectMs / 2,
    perfectUntil: center + perfectMs / 2,
    deadline,
  };
}

function emit(state, kind, at, extra = {}) {
  const event = { kind, at, seq: state.events.length, ...extra };
  state.events.push(event);
  return event;
}

function addPiece(state, id, x, elapsed) {
  const type = ORDER[id % ORDER.length];
  state.pieces.push({
    id, type, x, y: BELT_Y, cut: null,
    returned: false, origin: x - beltDistance(elapsed),
  });
}

export function createShift(now = 0) {
  const state = {
    elapsed: 0, finished: false, hour: 0, speed: BELT_SPEED,
    fatigue: 0, maxFatigue: 0,
    processed: 0, errors: 0, points: 0, cleanCuts: 0, accidents: 0, lost: 0, badReturns: 0,
    breaks: 0, streak: 0, bestStreak: 0, bonus: 0,
    pieces: [], bench: null,
    breakUntil: null, breakReadyAt: 0, injuredUntil: 0,
    events: [],
  };
  privateShift.set(state, { start: now, nextSpawn: SPAWN_INTERVAL, nextId: 1, timeout: null, guidedUsed: false });
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
  advanceTo(state, shift, clock(state, now));
}

function advanceTo(state, shift, elapsed) {
  if (elapsed <= state.elapsed) return;
  const timing = state.bench?.cut === null ? state.bench.timing : null;
  // Resolva cada transição antes de acumular fadiga ou emitir eventos posteriores.
  const boundary = timing?.deadline ?? state.breakUntil;
  if (boundary !== null && boundary < elapsed) advanceTo(state, shift, boundary);
  const previous = state.elapsed;
  const pending = [];

  const duration = elapsed - previous;
  const fatiguePerMs = state.breakUntil === null
    ? TUNING.fatiguePerSecond / 1000
    : -TUNING.breakRecovery / TUNING.breakMs;
  setFatigue(state, state.fatigue + duration * fatiguePerMs);
  if (state.breakUntil !== null && elapsed >= state.breakUntil) {
    pending.push({ kind: 'break-end', at: state.breakUntil });
    state.breakUntil = null;
  }

  while (shift.nextSpawn <= elapsed) {
    const spawn = shift.nextSpawn;
    addPiece(state, shift.nextId++, -75, spawn);
    shift.nextSpawn += SPAWN_INTERVAL;
  }

  const hour = hourAt(elapsed);
  for (let h = state.hour + 1; h <= hour; h++) {
    pending.push({ kind: 'hour', at: h * HOUR_MS, hour: h, expected: expectedBy(h * HOUR_MS), speed: state.speed });
  }
  state.hour = hour;
  state.elapsed = elapsed;

  const distance = beltDistance(elapsed);
  const kept = [];
  for (const piece of state.pieces) {
    piece.x = piece.origin + distance;
    const exitAt = timeAtDistance(WIDTH + 75 - piece.origin);
    if (elapsed < exitAt) {
      kept.push(piece);
    } else if (!piece.returned) {
      state.lost++;
      pending.push({ kind: 'lost', at: exitAt, id: piece.id });
    }
  }
  state.pieces = kept;

  // Eventos de um mesmo avanço saem em ordem cronológica, independentemente da taxa de quadros.
  pending.sort((a, b) => a.at - b.at);
  for (const { kind, at, ...extra } of pending) {
    if (kind === 'hour') extra.processed = state.processed;
    emit(state, kind, at, extra);
  }

  if (elapsed === timing?.deadline) {
    shift.timeout = {
      at: elapsed, seq: state.events.length, fatigue: state.fatigue, maxFatigue: state.maxFatigue,
      injuredUntil: state.injuredUntil, streak: state.streak,
    };
    state.bench.cut = 'accident';
    state.accidents++;
    state.streak = 0;
    state.injuredUntil = timing.deadline + TUNING.injuryMs;
    setFatigue(state, state.fatigue + TUNING.fatiguePerAccident);
    emit(state, 'accident', timing.deadline, { id: state.bench.id });
  }

  if (elapsed === SHIFT_MS) {
    state.finished = true;
    settleCutTimeout(state);
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
  const reason = state.breakUntil !== null ? 'break' : at < state.injuredUntil ? 'injured' : null;
  if (reason) {
    emit(state, 'blocked', at, { reason });
    return 'blocked';
  }
  const piece = grabbable(state);
  if (!piece) {
    emit(state, 'empty', at);
    return 'empty';
  }
  state.pieces = state.pieces.filter(candidate => candidate !== piece);
  const shift = privateShift.get(state);
  piece.guided = !shift.guidedUsed;
  shift.guidedUsed = true;
  piece.timing = cutTiming(state, piece.guided);
  state.bench = piece;
  emit(state, 'grab', at, { id: piece.id, type: piece.type, guided: piece.guided });
  return 'grab';
}

export function releasePiece(state, now) {
  advance(state, now);
  if (state.finished || !state.bench) return null;
  const piece = state.bench;
  const at = state.elapsed;
  settleCutTimeout(state);
  state.bench = null;
  piece.returned = true;
  piece.x = RETURN_X;
  piece.origin = RETURN_X - beltDistance(at);
  state.pieces.push(piece);
  const complete = piece.cut === 'perfect' || piece.cut === 'good';
  if (complete) state.processed++;
  else state.badReturns++;
  emit(state, complete ? 'done' : 'bad', at, { id: piece.id });
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
  state.breakUntil = Math.min(SHIFT_MS, state.elapsed + TUNING.breakMs);
  state.breakReadyAt = state.breakUntil + TUNING.breakCooldown;
  state.breaks++;
  emit(state, 'break', state.elapsed, { until: state.breakUntil });
  return 'break';
}

function settleCutTimeout(state) {
  privateShift.get(state).timeout = null;
}

function correctCutTimeout(state, timeout) {
  state.bench.cut = null;
  state.accidents--;
  state.injuredUntil = timeout.injuredUntil;
  state.streak = timeout.streak;
  state.maxFatigue = timeout.maxFatigue;
  // Enquanto a peça estiver na bancada, o tempo de jogo após o acidente só acumula fadiga passiva.
  setFatigue(state, timeout.fatigue + (state.elapsed - timeout.at) * TUNING.fatiguePerSecond / 1000);
  state.events.splice(timeout.seq, 1);
  for (let i = timeout.seq; i < state.events.length; i++) state.events[i].seq = i;
  settleCutTimeout(state);
}

export function cutPiece(state, now) {
  if (!Number.isFinite(now)) return null;
  const shift = privateShift.get(state);
  const inputAt = now - shift.start;
  const active = state.bench?.cut === null ? state.bench : null;
  if (state.bench && inputAt < state.bench.timing.startedAt) return null;
  advance(state, now);
  if (state.finished) return null;
  const at = state.elapsed;
  if (active?.cut === 'accident') return 'accident';
  const piece = state.bench;
  if (shift.timeout && inputAt < piece.timing.deadline) correctCutTimeout(state, shift.timeout);
  const reason = state.breakUntil !== null ? 'break'
    : at < state.injuredUntil ? 'injured'
    : !piece ? 'no-piece'
    : piece.cut !== null ? 'resolved'
    : null;
  if (reason) {
    emit(state, 'blocked', at, { reason });
    return reason;
  }

  const { goodFrom, perfectFrom, perfectUntil } = piece.timing;
  setFatigue(state, state.fatigue + TUNING.fatiguePerCut);
  if (inputAt < goodFrom) {
    piece.cut = 'error';
    state.errors++;
    state.streak = 0;
    emit(state, 'error', at, { id: piece.id });
    return piece.cut;
  }

  const perfect = inputAt >= perfectFrom && inputAt <= perfectUntil;
  piece.cut = perfect ? 'perfect' : 'good';
  const points = perfect ? TUNING.perfectPoints : TUNING.goodPoints;
  state.points += points;
  if (perfect) {
    state.cleanCuts++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (state.streak >= 3) state.bonus += PAY.streakBonus;
  } else {
    state.streak = 0;
  }
  emit(state, piece.cut, at, { id: piece.id, points, streak: state.streak });
  return piece.cut;
}

export function report(state) {
  const {
    processed, errors, points, accidents, fatigue, maxFatigue, lost, badReturns,
    cleanCuts, bestStreak, breaks, bonus,
  } = state;
  const gross = PAY.base + processed * PAY.piece + bonus;
  const deductions = Math.min(gross, PAY.maxDeduction,
    badReturns * PAY.badReturn + lost * PAY.lost + accidents * PAY.accident);
  return {
    processed, target: TARGET, points, lost, badReturns, cleanCuts, bestStreak,
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
