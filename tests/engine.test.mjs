import assert from 'node:assert/strict';
import test from 'node:test';
import * as engine from '../src/engine.mjs';

const {
  WIDTH, HEIGHT, SHIFT_MS, createShift, advance,
  beginStroke, moveStroke, endStroke, cancelStroke, report,
} = engine;

function traceCut(state, piece, now, reverse = false, offset = 0) {
  const [start, end] = reverse ? [piece.b, piece.a] : [piece.a, piece.b];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const startOffset = start.x - piece.x;
  const startY = start.y;
  beginStroke(state, start.x, startY + offset, now);
  for (let i = 1; i <= 4; i++) {
    const at = now + i * 65;
    advance(state, at);
    const x = piece.x + startOffset + dx * i / 4;
    const y = startY + offset + dy * i / 4;
    if (i === 4) return endStroke(state, x, y, at);
    moveStroke(state, x, y, at);
  }
}

function crossRisk(state, piece, now) {
  const { x, y, r } = piece.risk;
  beginStroke(state, x - r - 6, y, now);
  advance(state, now + 100);
  return endStroke(state, piece.risk.x + r + 6, y, now + 100);
}

test('exports the exact browser interface and a playable first piece', () => {
  assert.deepEqual(Object.keys(engine).sort(), [
    'HEIGHT', 'SHIFT_MS', 'WIDTH', 'advance', 'beginStroke', 'cancelStroke',
    'createShift', 'endStroke', 'moveStroke', 'playable', 'report',
  ]);
  assert.deepEqual([WIDTH, HEIGHT, SHIFT_MS], [1000, 520, 75000]);
  const state = createShift();
  assert.deepEqual(Object.keys(state).sort(), [
    'accidents', 'elapsed', 'errors', 'event', 'fatigue', 'finished',
    'pieces', 'processed', 'speed', 'stroke',
  ]);
  const [piece] = state.pieces;
  assert.deepEqual([64, 65, piece.x, 935, 936].map(engine.playable), [false, true, true, true, false]);
  assert.deepEqual(Object.keys(piece).sort(), ['a', 'b', 'id', 'risk', 'type', 'x', 'y']);
  assert.equal(piece.y, 265);
  for (const point of [piece.a, piece.b, piece.risk]) {
    assert.ok(point.x > 0 && point.x < WIDTH && point.y > 0 && point.y < HEIGHT);
  }
});

test('injected clock completes an idle shift and cancels a stroke at the deadline', () => {
  const start = 1234;
  const state = createShift(start);
  advance(state, start + SHIFT_MS - 1);
  assert.equal(state.finished, false);
  beginStroke(state, 400, 265, start + SHIFT_MS - 1);
  assert.ok(state.stroke);
  assert.equal(endStroke(state, 500, 265, start + SHIFT_MS), null);
  advance(state, start + SHIFT_MS * 2);
  beginStroke(state, 500, 265, start + SHIFT_MS * 2);
  assert.equal(state.elapsed, SHIFT_MS);
  assert.equal(state.finished, true);
  assert.equal(state.stroke, null);
  assert.equal(report(state).processed, 0);
});

test('advancing is independent of frame rate and ignores repeated or backward ticks', () => {
  const stepped = createShift(100);
  const jumped = createShift(100);
  const initialOffsets = [stepped.pieces[0].a, stepped.pieces[0].b, stepped.pieces[0].risk]
    .map(point => point.x - stepped.pieces[0].x);
  advance(stepped, 600);
  const [piece] = stepped.pieces;
  assert.deepEqual([piece.a, piece.b, piece.risk].map(point => point.x - piece.x), initialOffsets);
  for (let now = 1100; now <= 60100; now += 1000) advance(stepped, now);
  advance(jumped, 60100);
  assert.deepEqual(stepped, jumped);
  advance(jumped, 60100);
  advance(jumped, 59000);
  advance(jumped, Infinity);
  assert.deepEqual(stepped, jumped);
  assert.ok(jumped.speed > 200);
});

