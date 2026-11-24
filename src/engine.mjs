export const WIDTH = 1000;
export const HEIGHT = 520;
export const SHIFT_MS = 75000;

const CUTS = [
  { type: 'peito', a: [-52, -16], b: [53, 14], risk: [0, 46, 15, 'mao'] },
  { type: 'asa', a: [-37, 26], b: [38, -23], risk: [4, -29, 13, 'osso'] },
  { type: 'coxa', a: [-47, -15], b: [44, 22], risk: [11, -33, 14, 'osso'] },
];
const privateShift = new WeakMap();
const pieceOrigins = new WeakMap();
const TARGET = 32;
const BASE_PAY = 6400;
const PIECE_PAY = 45;
const ERROR_DEDUCTION = 70;
const ACCIDENT_DEDUCTION = 1250;
const MAX_DEDUCTION = 4500;

// Speed rises from 110 to 240 world units per second.
function beltDistance(elapsed) {
  return elapsed * (110 + 65 * elapsed / SHIFT_MS) / 1000;
}

function worldPoint(x, y, [dx, dy]) {
  return { x: x + dx, y: y + dy };
}

function addPiece(state, id, x, elapsed) {
  const { type, a, b, risk } = CUTS[id % CUTS.length];
  const y = 265;
  const piece = {
    id, x, y, type,
    a: worldPoint(x, y, a),
    b: worldPoint(x, y, b),
    risk: { ...worldPoint(x, y, risk), r: risk[2], kind: risk[3] },
  };
  pieceOrigins.set(piece, x - beltDistance(elapsed));
  state.pieces.push(piece);
}

export function createShift(now = 0) {
  const state = {
    elapsed: 0, finished: false, fatigue: 0,
    processed: 0, errors: 0, accidents: 0,
    pieces: [], stroke: null, event: null, speed: 110,
  };
  privateShift.set(state, { start: now, nextSpawn: 2350, nextId: 1, gesture: null });
  addPiece(state, 0, 300, 0);
  return state;
}

export function advance(state, now) {
  const shift = privateShift.get(state);
  const elapsed = Math.min(SHIFT_MS, now - shift.start);
  if (!Number.isFinite(now) || elapsed <= state.elapsed) return;

  while (shift.nextSpawn <= elapsed) {
    const spawn = shift.nextSpawn;
    addPiece(state, shift.nextId++, -75, spawn);
    shift.nextSpawn += 2350 - 1350 * spawn / SHIFT_MS;
  }

  state.elapsed = elapsed;
  state.speed = 110 + 130 * elapsed / SHIFT_MS;
  for (const piece of state.pieces) {
    const { a, b, risk } = CUTS[piece.id % CUTS.length];
    piece.x = pieceOrigins.get(piece) + beltDistance(elapsed);
    piece.a.x = piece.x + a[0];
    piece.b.x = piece.x + b[0];
    piece.risk.x = piece.x + risk[0];
  }
  state.pieces = state.pieces.filter(piece => piece.x <= WIDTH + 75);
  if (elapsed === SHIFT_MS) {
    state.finished = true;
    cancelStroke(state);
  }
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared : 0;
  const fraction = Math.max(0, Math.min(1, projection));
  return Math.hypot(point.x - (a.x + fraction * dx), point.y - (a.y + fraction * dy));
}

function inside(x, y) {
  return x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;
}

export function playable(x) {
  return x >= 65 && x <= WIDTH - 65;
}

function observeAccident(gesture, last, point, now) {
  if (!last || !gesture.piece || last.pieceX > WIDTH - 65 || gesture.accidentAt !== null) return;

  // Use only the part of the sampled segment before the piece leaves the window.
  const fraction = point.pieceX <= WIDTH - 65 ? 1
    : (WIDTH - 65 - last.pieceX) / (point.pieceX - last.pieceX);
  if (fraction === 0) return;
  const distance = fraction * Math.hypot(point.x - last.x, point.y - last.y);
  const duration = fraction * (point.elapsed - last.elapsed);
  gesture.inWindowTravel += distance;

  const { piece } = gesture;
  const { a, b, risk } = CUTS[piece.id % CUTS.length];
  const end = {
    x: last.local.x + fraction * (point.local.x - last.local.x),
    y: last.local.y + fraction * (point.local.y - last.local.y),
  };
  if (gesture.contactAt === null &&
      distanceToSegment(worldPoint(0, piece.y, risk), last.local, end) <= risk[2]) {
    gesture.contactAt = now;
  }
  if (gesture.contactAt !== null && gesture.inWindowTravel >= 4) {
    gesture.accidentAt = gesture.contactAt;
    return;
  }

  const cutStart = worldPoint(0, piece.y, a);
  const cutEnd = worldPoint(0, piece.y, b);
  const deviation = Math.max(
    distanceToSegment(last.local, cutStart, cutEnd),
    distanceToSegment(end, cutStart, cutEnd),
  );
  gesture.maxDeviation = Math.max(gesture.maxDeviation, deviation);
  if (distance > 1.6 * duration) {
    gesture.fastTravel += distance;
    gesture.fastDeviation = Math.max(gesture.fastDeviation, deviation);
  } else {
    gesture.fastTravel = 0;
    gesture.fastDeviation = 0;
  }
  const totalDuration = last.elapsed - gesture.samples[0].elapsed + duration;
  if ((gesture.fastTravel >= 24 && gesture.fastDeviation >= 27) ||
      (gesture.inWindowTravel >= 24 && gesture.inWindowTravel > 1.6 * totalDuration &&
        gesture.maxDeviation >= 27)) {
    gesture.accidentAt = now;
  }
}

