import assert from 'node:assert/strict';
import test from 'node:test';
import * as engine from '../src/engine.mjs';

const {
  WIDTH, SHIFT_MS, HOUR_MS, TARGET, TUNING, RETURN_X, createShift, advance,
  cutPiece, report, reflect, grabPiece, releasePiece, togglePiece, takeBreak,
  breakStatus, grabbable,
} = engine;

const kinds = state => state.events.map(event => event.kind);

test('exports the browser interface and a grabbable first piece', () => {
  for (const name of ['createShift', 'advance', 'cutPiece',
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

test('belt speed and spacing stay steady across shift hours', () => {
  const state = createShift();
  const speed = state.speed;
  const first = state.pieces[0];
  advance(state, 1000);
  assert.equal(first.x, 320 + speed);
  const spawns = [];
  let lastId = 0;
  for (let now = 1000; now < SHIFT_MS; now += 25) {
    advance(state, now);
    assert.equal(state.speed, speed);
    const newest = Math.max(...state.pieces.map(piece => piece.id));
    if (newest > lastId) spawns.push(now);
    lastId = Math.max(lastId, newest);
  }
  assert.ok(spawns.length >= TARGET);
  assert.equal(new Set(spawns.slice(1).map((at, i) => at - spawns[i])).size, 1);
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

test('one cut attempt per piece scores perfect, good, or too early', () => {
  for (const [at, outcome, points, returned] of [
    [1350, 'perfect', 100, 'done'],
    [1150, 'good', 60, 'done'],
    [1599, 'good', 60, 'done'],
    [100, 'error', 0, 'bad'],
  ]) {
    const state = createShift();
    assert.equal(togglePiece(state, 0), 'grab');
    const piece = state.bench;
    assert.equal(cutPiece(state, at), outcome);
    assert.equal(cutPiece(state, at + 1), 'resolved');
    assert.equal(report(state).points, points);
    assert.equal(togglePiece(state, at + 2), returned);
    assert.equal(state.bench, null);
    assert.equal(piece.x, RETURN_X);
    assert.notEqual(grabbable(state), piece);
    assert.equal(state.processed, Number(returned === 'done'));
    assert.equal(state.errors, Number(outcome === 'error'));
    advance(state, 20000);
    assert.ok(!state.events.some(event => event.kind === 'lost' && event.id === piece.id));
  }
});

test('a queued cut keeps its original quality after a newer frame', () => {
  const state = createShift(100);
  grabPiece(state, 100);
  advance(state, 1600);
  assert.equal(cutPiece(state, 1450), 'perfect');
  assert.equal(state.elapsed, 1500);
  assert.equal(cutPiece(state, 1451), 'resolved');
  assert.equal(report(state).points, 100);
});

test('pre-deadline input corrects a timeout across frame schedules without rewinding the belt', () => {
  for (const frames of [[1699], [1600, 1700], [1600, 23000]]) {
    const late = createShift();
    const prompt = createShift();
    for (const state of [late, prompt]) grabPiece(state, 0);
    assert.equal(cutPiece(prompt, 1350), 'perfect');
    advance(prompt, frames.at(-1));
    for (const at of frames) advance(late, at);
    assert.equal(report(late).accidents, 1);
    const positions = late.pieces.map(piece => piece.x);

    assert.equal(cutPiece(late, 1350), 'perfect');
    assert.equal(late.elapsed, frames.at(-1));
    assert.deepEqual(late.pieces.map(piece => piece.x), positions);
    assert.deepEqual(late.pieces, prompt.pieces);
    assert.deepEqual(late.events.filter(event => event.kind !== 'perfect').map(event => event.kind),
      prompt.events.filter(event => event.kind !== 'perfect').map(event => event.kind));
    assert.equal(late.injuredUntil, 0);
    assert.equal(late.streak, prompt.streak);
    assert.ok(Math.abs(late.fatigue - prompt.fatigue) < 1e-9);
    assert.ok(Math.abs(late.maxFatigue - prompt.maxFatigue) < 1e-9);
    assert.ok(late.events.every((event, i) => event.seq === i && (i === 0 || event.at >= late.events[i - 1].at)));
    assert.equal(cutPiece(late, 1350), 'resolved');
    assert.equal(report(late).points, 100);
    assert.equal(report(late).deductions, report(prompt).deductions);
  }
});

test('a cut generated before the current piece was grabbed cannot cut it', () => {
  const state = createShift();
  grabPiece(state, 0);
  releasePiece(state, 100);
  grabPiece(state, 6500);
  assert.equal(cutPiece(state, 300), null);
  assert.equal(state.bench.cut, null);
});

test('returning before a cut counts as badly processed and cancels the timer', () => {
  const state = createShift();
  assert.equal(cutPiece(state, 0), 'no-piece');
  grabPiece(state, 0);
  assert.equal(releasePiece(state, 500), 'bad');
  assert.equal(releasePiece(state, 600), null);
  advance(state, 2000);
  assert.deepEqual([state.processed, state.badReturns, state.accidents], [0, 1, 0]);
});

test('timeout at the exact deadline injures once and leaves a penalty after dressing and rest', () => {
  const state = createShift(100);
  const stepped = createShift(100);
  for (const shift of [state, stepped]) grabPiece(shift, 11100);
  const deadline = state.bench.timing.deadline;
  for (let now = 11116; now < 27000; now += 16) advance(stepped, now);
  advance(stepped, 27000);
  advance(state, 27000);
  assert.deepEqual(stepped.events, state.events);
  const relevant = state.events.filter(event => event.at >= 11000);
  assert.deepEqual(relevant.slice(0, 5).map(event => event.kind), ['grab', 'hour', 'accident', 'hour', 'lost']);
  assert.equal(relevant[2].at, deadline);
  assert.equal(state.injuredUntil, deadline + TUNING.injuryMs);
  assert.equal(stepped.injuredUntil, state.injuredUntil);
  assert.ok(state.events.every((event, i) => i === 0 || event.at >= state.events[i - 1].at));
  assert.ok(Math.abs(stepped.fatigue - state.fatigue) < 1e-9);

  const exact = createShift();
  grabPiece(exact, 0);
  assert.equal(cutPiece(exact, 1600), 'accident');
  assert.equal(cutPiece(exact, 1601), 'injured');
  assert.equal(report(exact).deductions, 1250);
  assert.equal(releasePiece(exact, 1700), 'bad');
  assert.equal(grabPiece(exact, 1750), 'blocked');
  assert.equal(takeBreak(exact, 1800), 'break');
  advance(exact, 5300);
  assert.equal(exact.fatigue, 0);
  assert.equal(grabPiece(exact, 6300), 'grab');
  assert.equal(cutPiece(exact, 7470), 'perfect');
  assert.equal(exact.accidents, 1);
  assert.equal(report(exact).deductions, 1330);
});

test('the first successful grab uses wider windows once per shift', () => {
  const state = createShift();
  advance(state, 12000);
  assert.notEqual(grabbable(state).id, 0);
  assert.equal(grabPiece(state, 12000), 'grab');
  assert.equal(state.bench.guided, true);
  const guided = state.bench.timing;
  const width = timing => timing.perfectUntil - timing.perfectFrom;
  assert.equal(cutPiece(state, guided.perfectFrom + 1), 'perfect');
  releasePiece(state, 13500);
  assert.equal(grabPiece(state, 13500), 'grab');
  assert.equal(state.bench.guided, false);
  const regular = state.bench.timing;
  assert.equal(guided.deadline - guided.goodFrom, TUNING.goodLeadMs + TUNING.guidedGoodLeadMs);
  assert.equal(regular.deadline - regular.goodFrom, TUNING.goodLeadMs);
  assert(width(guided) - width(regular) >= TUNING.guidedPerfectMs);

  const restarted = createShift(14000);
  grabPiece(restarted, 14000);
  assert.equal(restarted.bench.guided, true);
});

test('fatigue shortens the ring and narrows the perfect window with a playable floor', () => {
  const fresh = createShift();
  grabPiece(fresh, 0);
  assert.equal(cutPiece(fresh, 1280), 'perfect');

  const tired = createShift();
  grabPiece(tired, 0);
  releasePiece(tired, 0);
  tired.fatigue = 1;
  grabPiece(tired, 6500);
  assert.equal(cutPiece(tired, 7130), 'good');

  const exhaustedAfterInjury = createShift();
  exhaustedAfterInjury.fatigue = 1;
  exhaustedAfterInjury.accidents = 1;
  grabPiece(exhaustedAfterInjury, 0);
  assert.equal(cutPiece(exhaustedAfterInjury, 734), 'perfect');
});

test('a NR-36 break recovers fatigue, blocks work and has a cooldown', () => {
  const state = createShift();
  advance(state, 30000);
  assert.ok(state.fatigue > 0.1);
  state.fatigue = 0.6;
  const tired = state.fatigue;
  assert.equal(takeBreak(state, 30000), 'break');
  assert.equal(grabPiece(state, 30100), 'blocked');
  assert.equal(cutPiece(state, 30200), 'break');
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

test('a coarse tick that crosses the end of a rest recovers before adding work fatigue', () => {
  const coarse = createShift();
  const fine = createShift();
  for (const state of [coarse, fine]) takeBreak(state, 0);
  advance(fine, TUNING.breakMs);
  advance(fine, TUNING.breakMs + 1000);
  advance(coarse, TUNING.breakMs + 1000);
  assert.ok(fine.fatigue > 0);
  assert.equal(coarse.fatigue, fine.fatigue);
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
  for (const at of [0, 7000, 12000]) {
    assert.equal(grabPiece(state, at), 'grab');
    assert.equal(cutPiece(state, at + 1350), 'perfect');
    assert.equal(releasePiece(state, at + 1400), 'done');
  }
  assert.equal(state.cleanCuts, 3);
  assert.equal(state.bestStreak, 3);
  assert.ok(state.bonus > 0);

  state.accidents = 2;
  state.lost = 3;
  state.badReturns = 1;
  const result = report(state);
  assert.equal(result.gross, 6400 + 3 * 60 + state.bonus);
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

test('a piece left on the bench at the end of the shift is lost', () => {
  const state = createShift();
  assert.equal(grabPiece(state, SHIFT_MS - 100), 'grab');
  const { id } = state.bench;
  advance(state, SHIFT_MS);
  assert.equal(state.bench, null);
  assert.ok(state.events.some(event => event.kind === 'lost' && event.id === id));
  assert.equal(state.accidents, 0);
  assert.equal(cutPiece(state, SHIFT_MS), null);
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