test('spawn intervals shrink and the three shapes have distinct cut lines', () => {
  const state = createShift();
  const spawns = [];
  const shapes = new Map();
  let lastId = -1;
  for (let now = 0; now < SHIFT_MS; now += 25) {
    advance(state, now);
    const piece = state.pieces.at(-1);
    if (piece.id === lastId) continue;
    lastId = piece.id;
    spawns.push(now);
    shapes.set(piece.type, [piece.b.x - piece.a.x, piece.b.y - piece.a.y]);
  }
  assert.deepEqual([...shapes.keys()], ['peito', 'asa', 'coxa']);
  assert.equal(new Set([...shapes.values()].map(String)).size, 3);
  assert.ok(spawns.at(-1) - spawns.at(-2) < (spawns[2] - spawns[1]) * 0.6);
});

test('cuts a moving piece in either direction and emits one event per gesture', () => {
  for (const reverse of [false, true]) {
    const state = createShift();
    const [piece] = state.pieces;
    assert.equal(traceCut(state, piece, 0, reverse), 'cut');
    assert.equal(state.processed, 1);
    assert.deepEqual(state.event, { kind: 'cut', at: 260 });
    assert.equal(state.pieces.length, 0);
    assert.equal(state.stroke, null);
    assert.equal(endStroke(state, 400, 265, 300), null);
    assert.equal(state.processed, 1);
  }
});

test('delayed input uses sample timestamps even after the render clock advances', () => {
  const state = createShift();
  const samples = createShift();
  const [piece] = samples.pieces;
  advance(state, 900);
  beginStroke(state, piece.a.x, piece.a.y, 0);
  advance(samples, 260);
  assert.equal(endStroke(state, piece.b.x, piece.b.y, 260), 'cut');
  assert.equal(state.elapsed, 900);
});

test('clicks, short, outside, and cancelled gestures are safe', () => {
  const state = createShift();
  const [piece] = state.pieces;
  beginStroke(state, piece.a.x, piece.a.y, 0);
  assert.equal(endStroke(state, piece.a.x, piece.a.y, 120), null);
  beginStroke(state, piece.a.x, piece.a.y, 120);
  assert.equal(endStroke(state, piece.a.x + 10, piece.a.y, 150), null);
  beginStroke(state, -1, 265, 160);
  assert.equal(state.stroke, null);
  beginStroke(state, 0, 0, 160);
  assert.equal(endStroke(state, piece.b.x, piece.b.y, 300), null);
  beginStroke(state, piece.a.x, piece.a.y, 300);
  assert.equal(endStroke(state, WIDTH + 1, piece.a.y, 400), null);
  assert.equal(state.stroke, null);
  beginStroke(state, piece.a.x, piece.a.y, 400);
  moveStroke(state, piece.a.x + 20, piece.a.y, 480);
  cancelStroke(state);
  assert.equal(endStroke(state, piece.risk.x, piece.risk.y, 500), null);
  assert.deepEqual([state.processed, state.errors, state.accidents, state.fatigue], [0, 0, 0, 0]);
  assert.equal(traceCut(state, piece, 500), 'cut');
});

test('angle, extent, duration and mean deviation reject imprecise traces', () => {
  for (const [dx, dy, duration] of [[105, -18, 260], [45, 12, 260], [105, 30, 40], [105, 30, 1100]]) {
    const state = createShift();
    const [piece] = state.pieces;
    const localX = piece.a.x - piece.x;
    const y = piece.a.y;
    beginStroke(state, piece.a.x, y, 0);
    advance(state, duration);
    assert.equal(endStroke(state, piece.x + localX + dx, y + dy, duration), 'error');
    assert.deepEqual([state.processed, state.errors, state.accidents], [0, 1, 0]);
    assert.ok(state.fatigue > 0);
  }
  const state = createShift();
  assert.equal(traceCut(state, state.pieces[0], 0, false, -23), 'error');
});

test('sparse sweeps hit moving hand and bone zones between samples', () => {
  for (const now of [0, 4400]) {
    const state = createShift();
    advance(state, now);
    const piece = state.pieces.at(-1);
    assert.equal(piece.risk.kind, now === 0 ? 'mao' : 'osso');
    assert.equal(crossRisk(state, piece, now), 'accident');
    assert.equal(state.stroke, null);
    assert.deepEqual(state.event, { kind: 'accident', at: now + 100 });
    assert.equal(endStroke(state, piece.risk.x, piece.risk.y, now + 110), null);
    assert.deepEqual([state.processed, state.errors, state.accidents], [0, 0, 1]);
    assert.equal(traceCut(state, piece, now + 110), 'cut');
  }
});

