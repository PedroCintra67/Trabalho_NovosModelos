import {
  WIDTH, HEIGHT, SHIFT_MS, HOURS, BENCH, TARGET,
  createShift, advance, cutPiece,
  togglePiece, takeBreak, breakStatus, report, reflect, playable, grabbable,
} from './engine.mjs';

const byId = (id) => document.getElementById(id);
const canvas = byId('line');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const context = canvas.getContext('2d');
const background = document.createElement('canvas');
background.width = WIDTH;
background.height = HEIGHT;
const scenery = background.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function gradient(ctx, x1, y1, x2, y2, ...colors) {
  const result = ctx.createLinearGradient(x1, y1, x2, y2);
  colors.forEach((color, index) => result.addColorStop(index / (colors.length - 1), color));
  return result;
}

function shape(ctx, data, fill, stroke, width = 1) {
  const path = typeof data === 'string' ? new Path2D(data) : data;
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function label(ctx, value, x, y, color, size = 14) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Consolas, monospace`;
  ctx.fillText(value, x, y);
}

function tag(value, x, y, fill, color, size = 12) {
  context.font = `bold ${size}px Consolas, monospace`;
  const width = context.measureText(value).width + 12;
  context.fillStyle = fill;
  context.fillRect(x - width / 2, y - size - 3, width, size + 8);
  label(context, value, x - width / 2 + 6, y, color, size);
}

// A esteira corre na diagonal, em perspectiva; as coordenadas do jogo não são deformadas.
const belt = new Path2D('M-20 230 L1020 174 L1020 309 L-20 433 Z');
function paintFactory(ctx) {
  ctx.fillStyle = gradient(ctx, 0, 0, 0, 520, '#152a38', '#36596a', '#103040', '#08131e');
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const light = ctx.createRadialGradient(720, 78, 8, 720, 78, 520);
  light.addColorStop(0, '#83c6d458');
  light.addColorStop(1, '#83c6d400');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  shape(ctx, 'M0 0 H1000 V43 L0 102 Z', '#0e202d');
  shape(ctx, 'M0 66 L1000 15 M0 93 L1000 38', null, '#436274', 3);
  for (let x = -100; x < 1110; x += 133) {
    shape(ctx, `M${x} 0 L${x + 43} 238 M${x + 8} 0 L${x + 51} 238`, null, '#112630aa', 4);
  }
  for (const [x, y, width] of [[42, 91, 158], [345, 74, 176], [667, 54, 225]]) {
    shape(ctx, `M${x} ${y + 10} l${width} -9 70 175 -${width + 55} 20 Z`,
      gradient(ctx, x, y, x + 30, y + 175, '#99dbea44', '#abdbe500'));
    shape(ctx, `M${x} 20 v${y - 20} M${x + width} 20 v${y - 29}`, null, '#172630', 3);
    shape(ctx, `M${x - 7} ${y - 3} l${width + 14} -9 0 11 -${width + 14} 9 Z`, '#223844');
    shape(ctx, `M${x} ${y + 6} l${width} -9`, null, '#ccf4ff', 4);
  }
  shape(ctx, 'M0 193 L1000 129 L1000 158 L0 246 Z', '#395869', '#6894a2');
  shape(ctx, 'M0 215 L1000 146 L1000 188 L0 269 Z', '#182c3a');
  for (const [x, y, scale] of [[280, 163, .8], [596, 140, .7], [904, 123, .7]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    shape(ctx, 'M-24 37 Q-16 -3 -4 -9 Q17 -13 28 25 L55 37 50 49 15 43 -26 59Z', '#486c7c', '#6793a0', 2);
    ellipse(ctx, 3, -23, 17, 20, '#7aa6b5');
    shape(ctx, 'M-11 -19 L19 -25 18 -12 0 -7Z', '#a0bcc4');
    ctx.restore();
  }
  shape(ctx, 'M0 479 L1000 344 V520 H0Z', '#0c202c');
  shape(ctx, 'M220 520 L992 357 M577 520 L1000 395 M878 520 L1000 464', null, '#33505a', 2);
  shape(ctx, 'M-20 431 L1020 307 L1020 352 L-20 508 Z',
    gradient(ctx, 0, 350, 35, 500, '#537481', '#213b49', '#132630'), '#527582', 2);
  shape(ctx, 'M0 454 L1000 327 M0 477 L1000 344', null, '#69899570', 2);
  for (const [x, y] of [[70, 462], [285, 434], [506, 404], [725, 378], [945, 350]]) {
    ellipse(ctx, x, y, 4, 3, '#7895a3');
    shape(ctx, `M${x - 2} ${y + 1} l4 -2`, null, '#182832');
  }
  ctx.fillStyle = gradient(ctx, 0, 178, 25, 439, '#304c5b', '#8ba8ab', '#b4cbd0', '#4b7182');
  ctx.fill(belt);
  ctx.save();
  ctx.clip(belt);
  let seed = 127;
  for (let i = 0; i < 1100; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % WIDTH;
    const y = 174 + ((seed >>> 12) % 260);
    ctx.fillStyle = i % 2 ? '#d0f0f122' : '#203f4b23';
    ctx.fillRect(x, y, 2 + seed % 34, .8);
  }
  ctx.restore();
  // Faixas que delimitam a área de alcance do posto.
  ctx.save();
  ctx.clip(belt);
  for (const x of [65, WIDTH - 65]) shape(ctx, `M${x} 150 L${x - 40} 450`, null, '#ffcb7355', 2);
  ctx.restore();
}
paintFactory(scenery);

function drawBelt(offset) {
  context.save();
  context.clip(belt);
  for (let x = -220 + offset % 62; x < 1100; x += 62) {
    shape(context, `M${x} 165 l-108 280`, null, '#142d3c52', 2);
    shape(context, `M${x + 3} 165 l-108 280`, null, '#d1f0f266');
  }
  context.restore();
  shape(context, 'M0 230 L1000 174 M0 431 L1000 309', null, '#162c39', 8);
  shape(context, 'M0 235 L1000 179 M0 425 L1000 305', null, '#c9e3e8a0', 2);
  shape(context, 'M0 409 L1000 298', null, '#88e4e876', 2);
  shape(context, 'M75 429 L274 406 L269 431 L71 459Z', '#241e18', '#b18143');
  context.save();
  context.transform(1, -.128, -.13, 1, 83, 449);
  label(context, 'ESTEIRA EM MOVIMENTO', 0, 0, '#ffca70', 12);
  context.restore();
}

const meat = Object.fromEntries(Object.entries({
  peito: 'M-64 13 C-75 0 -54 -24 -32 -34 C-11 -47 9 -45 30 -32 C53 -31 72 -6 65 11 C56 29 8 34 -35 31 C-50 32 -63 25 -64 13Z',
  asa: 'M-68 15 C-63 5 -47 5 -35 -4 L-3 -31 C17 -46 41 -41 45 -26 C45 -13 28 -8 31 -3 C34 2 54 -8 65 -3 C81 8 68 22 53 24 L1 19 C-12 18 -28 26 -45 26 C-56 34 -75 28 -68 15Z',
  coxa: 'M-66 16 C-77 7 -60 -2 -53 -1 C-35 -4 -33 -11 -26 -23 C-17 -43 15 -47 40 -32 C63 -23 73 -2 61 17 C50 34 26 37 6 29 C-10 22 -32 15 -49 24 C-58 29 -70 25 -66 16Z',
}).map(([type, data]) => [type, new Path2D(data)]));
const flesh = gradient(context, -18, -40, 12, 39, '#f8d9ca', '#d8a69b', '#a56869', '#6f434b');
const shade = gradient(context, 0, -25, 0, 20, '#ffffff51', '#ffffff00');
const cutAngles = { peito: .13, asa: -.21, coxa: -.08 };
const cutMasks = Object.fromEntries(Object.entries(cutAngles).map(([type, angle]) => {
  const end = 100 * Math.tan(angle);
  return [type, [
    new Path2D(`M-100 -100 H100 V${end} L-100 ${-end}Z`),
    new Path2D(`M-100 ${-end} L100 ${end} V100 H-100Z`),
  ]];
}));
const cutSucceeded = (cut) => cut === 'perfect' || cut === 'good';
const typeNames = { peito: 'Peito', asa: 'Asa', coxa: 'Coxa' };

// Desenha a carne em coordenadas locais (o contexto já está transladado e escalado).
function drawMeatSurface(type) {
  shape(context, meat[type], flesh, '#5f4248', 2);
  context.save();
  context.clip(meat[type]);
  shape(context, 'M-75 14 Q-32 -47 31 -43 Q54 -29 72 1 Q30 -21 9 -11 Q-9 -8 -19 5 Q-46 11 -75 14Z', shade);
  shape(context, 'M-45 21 Q-19 3 7 16 T55 13 M-34 -13 Q-14 -30 9 -29 M-19 22 Q8 24 25 28', null, '#703e4e55', 1.5);
  for (let i = 0; i < 42; i++) {
    ellipse(context, (i * 31 % 130) - 65, (i * 17 % 72) - 36, 1, .7, i % 2 ? '#f6d7c589' : '#6e43444d');
  }
  context.restore();
}

function drawMeat(type, split = false) {
  ellipse(context, 3, 24, 70, 17, '#142d3b55');
  if (!split) {
    drawMeatSurface(type);
    return;
  }

  const angle = cutAngles[type];
  const edgeY = 100 * Math.tan(angle);
  // Both halves share the original silhouette and move perpendicular to the cut.
  cutMasks[type].forEach((mask, index) => {
    const offset = index === 0 ? -3 : 3;
    context.save();
    context.translate(-Math.sin(angle) * offset, Math.cos(angle) * offset);
    context.clip(mask);
    drawMeatSurface(type);
    context.clip(meat[type]);
    shape(context, `M-100 ${-edgeY} L100 ${edgeY}`, null, '#b57870', 7);
    shape(context, `M-100 ${-edgeY} L100 ${edgeY}`, null, '#f7c7ac', 3);
    context.restore();
  });
}

function drawBeltPiece(piece, highlight) {
  const { x, y, type, returned, cut } = piece;
  const complete = cutSucceeded(cut);
  context.save();
  context.translate(x, y);
  if (returned) {
    context.scale(.85, .85);
    shape(context, new Path2D('M-80 -38 Q-82 -48 -70 -48 H70 Q82 -48 80 -38 L76 38 Q75 46 66 46 H-66 Q-75 46 -76 38 Z'),
      complete ? '#dfe8eacc' : '#9aa8acaa', '#7d97a0', 2);
  }
  if (highlight) {
    context.save();
    context.shadowColor = '#ffcb73';
    context.shadowBlur = 14;
    shape(context, meat[type], null, '#ffcb73', 4);
    context.restore();
  }
  drawMeat(type, returned && complete);
  context.restore();

  if (returned) {
    tag(complete ? 'PRONTA' : 'INCOMPLETA', x, y - 44, complete ? '#173328' : '#3a2a12', complete ? '#9ff0c4' : '#ffcb73', 11);
  } else if (highlight) {
    tag(`E · PEGAR ${type.toUpperCase()}`, x, y - 46, '#3a2a12', '#ffcb73', 12);
  } else if (x > WIDTH - 65) {
    tag('FORA DO ALCANCE', x, y - 46, '#273743', '#c3cdd3', 11);
  } else if (playable(x)) {
    tag(type.toUpperCase(), x, y - 46, '#132a36', '#edf8fa', 11);
  }
}

const board = new Path2D(`M${BENCH.x - 160} ${BENCH.y - 78} H${BENCH.x + 160} Q${BENCH.x + 172} ${BENCH.y - 78} ${BENCH.x + 172} ${BENCH.y - 66}
  V${BENCH.y + 90} H${BENCH.x - 172} V${BENCH.y - 66} Q${BENCH.x - 172} ${BENCH.y - 78} ${BENCH.x - 160} ${BENCH.y - 78}Z`);

const benchAssets = Object.fromEntries(['poly-board', 'support-glove', 'knife-glove'].map(name => {
  const image = new Image();
  image.addEventListener('load', () => {
    if (!running || paused) draw(performance.now());
  });
  image.src = new URL(`../assets/bench/${name}.svg`, import.meta.url);
  return [name, image];
}));

function drawAsset(name, x, y) {
  const image = benchAssets[name];
  if (image.naturalWidth) context.drawImage(image, x, y);
}

const IMPACT_MS = 68;
const STRIKE_MS = 244;
let strike = null;

function drawBench(strikeAge) {
  drawAsset('poly-board', BENCH.x - 196, BENCH.y - 81);
  drawAsset('support-glove', BENCH.x - 284, BENCH.y - 52);
  if (state.accidents) {
    shape(context, 'M290 430 312 414 327 430 305 446Z', '#e6e1ca', '#626b64', 1.5);
    shape(context, 'M303 429h11m-5-5v10', null, '#504941', 2);
  }
  const piece = state.bench;
  if (!piece) {
    label(context, 'BANCADA VAZIA', BENCH.x - 56, BENCH.y - 4, '#34515b', 15);
    if (running && grabbable(state) && state.breakUntil === null && state.elapsed >= state.injuredUntil) {
      label(context, 'E · pegar peça', BENCH.x - 56, BENCH.y + 18, '#694812', 14);
    }
    return;
  }

  context.save();
  context.translate(BENCH.x, BENCH.y);
  context.scale(BENCH.scale, BENCH.scale);
  const complete = cutSucceeded(piece.cut);
  drawMeat(piece.type, complete && strikeAge >= IMPACT_MS);
  context.restore();

  let instruction;
  if (piece.cut === null) {
    const { startedAt, goodFrom, perfectFrom, perfectUntil, deadline } = piece.timing;
    const radius = (at) => 16 + 57 * (deadline - at) / (deadline - startedAt);
    const band = (from, until, color, dashed = false) => {
      context.beginPath();
      context.arc(BENCH.x, BENCH.y, (radius(from) + radius(until)) / 2, 0, 2 * Math.PI);
      context.lineWidth = radius(from) - radius(until);
      context.strokeStyle = color;
      context.setLineDash(dashed ? [3, 3] : []);
      context.stroke();
      context.setLineDash([]);
    };
    band(goodFrom, deadline, '#102631b5');
    band(perfectFrom, perfectUntil, '#0b252b');
    band(perfectFrom, perfectUntil, '#77f1cb', true);
    const elapsed = state.elapsed;
    const perfect = elapsed >= perfectFrom && elapsed <= perfectUntil;
    instruction = perfect ? 'CORTE AGORA' : elapsed >= goodFrom ? 'BOM CORTE' : 'AGUARDE O ANEL';
    const ring = radius(state.elapsed);
    context.beginPath();
    context.arc(BENCH.x, BENCH.y, ring, 0, 2 * Math.PI);
    context.lineWidth = 4;
    context.strokeStyle = '#0a1720';
    context.stroke();
    context.lineWidth = 2;
    context.strokeStyle = '#ffffff';
    context.stroke();
  } else {
    instruction = complete ? 'PRONTA · E PARA DEVOLVER' : 'INCOMPLETA · E PARA DEVOLVER';
  }
  const benchLabel = piece.guided && piece.cut === null ? 'PRIMEIRA PEÇA GUIADA' : typeNames[piece.type].toUpperCase();
  tag(`${benchLabel} · ${instruction}`, BENCH.x, BENCH.y - 86, '#0b2630', '#a3ffff', 13);
}

function drawDressing() {
  if (state.elapsed < state.injuredUntil) {
    shape(context, board, '#6b0f1a55');
    const seconds = ((state.injuredUntil - state.elapsed) / 1000).toFixed(1).replace('.', ',');
    tag(`CURATIVO · ${seconds} s`, BENCH.x, BENCH.y + 6, '#321f25', '#ffc0b6', 15);
  }
}

const blade = new Path2D('M-106 0 Q-119 -9 -107 -29 L55 -33 84 -14 91 -14 91 5 72 6 55 0Z');
const steel = gradient(context, 0, -33, 0, 0, '#d9ece8', '#718d95', '#e2f3ed');

function drawKnife(strikeAge) {
  const phase = strikeAge < IMPACT_MS
    ? strikeAge / IMPACT_MS
    : Math.max(0, 1 - (strikeAge - IMPACT_MS - 26) / (STRIKE_MS - IMPACT_MS - 26));
  const reach = Math.min(1, phase) ** (strikeAge < IMPACT_MS ? 2 : 3);
  const angle = state.bench ? cutAngles[state.bench.type] : 0;
  const tremorLevel = state.fatigue + Math.min(state.accidents, 2) * .18;
  const tremor = reducedMotion.matches ? 0 : Math.sin(state.elapsed / 38) * tremorLevel * .035;
  context.save();
  context.translate(BENCH.x + 188 * (1 - reach), BENCH.y + 32 * (1 - reach));
  context.rotate(angle * reach + (-.51 + tremor) * (1 - reach));
  shape(context, blade, steel, '#264650', 2);
  shape(context, 'M-104 -2 H55 M-99 -25 53 -29', null, '#f1f9f5', 1.4);
  drawAsset('knife-glove', 84, -66);
  context.restore();
}

// Partículas do acidente.
let particles = [];
function spawnParticles(a, b, count, colors, spread) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const speed = spread * (.3 + Math.random());
    particles.push({
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - spread * .4,
      life: 0, max: 450 + Math.random() * 450, color: colors[i % colors.length],
      size: 1 + Math.random() * 2.2,
    });
  }
}

function drawParticles(dt) {
  particles = particles.filter(p => (p.life += dt) < p.max);
  for (const p of particles) {
    p.x += p.vx * dt / 1000;
    p.y += p.vy * dt / 1000;
    p.vy += 300 * dt / 1000;
    context.globalAlpha = 1 - p.life / p.max;
    shape(context, `M${p.x} ${p.y} l${p.vx / 60} ${p.vy / 60}`, null, p.color, p.size);
  }
  context.globalAlpha = 1;
}

const demo = [
  { id: -1, x: 230, y: 265, type: 'peito', returned: false, cut: null },
  { id: -2, x: 470, y: 265, type: 'asa', returned: true, cut: 'perfect' },
  { id: -3, x: 760, y: 265, type: 'coxa', returned: false, cut: null },
];
const vignette = context.createRadialGradient(500, 255, 160, 500, 255, 570);
vignette.addColorStop(0, '#08152200');
vignette.addColorStop(1, '#061427e6');
let state = createShift();
let running = false;
let paused = false;
let pausedAt = 0;
let pauseOffset = 0;
const pauses = [];
let frame = 0;
let guideEnabled = false;
let guideInPerfect = false;
let lastBeltDistance = 0;
let slatDistance = 0;
let lastFrame = 0;
let wallStartedAt = 0;
let lastDraw = 0;
let feedbackUntil = 0;
let feedbackPriority = 0;
let seenEvents = 0;
let flash = 0;
let shake = 0;

const gameTime = (timestamp) => timestamp - pauseOffset;

function drawBreak() {
  if (state.breakUntil === null) return;
  context.fillStyle = '#06121ab8';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const seconds = ((state.breakUntil - state.elapsed) / 1000).toFixed(1).replace('.', ',');
  tag(`PAUSA NR-36 · ${seconds} s`, WIDTH / 2, 230, '#0b2630', '#a3ffff', 22);
  tag('A fadiga diminui, mas a esteira não para.', WIDTH / 2, 268, '#0b141d', '#c3cdd3', 14);
}

function draw(now) {
  const dt = Math.min(100, Math.max(0, now - lastDraw));
  lastDraw = now;
  context.save();
  if (shake > 0 && !reducedMotion.matches) {
    context.translate((Math.random() - .5) * shake * 12, (Math.random() - .5) * shake * 12);
  }
  context.drawImage(background, 0, 0);
  drawBelt(reducedMotion.matches ? 0 : state.elapsed * state.speed / 1000);
  const target = running ? grabbable(state) : demo[2];
  const pieces = running ? state.pieces : demo;
  for (const piece of pieces) drawBeltPiece(piece, piece === target && !state.bench && state.breakUntil === null && state.elapsed >= state.injuredUntil);
  const strikeAge = strike && strike.id === state.bench?.id && !reducedMotion.matches
    ? state.elapsed - strike.startedAt : Infinity;
  drawBench(strikeAge);
  drawKnife(strikeAge);
  drawDressing();
  drawParticles(dt);
  context.globalAlpha = .3 + state.fatigue * .6;
  context.fillStyle = vignette;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalAlpha = 1;
  drawBreak();
  if (flash > 0) {
    context.fillStyle = `rgba(200, 20, 30, ${flash * .35})`;
    context.fillRect(-20, -20, WIDTH + 40, HEIGHT + 40);
  }
  context.restore();
  flash = Math.max(0, flash - dt / 500);
  shake = Math.max(0, shake - dt / 350);
}

const hud = {
  meter: byId('fatigue'),
  fatigue: byId('fatigue-value'),
  breakState: byId('break-state'),
  hour: byId('hour'),
  clock: byId('clock'),
  remaining: byId('time-left'),
  processed: byId('processed'),
  losses: byId('losses'),
  points: byId('points'),
  deductions: byId('deductions'),
};
const grabButton = byId('grab');
const cutButton = byId('cut');
const breakButton = byId('break');
const feedback = byId('feedback');
const audioButton = byId('audio');
let audioContext;
let hum = null;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
byId('target').textContent = String(TARGET);

function updateText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function updateHud() {
  const minutes = Math.floor(state.elapsed / SHIFT_MS * 480);
  const two = (value) => String(value).padStart(2, '0');
  updateText(hud.clock, `${two(6 + Math.floor(minutes / 60))}:${two(minutes % 60)}`);
  updateText(hud.hour, `Hora ${state.hour + 1} de ${HOURS} · esteira ${state.speed}`);
  updateText(hud.remaining, `${Math.ceil((SHIFT_MS - state.elapsed) / 1000)} s restantes`);
  updateText(hud.processed, String(state.processed));
  updateText(hud.losses, `${plural(state.lost, 'perdida', 'perdidas')} · ${plural(state.accidents, 'acidente', 'acidentes')}`);
  updateText(hud.points, `${state.points} pontos`);
  updateText(hud.deductions, `Descontos simulados: ${money.format(report(state).deductions / 100)}`);
  updateText(hud.fatigue, percent(state.fatigue));
  if (hud.meter.value !== state.fatigue) hud.meter.value = state.fatigue;

  const status = breakStatus(state);
  let breakText = 'Pausa NR-36 disponível';
  let breakMode = 'ready';
  if (status.reason === 'break') {
    breakText = `Em pausa · ${Math.ceil(status.remaining / 1000)} s`;
    breakMode = 'active';
  } else if (status.reason === 'cooldown') {
    breakText = `Próxima pausa em ${Math.ceil(status.remaining / 1000)} s`;
    breakMode = 'wait';
  } else if (status.reason === 'busy') {
    breakText = 'Devolva a peça para pausar';
    breakMode = 'wait';
  } else if (!running) {
    breakText = 'Pausa NR-36';
    breakMode = 'wait';
  }
  updateText(hud.breakState, breakText);
  hud.breakState.dataset.state = breakMode;

  const playing = running && !paused;
  cutButton.hidden = !playing;
  breakButton.disabled = !playing || !status.ready;
  grabButton.disabled = !playing || state.breakUntil !== null || (!state.bench && (state.elapsed < state.injuredUntil || !grabbable(state)));
  const mode = state.bench ? 'release' : 'grab';
  if (grabButton.dataset.mode !== mode) {
    grabButton.dataset.mode = mode;
    grabButton.innerHTML = `${mode === 'release' ? 'Devolver peça' : 'Pegar peça'} <kbd>E</kbd>`;
  }
}

function soundOn() {
  return audioButton.getAttribute('aria-pressed') === 'true' && audioContext?.state === 'running';
}

function unlockAudio() {
  if (audioButton.getAttribute('aria-pressed') !== 'true' || !window.AudioContext) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
  } catch {
    // O jogo continua jogável se o navegador não abrir um dispositivo de áudio.
  }
}

function startHum() {
  if (hum || !soundOn() || !running || paused) return;
  const oscillator = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.value = 46;
  filter.type = 'lowpass';
  filter.frequency.value = 180;
  gain.gain.value = .018;
  oscillator.connect(filter).connect(gain).connect(audioContext.destination);
  oscillator.start();
  hum = { oscillator, gain };
}

function stopHum() {
  if (!hum) return;
  const now = audioContext.currentTime;
  hum.gain.gain.setTargetAtTime(0, now, .05);
  hum.oscillator.stop(now + .3);
  hum = null;
}

function tone(frequencies, duration, { type = 'sine', volume = .05, slide = 1, delay = 0 } = {}) {
  if (!soundOn()) return;
  const start = audioContext.currentTime + delay;
  for (const frequency of frequencies) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * slide, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }
}

function noise(duration, frequency, volume, filterType = 'lowpass') {
  if (!soundOn()) return;
  const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.value = frequency;
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start();
}

const sounds = {
  perfect: () => tone([1040, 1760, 2600], .16, { volume: .05, slide: .84 }),
  good: () => tone([910, 1540], .14, { volume: .045, slide: .84 }),
  error: () => noise(.07, 1600, .2),
  accident: () => { noise(.14, 700, .5); tone([180], .3, { type: 'square', volume: .05, slide: .6 }); },
  grab: () => tone([240], .09, { type: 'triangle', volume: .09, slide: .7 }),
  done: () => { tone([520], .1, { type: 'triangle', volume: .07 }); tone([780], .14, { type: 'triangle', volume: .06, delay: .08 }); },
  bad: () => tone([200], .16, { type: 'square', volume: .04, slide: .8 }),
  lost: () => tone([150], .25, { type: 'sawtooth', volume: .04, slide: .7 }),
  supervisor: () => { tone([620], .12, { type: 'square', volume: .035 }); tone([440], .16, { type: 'square', volume: .035, delay: .14 }); },
  break: () => tone([440, 660], .5, { volume: .05, slide: 1.2 }),
  blocked: () => tone([300], .06, { type: 'triangle', volume: .04 }),
  clack: () => noise(.018, 2600, .035, 'bandpass'),
};

function announce(tone, message, now, priority = 1) {
  if (now < feedbackUntil && priority < feedbackPriority) return;
  feedback.dataset.kind = tone;
  feedback.textContent = message;
  feedbackUntil = now + (priority > 1 ? 2200 : 1650);
  feedbackPriority = priority;
}

const blockedMessages = {
  'no-piece': 'Bancada vazia · pressione E para pegar uma peça',
  break: 'Em pausa · aguarde o fim da pausa',
  injured: 'Mão ferida · aguarde o curativo',
  resolved: 'Corte encerrado · pressione E para devolver',
  busy: 'Devolva a peça à esteira antes da pausa',
  cooldown: 'Pausa indisponível por enquanto',
};

function presentEvent(event, now) {
  switch (event.kind) {
    case 'perfect':
    case 'good': {
      strike = { id: event.id, startedAt: state.elapsed };
      const quality = event.kind === 'perfect' ? 'Corte perfeito' : 'Bom corte';
      const streak = event.streak >= 3 ? ` · sequência ${event.streak} (+bônus)` : '';
      announce('good', `${quality} · +${event.points} pontos · E para devolver${streak}`, now);
      sounds[event.kind]();
      break;
    }
    case 'error':
      announce('warn', 'Corte cedo demais · E para devolver', now);
      sounds.error();
      break;
    case 'accident': {
      announce('danger', 'Acidente · tempo esgotado · curativo e desconto', now, 3);
      spawnParticles(BENCH, BENCH, 30, ['#c2273b', '#8d1726', '#ff5a5a'], 120);
      flash = 1;
      shake = 1;
      sounds.accident();
      break;
    }
    case 'grab':
      announce('good', event.guided ? 'Primeira peça guiada · espere CORTE AGORA' : `${typeNames[event.type]} na bancada`, now);
      sounds.grab();
      break;
    case 'empty':
      announce('warn', 'Nenhuma peça ao alcance', now);
      sounds.blocked();
      break;
    case 'done':
      announce('good', 'Peça processada · de volta à esteira', now);
      sounds.done();
      break;
    case 'bad':
      announce('warn', 'Peça devolvida incompleta · desconto', now, 2);
      sounds.bad();
      break;
    case 'lost':
      if (state.lost % 3 === 0 && !state.finished) {
        announce('warn', 'Supervisor: peças passando direto! Mais rápido!', now, 2);
        sounds.supervisor();
      } else {
        announce('warn', 'Peça perdida no fim da esteira', now);
        sounds.lost();
      }
      break;
    case 'hour': {
      const behind = event.processed < event.expected;
      announce(behind ? 'warn' : 'good', behind
        ? `Supervisor: ritmo abaixo da meta (${event.processed} de ${event.expected})`
        : `Hora ${event.hour + 1} · meta até agora ${event.expected}`, now, 2);
      sounds.supervisor();
      break;
    }
    case 'break':
      announce('good', 'Pausa NR-36 · a esteira não para', now, 2);
      sounds.break();
      break;
    case 'break-end':
      announce('good', 'Fim da pausa · de volta ao posto', now);
      sounds.grab();
      break;
    case 'blocked':
      announce('warn', blockedMessages[event.reason] ?? 'Ação indisponível', now);
      sounds.blocked();
      break;
    default:
  }
}

function presentEvents() {
  const now = performance.now();
  while (seenEvents < state.events.length) presentEvent(state.events[seenEvents++], now);
}

// Recorde local, só como conveniência: tudo funciona sem armazenamento.
const RECORD_KEY = 'turno-na-esteira:recorde';
function readRecord() {
  try {
    return JSON.parse(localStorage.getItem(RECORD_KEY)) ?? null;
  } catch {
    return null;
  }
}

function saveRecord(result) {
  const previous = readRecord();
  const record = {
    net: Math.max(previous?.net ?? -Infinity, result.net),
    processed: Math.max(previous?.processed ?? 0, result.processed),
  };
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // Armazenamento indisponível: o recorde não é guardado.
  }
  return { previous, record, best: !previous || result.net > previous.net };
}

function finish() {
  running = false;
  stopHum();
  canvas.tabIndex = -1;
  const result = report(state);
  for (const [key, value] of Object.entries(result)) {
    const element = byId(`r-${key}`);
    if (!element) continue;
    element.textContent = ['gross', 'bonus', 'deductions', 'net'].includes(key)
      ? money.format(value / 100)
      : key === 'fatigue' ? `${percent(value)} / ${percent(result.maxFatigue)}` : String(value);
  }
  byId('reflection').textContent = reflect(result);
  const { previous, best } = saveRecord(result);
  byId('record').textContent = best
    ? (previous ? `Novo recorde de valor líquido! Anterior: ${money.format(previous.net / 100)}` : '')
    : `Seu recorde: ${money.format(previous.net / 100)} líquidos, ${previous.processed} peças`;
  byId('actions').hidden = true;
  byId('guidance').textContent = '';
  byId('results').hidden = false;
  updateHud();
  byId('result-title').focus();
}

function tick(timestamp) {
  if (paused) return;
  const now = Math.max(gameTime(timestamp), lastFrame);
  lastFrame = now;
  advance(state, now);
  presentEvents();
  const distance = state.elapsed * state.speed / 1000;
  slatDistance += distance - lastBeltDistance;
  lastBeltDistance = distance;
  updateGuidance();
  if (slatDistance >= 62) {
    slatDistance %= 62;
    sounds.clack();
  }
  startHum();
  if (timestamp >= feedbackUntil && feedback.textContent) feedback.textContent = '';
  updateHud();
  draw(timestamp);
  if (state.finished) finish();
  else frame = requestAnimationFrame(tick);
}

function start(event) {
  cancelAnimationFrame(frame);
  unlockAudio();
  paused = false;
  pauseOffset = 0;
  pauses.length = 0;
  byId('paused').hidden = true;
  lastFrame = wallStartedAt = performance.now();
  state = createShift(lastFrame);
  running = true;
  lastBeltDistance = 0;
  slatDistance = 0;
  feedbackUntil = 0;
  feedbackPriority = 0;
  seenEvents = 0;
  particles = [];
  strike = null;
  flash = 0;
  shake = 0;
  guideInPerfect = false;
  byId('guidance').textContent = '';
  feedback.textContent = '';
  byId('briefing').hidden = true;
  byId('results').hidden = true;
  byId('actions').hidden = false;
  byId('pause').textContent = 'Pausar jogo';
  canvas.tabIndex = 0;
  canvas.focus({ preventScroll: event.currentTarget.id === 'start' });
  updateHud();
  draw(lastFrame);
  frame = requestAnimationFrame(tick);
}

function setPaused(value) {
  if (!running || paused === value) return;
  paused = value;
  const now = performance.now();
  byId('paused').hidden = !paused;
  byId('pause').textContent = paused ? 'Continuar jogo' : 'Pausar jogo';
  if (paused) {
    advance(state, gameTime(now));
    pausedAt = now;
    cancelAnimationFrame(frame);
    stopHum();
    feedback.textContent = '';
    presentEvents();
    updateHud();
    draw(now);
    if (state.finished) {
      byId('paused').hidden = true;
      finish();
      return;
    }
    byId('resume').focus();
  } else {
    pauseOffset += now - pausedAt;
    pauses.push({ start: pausedAt, end: now });
    lastDraw = now;
    updateHud();
    canvas.focus({ preventScroll: true });
    frame = requestAnimationFrame(tick);
  }
}

function act(action, inputTime) {
  if (!running || (paused && inputTime === undefined)) return;
  unlockAudio();
  const accidents = state.accidents;
  action(state, inputTime ?? gameTime(performance.now()));
  if (state.accidents < accidents) {
    // A correção remove um evento já exibido antes de registrar o corte.
    seenEvents--;
    feedbackUntil = 0;
    particles = [];
    flash = 0;
    shake = 0;
  }
  presentEvents();
  updateHud();
  updateGuidance();
}

function cutFromInput(event) {
  if (!running) return;
  const timestamp = event.timeStamp;
  if (!Number.isFinite(timestamp) || timestamp < wallStartedAt || timestamp > performance.now()) return;
  if (paused && timestamp >= pausedAt) return;

  let inputTime = timestamp;
  for (const { start, end } of pauses) {
    if (timestamp < start) break;
    if (timestamp < end) return;
    inputTime -= end - start;
  }
  if (!paused && event.currentTarget === canvas) canvas.focus({ preventScroll: true });
  act(cutPiece, inputTime);
}

canvas.addEventListener('click', cutFromInput);
cutButton.addEventListener('click', cutFromInput);
cutButton.addEventListener('keydown', (event) => {
  if (event.repeat && (event.key === 'Enter' || event.code === 'Space')) event.preventDefault();
});

canvas.addEventListener('contextmenu', (event) => {
  if (!running) return;
  event.preventDefault();
  act(togglePiece);
});

const guidance = byId('guidance');
const guideToggle = byId('guide-toggle');
function updateGuidance() {
  if (!guideEnabled || !running || paused) return;
  const piece = state.bench;
  const timing = piece?.cut === null ? piece.timing : null;
  const perfect = timing && state.elapsed >= timing.perfectFrom && state.elapsed <= timing.perfectUntil;
  if (perfect && !guideInPerfect) tone([1180], .08);
  guideInPerfect = Boolean(perfect);
  const message = state.breakUntil !== null ? 'Em pausa NR-36.'
    : state.elapsed < state.injuredUntil ? 'Aguarde o curativo.'
    : !piece ? 'Pressione E quando houver uma peça ao alcance.'
    : !timing ? 'Pressione E para devolver a peça.'
    : perfect ? 'Corte agora.'
    : state.elapsed < timing.goodFrom ? 'Aguarde o anel.'
    : 'Janela de bom corte.';
  updateText(guidance, message);
}

guideToggle.addEventListener('click', () => {
  guideEnabled = !guideEnabled;
  guideToggle.setAttribute('aria-pressed', String(guideEnabled));
  if (guideEnabled) {
    canvas.focus();
    updateGuidance();
  } else {
    guideInPerfect = false;
    guidance.textContent = '';
  }
});

canvas.addEventListener('keydown', (event) => {
  if (!running || event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  if (!event.repeat) cutFromInput(event);
});

document.addEventListener('keydown', (event) => {
  if (!running || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Escape') {
    if (!event.repeat) setPaused(!paused);
    return;
  }
  if (event.repeat || paused) return;
  if (event.code === 'KeyE') {
    event.preventDefault();
    act(togglePiece);
  } else if (event.code === 'KeyP') {
    event.preventDefault();
    act(takeBreak);
  }
});

// Os botões de ação não roubam o foco do canvas quando clicados com o mouse.
for (const button of [grabButton, breakButton]) {
  button.addEventListener('pointerdown', (event) => event.preventDefault());
}
grabButton.addEventListener('click', () => act(togglePiece));
breakButton.addEventListener('click', () => act(takeBreak));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
audioButton.addEventListener('click', () => {
  const enabled = audioButton.getAttribute('aria-pressed') !== 'true';
  audioButton.setAttribute('aria-pressed', String(enabled));
  if (enabled) unlockAudio();
  else stopHum();
});
byId('pause').addEventListener('click', () => setPaused(!paused));
byId('resume').addEventListener('click', () => setPaused(false));
for (const id of ['start', 'restart', 'replay']) byId(id).addEventListener('click', start);
updateHud();
draw(performance.now());
