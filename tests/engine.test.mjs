import assert from 'node:assert/strict';
import test from 'node:test';
import * as engine from '../src/engine.mjs';

const {
  WIDTH, SHIFT_MS, HOUR_MS, TARGET, TUNING, RETURN_X, createShift, advance,
  beginStroke, moveStroke, endStroke, cancelStroke, report, reflect,
  grabPiece, releasePiece, togglePiece, takeBreak, breakStatus, benchStep, benchRisks,
  grabbable, tolerance, CUTS,
} = engine;

const hand = state => benchRisks(state.bench).find(risk => risk.kind === 'mao');

// Põe na bancada uma peça do tipo pedido, trocando o tipo da primeira peça da esteira.
function benchOf(type) {
  const state = createShift();
  Object.assign(state.pieces[0], { type, steps: CUTS[type].steps.length });
  grabPiece(state, 0);
  return state;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

// Traça a etapa atual da bancada; `offset` desloca o traço na perpendicular da linha.
function traceStep(state, now, { reverse = false, offset = 0, duration = 260, samples = 4 } = {}) {
  const line = benchStep(state.bench);
  const [start, end] = reverse ? [line.b, line.a] : [line.a, line.b];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const nx = -(end.y - start.y) / length * offset;
  const ny = (end.x - start.x) / length * offset;
  if (beginStroke(state, start.x + nx, start.y + ny, now) !== 'stroke') return null;
  for (let i = 1; i <= samples; i++) {
    const x = start.x + nx + (end.x - start.x) * i / samples;
    const y = start.y + ny + (end.y - start.y) * i / samples;
    const at = now + duration * i / samples;
    if (i === samples) return endStroke(state, x, y, at);
    moveStroke(state, x, y, at);
    if (!state.stroke) return null;
  }
}

function processBench(state, now) {
  let at = now;
  while (state.bench.step < state.bench.steps) {
    assert.match(traceStep(state, at), /^(clean|cut)$/);
    at += 300;
  }
  return at;
}

const kinds = state => state.events.map(event => event.kind);

test('exports the browser interface and a grabbable first piece', () => {
  for (const name of ['createShift', 'advance', 'beginStroke', 'moveStroke', 'endStroke', 'cancelStroke',
    'grabPiece', 'releasePiece', 'togglePiece', 'takeBreak', 'report', 'reflect', 'playable']) {
    assert.equal(typeof engine[name], 'function', name);
  }
  assert.equal(SHIFT_MS, 90000);
  const state = createShift();
  assert.equal(state.pieces.length, 1);
  assert.equal(grabbable(state), state.pieces[0]);
  assert.equal(state.bench, null);
  assert.deepEqual([64, 65, 935, 936].map(engine.playable), [false, true, true, false]);
});

test('an idle shift finishes and counts pieces that ran off the belt as lost', () => {
  const state = createShift(1000);
  advance(state, 1000 + SHIFT_MS - 1);
  assert.equal(state.finished, false);
  advance(state, 1000 + SHIFT_MS * 2);
  assert.equal(state.elapsed, SHIFT_MS);
  assert.equal(state.finished, true);
  assert.ok(state.lost > 15);
  assert.equal(kinds(state).filter(kind => kind === 'lost').length, state.lost);
  assert.equal(kinds(state).filter(kind => kind === 'hour').length, 7);
  assert.equal(report(state).processed, 0);
  assert.equal(grabPiece(state, 1000 + SHIFT_MS * 3), null);
});

test('advancing is independent of frame rate', () => {
  const stepped = createShift(100);
  const jumped = createShift(100);
  for (let now = 117; now <= 60100; now += 16.7) advance(stepped, now);
  advance(stepped, 60100);
  advance(jumped, 60100);
  assert.ok(Math.abs(stepped.fatigue - jumped.fatigue) < 1e-9);
  stepped.fatigue = jumped.fatigue;
  stepped.maxFatigue = jumped.maxFatigue;
  assert.deepEqual(stepped, jumped);
  advance(jumped, 59000);
  advance(jumped, Infinity);
  assert.equal(jumped.elapsed, 60000);
});

test('belt speed rises in hourly steps and spawns get closer', () => {
  const state = createShift();
  const speeds = [];
  const spawns = [];
  const types = new Map();
  let lastId = 0;
  for (let now = 0; now < SHIFT_MS; now += 25) {
    advance(state, now);
    speeds.push(state.speed);
    for (const piece of state.pieces) types.set(piece.type, piece.steps);
    const newest = state.pieces.reduce((max, piece) => Math.max(max, piece.id), 0);
    if (newest !== lastId) spawns.push(now);
    lastId = newest;
  }
  assert.equal(new Set(speeds).size, 8);
  assert.ok(speeds.every((speed, i) => i === 0 || speed >= speeds[i - 1]));
  assert.ok(spawns.at(-1) - spawns.at(-2) < (spawns[1] - spawns[0]) * 0.6);
  assert.deepEqual([...types.keys()].sort(), ['asa', 'coxa', 'peito']);
  assert.deepEqual([types.get('peito'), types.get('asa'), types.get('coxa')], [3, 2, 3]);
});

test('E grabs the rightmost reachable piece and the bench holds one piece', () => {
  const state = createShift();
  advance(state, 8000);
  const reachable = state.pieces.filter(piece => engine.playable(piece.x));
  assert.ok(reachable.length >= 2);
  const rightmost = reachable.reduce((a, b) => (a.x > b.x ? a : b));
  assert.equal(grabPiece(state, 8000), 'grab');
  assert.equal(state.bench, rightmost);
  assert.ok(!state.pieces.includes(rightmost));
  assert.equal(grabPiece(state, 8010), null);
  assert.equal(state.bench, rightmost);

  const empty = createShift();
  advance(empty, 3000);
  empty.pieces = [];
  assert.equal(grabPiece(empty, 3000), 'empty');
  assert.equal(empty.events.at(-1).kind, 'empty');
});

test('each valid stroke advances one step and a complete return counts as processed', () => {
  const state = createShift();
  assert.equal(togglePiece(state, 0), 'grab');
  const piece = state.bench;
  assert.equal(piece.type, 'peito');
  assert.equal(piece.steps, 3);
  const at = processBench(state, 100);
  assert.equal(piece.step, 3);
  assert.equal(state.events.at(-1).complete, true);
  assert.equal(beginStroke(state, 400, 400, at), 'complete');
  assert.equal(togglePiece(state, at + 50), 'done');
  assert.equal(state.processed, 1);
  assert.equal(state.bench, null);
  assert.ok(piece.returned);
  assert.equal(piece.x, RETURN_X);
  assert.notEqual(grabbable(state), piece);
  advance(state, at + 20000);
  assert.ok(!state.pieces.includes(piece));
  assert.ok(!state.events.some(event => event.kind === 'lost' && event.id === piece.id),
    'a returned piece leaving the belt is not lost');
});

test('cuts work in either direction', () => {
  for (const reverse of [false, true]) {
    const state = createShift();
    grabPiece(state, 0);
    assert.match(traceStep(state, 100, { reverse }), /^(clean|cut)$/);
    assert.equal(state.bench.step, 1);
  }
});

test('returning an unfinished piece counts as badly processed', () => {
  const state = createShift();
  grabPiece(state, 0);
  traceStep(state, 100);
  assert.equal(releasePiece(state, 500), 'bad');
  assert.deepEqual([state.processed, state.badReturns], [0, 1]);
  assert.equal(releasePiece(state, 600), null);
});

test('the cut accepts a generous margin but rejects sloppy strokes', () => {
  const near = createShift();
  grabPiece(near, 0);
  assert.equal(traceStep(near, 100, { offset: 25 }), 'cut');

  const clean = createShift();
  grabPiece(clean, 0);
  assert.equal(traceStep(clean, 100, { offset: 6 }), 'clean');

  for (const options of [{ offset: -60 }, { duration: 2200 }]) {
    const state = createShift();
    grabPiece(state, 0);
    assert.equal(traceStep(state, 100, options), 'error');
    assert.deepEqual([state.bench.step, state.errors], [0, 1]);
  }

  // Traço curto demais (só metade da linha).
  const short = createShift();
  grabPiece(short, 0);
  const { a, b } = benchStep(short.bench);
  beginStroke(short, a.x, a.y, 100);
  assert.equal(endStroke(short, (a.x + b.x) / 2, (a.y + b.y) / 2, 300), 'error');

  // Clique sem movimento é ignorado.
  beginStroke(short, a.x, a.y, 400);
  assert.equal(endStroke(short, a.x + 5, a.y, 450), null);
  assert.equal(short.errors, 1);
});

test('fatigue and accidents shrink the tolerance by at most 30%', () => {
  const state = createShift();
  assert.equal(tolerance(state), TUNING.tolerance);
  state.fatigue = 1;
  state.accidents = 1;
  assert.ok(Math.abs(tolerance(state) - TUNING.tolerance * 0.7) < 1e-9);
});

test('touching the hand or bone causes an accident and a short injury', () => {
  const state = createShift();
  grabPiece(state, 0);
  const risk = hand(state);
  assert.equal(beginStroke(state, risk.x - risk.r - 15, risk.y, 100), 'stroke');
  moveStroke(state, risk.x + risk.r + 15, risk.y, 400);
  assert.equal(state.stroke, null);
  assert.equal(state.accidents, 1);
  assert.equal(state.events.at(-1).kind, 'accident');
  assert.equal(state.events.at(-1).risk, 'mao');
  assert.equal(state.bench.step, 0);
  assert.equal(beginStroke(state, 400, 400, 500), 'injured');
  assert.match(traceStep(state, 100 + TUNING.injuryMs + 400), /^(clean|cut)$/);
});

test('a fast stroke away from the risk zones is not an accident', () => {
  const state = createShift();
  grabPiece(state, 0);
  assert.match(traceStep(state, 100, { duration: 40, samples: 2 }), /^(clean|cut)$/);
  assert.equal(state.accidents, 0);
});

test('a hasty stroke that grazes the risk zone is an accident', () => {
  const state = createShift();
  grabPiece(state, 0);
  const risk = hand(state);
  const y = risk.y - risk.r - 6;
  beginStroke(state, risk.x - 80, y, 100);
  moveStroke(state, risk.x + 80, y, 120);
  assert.equal(state.accidents, 1);

  const slow = createShift();
  grabPiece(slow, 0);
  beginStroke(slow, risk.x - 80, y, 100);
  moveStroke(slow, risk.x + 80, y, 600);
  assert.equal(slow.accidents, 0);
});

test('asa and coxa also have a bone that causes accidents', () => {
  for (const type of ['asa', 'coxa']) {
    const state = benchOf(type);
    const bone = benchRisks(state.bench).find(risk => risk.kind === 'osso');
    beginStroke(state, bone.x - bone.r - 15, bone.y, 100);
    moveStroke(state, bone.x + bone.r + 15, bone.y, 400);
    assert.equal(state.accidents, 1, type);
    assert.deepEqual(state.events.at(-1), {
      kind: 'accident', at: 400, seq: state.events.length - 1, risk: 'osso', x: bone.x, y: bone.y,
    });
  }
});

test('every piece keeps a support hand that moves after each cut', () => {
  for (const type of ['peito', 'asa', 'coxa']) {
    const state = benchOf(type);
    const positions = [];
    while (state.bench.step < state.bench.steps) {
      const risks = benchRisks(state.bench);
      assert.equal(risks.filter(risk => risk.kind === 'mao').length, 1, type);
      assert.equal(risks.some(risk => risk.kind === 'osso'), type !== 'peito', type);
      positions.push(hand(state));
      assert.match(traceStep(state, positions.length * 300), /^(clean|cut)$/, `${type}, etapa ${positions.length}`);
    }
    assert.equal(positions.length, CUTS[type].steps.length);
    for (let i = 1; i < positions.length; i++) {
      const moved = Math.hypot(positions[i].x - positions[i - 1].x, positions[i].y - positions[i - 1].y);
      assert.ok(moved > 20, `${type}: a mão muda de lugar na etapa ${i + 1}`);
    }
  }
});

test('a stroke along each cut line stays clear of the hand and the bone', () => {
  for (const [type, cut] of Object.entries(CUTS)) {
    assert.equal(cut.hands.length, cut.steps.length, type);
    cut.steps.forEach((_, step) => {
      const piece = { type, step };
      const { a, b } = benchStep(piece);
      for (const risk of benchRisks(piece)) {
        // A mão fica fora da faixa aceita; o osso, fora da margem de pressa.
        const minimum = risk.kind === 'mao' ? TUNING.tolerance : TUNING.hastyMargin;
        const gap = distanceToSegment(risk, a, b) - risk.r;
        assert.ok(gap > minimum, `${type}, etapa ${step + 1}: ${risk.kind} a ${gap.toFixed(1)} da linha`);
      }
    });
  }
});

test('strokes need a piece on the bench', () => {
  const state = createShift();
  assert.equal(beginStroke(state, 500, 400, 0), 'no-piece');
  assert.equal(state.stroke, null);
  assert.deepEqual(state.events.at(-1), { kind: 'blocked', at: 0, seq: 0, reason: 'no-piece' });
  assert.equal(beginStroke(state, -5, 400, 0), null);
});

test('a NR-36 break recovers fatigue, blocks work and has a cooldown', () => {
  const state = createShift();
  advance(state, 30000);
  assert.ok(state.fatigue > 0.1);
  state.fatigue = 0.6;
  const tired = state.fatigue;
  assert.equal(takeBreak(state, 30000), 'break');
  assert.equal(grabPiece(state, 30100), 'blocked');
  assert.equal(beginStroke(state, 500, 400, 30200), 'break');
  advance(state, 30000 + TUNING.breakMs);
  assert.ok(state.fatigue < tired - 0.2);
  assert.equal(state.breakUntil, null);
  assert.ok(kinds(state).includes('break-end'));
  assert.equal(breakStatus(state).reason, 'cooldown');
  assert.equal(takeBreak(state, 30000 + TUNING.breakMs + 10), 'blocked');
  advance(state, 30000 + TUNING.breakMs + TUNING.breakCooldown);
  assert.equal(breakStatus(state).ready, true);
  assert.equal(state.breaks, 1);

  const busy = createShift();
  grabPiece(busy, 0);
  assert.equal(takeBreak(busy, 100), 'blocked');
  assert.equal(busy.events.at(-1).reason, 'busy');
});

test('hour events report the expected production', () => {
  const state = createShift();
  advance(state, HOUR_MS * 2 + 1);
  const hours = state.events.filter(event => event.kind === 'hour');
  assert.deepEqual(hours.map(event => [event.hour, event.at]), [[1, HOUR_MS], [2, HOUR_MS * 2]]);
  assert.equal(hours[1].expected, Math.round(TARGET * 2 / 8));
  assert.equal(state.hour, 2);
});

test('streaks of clean cuts pay a bonus and the report caps deductions', () => {
  const state = createShift();
  grabPiece(state, 0);
  processBench(state, 100);
  releasePiece(state, 1500);
  assert.equal(state.cleanCuts, 3);
  assert.equal(state.bestStreak, 3);
  assert.ok(state.bonus > 0);

  state.accidents = 2;
  state.lost = 3;
  state.badReturns = 1;
  const result = report(state);
  assert.equal(result.gross, 6400 + 60 + state.bonus);
  assert.equal(result.deductions, 2 * 1250 + 3 * 40 + 80);
  assert.equal(result.net, result.gross - result.deductions);
  assert.equal(result.target, TARGET);

  state.accidents = 10;
  assert.equal(report(state).deductions, 4500);
});

test('the reflection reflects the trade-off between output and health', () => {
  const base = { processed: 20, target: 18, accidents: 0, breaks: 0, maxFatigue: 0.3, lost: 0 };
  assert.match(reflect(base), /sem acidentes/);
  assert.match(reflect({ ...base, accidents: 2 }), /bateu a meta, mas sofreu 2 acidentes/);
  assert.match(reflect({ ...base, processed: 5, lost: 4 }), /4 peças passaram/);
  assert.match(reflect({ ...base, maxFatigue: 0.8 }), /NR-36/);
  assert.match(reflect({ ...base, breaks: 2 }), /2 pausas/);
});

test('a piece left on the bench at the end of the shift is lost and strokes are cancelled', () => {
  const state = createShift();
  advance(state, SHIFT_MS - 2000);
  state.pieces.push({ id: 999, type: 'asa', x: 500, y: 265, step: 0, steps: 2, returned: false, origin: 500 - 1e9 });
  state.bench = state.pieces.pop();
  beginStroke(state, 400, 400, SHIFT_MS - 1000);
  assert.ok(state.stroke);
  advance(state, SHIFT_MS);
  assert.equal(state.stroke, null);
  assert.equal(state.bench, null);
  assert.ok(state.events.some(event => event.kind === 'lost' && event.id === 999));
  cancelStroke(state);
});

test('pieces that leave without being grabbed are lost exactly once', () => {
  const state = createShift();
  for (let now = 0; now < 15000; now += 500) advance(state, now);
  const lostEvents = state.events.filter(event => event.kind === 'lost');
  assert.equal(lostEvents.length, state.lost);
  assert.ok(state.lost >= 1);
  assert.equal(new Set(lostEvents.map(event => event.id)).size, lostEvents.length);
  assert.ok(lostEvents.every(event => event.at <= state.elapsed));
  assert.ok(state.pieces.every(piece => piece.x <= WIDTH + 75));
});