test('an observed in-window collision survives piece expiry or cancellation', () => {
  for (const finish of ['release', 'cancel', 'outside']) {
    const state = createShift();
    advance(state, 5450);
    const [piece] = state.pieces;
    beginStroke(state, piece.risk.x - 25, piece.risk.y, 5450);
    advance(state, 5500);
    const x = piece.risk.x + 25;
    const y = piece.risk.y;
    moveStroke(state, x, y, 5500);
    if (finish === 'release') assert.equal(endStroke(state, x, y, 5600), 'accident');
    if (finish === 'cancel') cancelStroke(state);
    if (finish === 'outside') assert.equal(endStroke(state, WIDTH + 1, y, 5600), 'accident');
    assert.deepEqual(state.event, { kind: 'accident', at: 5500 });
    assert.equal(state.stroke, null);
    assert.equal(endStroke(state, x, y, 5700), null);
    assert.deepEqual([state.processed, state.errors, state.accidents], [0, 0, 1]);
  }
});

test('a clean cut that ends beyond the window scores zero', () => {
  const state = createShift();
  advance(state, 5340);
  assert.equal(traceCut(state, state.pieces[0], 5340), null);
  assert.deepEqual([state.processed, state.errors, state.accidents], [0, 0, 0]);
});

test('a risk crossing after the piece leaves the window scores zero', () => {
  const state = createShift();
  advance(state, 5500);
  const [piece] = state.pieces;
  beginStroke(state, piece.risk.x - 45, piece.risk.y, 5500);
  advance(state, 5600);
  assert.equal(endStroke(state, piece.risk.x + 25, piece.risk.y, 5600), null);
  assert.deepEqual([state.processed, state.errors, state.accidents], [0, 0, 0]);
});

test('movement after expiry cannot qualify stationary contact as an accident', () => {
  const state = createShift();
  advance(state, 5500);
  const [piece] = state.pieces;
  const x = piece.risk.x + 16;
  const y = piece.risk.y;
  beginStroke(state, x, y, 5500);
  moveStroke(state, x, y, 5550);
  assert.ok(piece.x > 935);
  assert.equal(endStroke(state, x + 5, y, 5600), null);
  assert.equal(state.accidents, 0);
  assert.equal(state.event, null);
  assert.equal(report(state).deductions, 0);
});

test('speed with a large deviation causes an accident outside the risk zone', () => {
  for (const samples of [1, 5]) {
    const state = createShift();
    const { x, y } = state.pieces[0].a;
    beginStroke(state, x, y, 0);
    for (let i = 1; i < samples; i++) {
      moveStroke(state, x, y - 45 * i / samples, 15 * i / samples);
    }
    assert.equal(endStroke(state, x, y - 45, 15), 'accident');
    assert.deepEqual([state.errors, state.accidents], [0, 1]);
  }
});

test('a fast sweep after a hold is sampling-independent and a slow sweep is an error', () => {
  for (const [duration, expected] of [[15, 'accident'], [100, 'error']]) {
    for (const count of [1, 10]) {
      const state = createShift();
      beginStroke(state, 248, 249, 0);
      moveStroke(state, 248, 249, 200);
      for (let i = 1; i < count; i++) {
        moveStroke(state, 248, 249 - 45 * i / count, 200 + duration * i / count);
      }
      assert.equal(endStroke(state, 248, 204, 200 + duration), expected);
      assert.equal(state.accidents, Number(expected === 'accident'));
      assert.equal(state.errors, Number(expected === 'error'));
    }
  }
});

test('an observed fast deviation survives release, cancellation, or canvas exit', () => {
  for (const finish of ['release', 'cancel', 'outside move', 'outside release']) {
    const state = createShift();
    beginStroke(state, 248, 249, 0);
    moveStroke(state, 248, 204, 15);
    if (finish === 'release') assert.equal(endStroke(state, 248, 204, 15), 'accident');
    if (finish === 'cancel') cancelStroke(state);
    if (finish === 'outside move') moveStroke(state, -1, 204, 16);
    if (finish === 'outside release') assert.equal(endStroke(state, -1, 204, 16), 'accident');
    assert.deepEqual(state.event, { kind: 'accident', at: 15 });
    assert.equal(state.stroke, null);
    assert.equal(endStroke(state, 248, 204, 30), null);
    assert.deepEqual([state.processed, state.errors, state.accidents], [0, 0, 1]);
  }
});