function sample(state, x, y, now) {
  const shift = privateShift.get(state);
  const gesture = shift.gesture;
  const last = gesture.samples.at(-1);
  const elapsed = Math.max(last?.elapsed ?? 0, now - shift.start);
  if (last?.x === x && last.y === y && last.elapsed === elapsed) return;

  const amplitude = 3.5 * state.fatigue + (state.accidents > 0 ? 2.5 : 0);
  const blade = {
    x: x + amplitude * Math.sin(elapsed / 37),
    y: y + amplitude * Math.sin(elapsed / 53),
  };
  const pieceX = gesture.piece ? pieceOrigins.get(gesture.piece) + beltDistance(elapsed) : 0;
  const point = { x, y, elapsed, pieceX, local: { x: blade.x - pieceX, y: blade.y } };
  observeAccident(gesture, last, point, now);
  gesture.samples.push(point);
  state.stroke.points.push(blade);
}

export function beginStroke(state, x, y, now) {
  advance(state, now);
  if (state.finished || state.stroke || !inside(x, y) || !Number.isFinite(now)) return;

  const shift = privateShift.get(state);
  const distanceAtInput = beltDistance(Math.max(0, now - shift.start));
  let piece = null;
  let nearest = 50;
  for (const candidate of state.pieces) {
    const pieceX = pieceOrigins.get(candidate) + distanceAtInput;
    if (!playable(pieceX)) continue;
    const { a, b, risk } = CUTS[candidate.id % CUTS.length];
    const distance = Math.min(
      distanceToSegment({ x, y }, worldPoint(pieceX, candidate.y, a), worldPoint(pieceX, candidate.y, b)),
      Math.max(0, Math.hypot(x - pieceX - risk[0], y - candidate.y - risk[1]) - risk[2]),
    );
    if (distance < nearest) {
      piece = candidate;
      nearest = distance;
    }
  }

  shift.gesture = {
    piece, samples: [], inWindowTravel: 0, contactAt: null, accidentAt: null,
    maxDeviation: 0, fastTravel: 0, fastDeviation: 0,
  };
  state.stroke = { points: [] };
  sample(state, x, y, now);
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
  const shift = privateShift.get(state);
  const gesture = shift.gesture;
  state.stroke = null;
  shift.gesture = null;
  if (gesture?.accidentAt != null) recordEvent(state, 'accident', gesture.accidentAt);
}

function judgeStroke(state, { piece, samples, inWindowTravel: travel }) {
  const first = samples[0];
  const last = samples.at(-1);
  if (!piece || !state.pieces.includes(piece) || !playable(last.pieceX) || travel < 16) return null;

  const cut = CUTS[piece.id % CUTS.length];
  const a = worldPoint(0, piece.y, cut.a);
  const b = worldPoint(0, piece.y, cut.b);
  const duration = last.elapsed - first.elapsed;
  let bladeTravel = 0;
  let distanceSum = 0;

  for (let i = 1; i < samples.length; i++) {
    const from = samples[i - 1];
    const to = samples[i];
    const bladeDistance = Math.hypot(to.local.x - from.local.x, to.local.y - from.local.y);
    const startDeviation = distanceToSegment(from.local, a, b);
    const endDeviation = distanceToSegment(to.local, a, b);
    const midpoint = { x: (from.local.x + to.local.x) / 2, y: (from.local.y + to.local.y) / 2 };
    const middleDeviation = distanceToSegment(midpoint, a, b);
    bladeTravel += bladeDistance;
    distanceSum += bladeDistance * (startDeviation + 4 * middleDeviation + endDeviation) / 6;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const project = point => ((point.x - a.x) * dx + (point.y - a.y) * dy) / length;
  const start = project(first.local);
  const end = project(last.local);
  const displacement = Math.hypot(last.local.x - first.local.x, last.local.y - first.local.y);
  const tolerance = 15 - 3 * state.fatigue - (state.accidents > 0 ? 3 : 0);
  const valid = duration >= 45 && duration <= 1000
    && Math.min(start, end) <= length * 0.19 && Math.max(start, end) >= length * 0.81
    && Math.abs(end - start) >= displacement * 0.91
    && bladeTravel <= length * 1.55 && distanceSum <= tolerance * bladeTravel;
  return valid ? 'cut' : 'error';
}

export function endStroke(state, x, y, now) {
  const shift = privateShift.get(state);
  const gesture = shift.gesture;
  moveStroke(state, x, y, now);
  if (!shift.gesture) return gesture?.accidentAt != null ? 'accident' : null;
  cancelStroke(state);
  if (gesture.accidentAt !== null) return 'accident';
  const kind = judgeStroke(state, gesture);
  if (kind === null) return null;
  recordEvent(state, kind, now, gesture.piece);
  return kind;
}

function recordEvent(state, kind, at, piece) {
  state.fatigue = Math.min(1, state.fatigue + (kind === 'accident' ? 0.16 : 0.065));
  if (kind === 'cut') {
    state.processed++;
    state.pieces = state.pieces.filter(candidate => candidate !== piece);
  } else if (kind === 'error') {
    state.errors++;
  } else {
    state.accidents++;
  }
  state.event = { kind, at };
}

export function report(state) {
  const { processed, errors, accidents, fatigue } = state;
  const gross = BASE_PAY + processed * PIECE_PAY;
  const deductions = Math.min(gross, MAX_DEDUCTION, errors * ERROR_DEDUCTION + accidents * ACCIDENT_DEDUCTION);
  return { processed, errors, accidents, fatigue, target: TARGET, gross, deductions, net: gross - deductions };
}