test('an in-window fast deviation survives expiry, with later movement excluded', () => {
  for (const releaseAt of [5515, 5600]) {
    const state = createShift();
    advance(state, 5500);
    const { x, y } = state.pieces[0].a;
    beginStroke(state, x, y, 5500);
    moveStroke(state, x, y - 45, 5515);
    assert.equal(endStroke(state, x, y - 45, releaseAt), 'accident');
    assert.deepEqual(state.event, { kind: 'accident', at: 5515 });
    assert.equal(state.accidents, 1);
  }

  const state = createShift();
  advance(state, 5525);
  const { x, y } = state.pieces[0].a;
  beginStroke(state, x, y, 5525);
  moveStroke(state, x, y - 45, 5540);
  assert.equal(endStroke(state, x, y - 90, 5555), null);
  assert.equal(state.accidents, 0);
  assert.equal(report(state).deductions, 0);
});

test('fatigue persists and caps, tremor stays bounded, and late cuts remain possible', () => {
  const state = createShift();
  const [piece] = state.pieces;
  for (let i = 0; i < 20; i++) {
    const now = i * 100;
    beginStroke(state, piece.a.x, piece.a.y - 23, now);
    assert.equal(endStroke(state, piece.a.x + 25, piece.a.y - 23, now + 90), 'error');
    advance(state, now + 100);
  }
  assert.equal(state.fatigue, 1);
  advance(state, 71000);
  assert.equal(state.fatigue, 1);
  const late = state.pieces.find(candidate => candidate.x > 250 && candidate.x < 720);
  beginStroke(state, late.a.x, late.a.y, 71000);
  const [blade] = state.stroke.points;
  assert.ok(Math.hypot(blade.x - late.a.x, blade.y - late.a.y) > 0);
  assert.ok(Math.abs(blade.x - late.a.x) <= 3.5 && Math.abs(blade.y - late.a.y) <= 3.5);
  cancelStroke(state);
  assert.equal(traceCut(state, late, 71000), 'cut');
});

test('accident precision loss persists independently of fatigue and resets on a new shift', () => {
  const injured = createShift();
  assert.equal(crossRisk(injured, injured.pieces[0], 0), 'accident');
  const control = createShift();
  advance(control, 100);
  control.fatigue = injured.fatigue;
  for (const state of [injured, control]) advance(state, 2350);
  for (const state of [injured, control]) {
    const [piece] = state.pieces;
    beginStroke(state, piece.a.x, piece.a.y, 2350);
  }
  assert.ok(Math.abs(injured.stroke.points[0].x - control.stroke.points[0].x) > 1);
  cancelStroke(injured);
  assert.equal(traceCut(injured, injured.pieces[0], 2350), 'cut');
  assert.deepEqual(createShift(3000), createShift());
});

test('report matches a known gesture sequence and caps deductions in integer centavos', () => {
  const state = createShift();
  const [piece] = state.pieces;
  assert.equal(traceCut(state, piece, 0, false, -25), 'error');
  assert.equal(crossRisk(state, piece, 260), 'accident');
  assert.equal(traceCut(state, piece, 360), 'cut');
  const { fatigue, ...totals } = report(state);
  assert.ok(Math.abs(fatigue - 0.29) < 1e-12);
  assert.deepEqual(totals, {
    processed: 1, errors: 1, accidents: 1,
    target: 32, gross: 6445, deductions: 1320, net: 5125,
  });
  const capped = createShift();
  for (let i = 0; i < 5; i++) {
    assert.equal(crossRisk(capped, capped.pieces[0], i * 100), 'accident');
  }
  const { gross, deductions, net } = report(capped);
  assert.deepEqual([gross, deductions, net], [6400, 4500, 1900]);
  assert.ok([gross, deductions, net].every(Number.isInteger));
});
