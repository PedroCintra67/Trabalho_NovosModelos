import {
  WIDTH, HEIGHT, SHIFT_MS, HOURS, BENCH, TARGET, CUTS,
  createShift, advance, beginStroke, moveStroke, endStroke, cancelStroke,
  togglePiece, takeBreak, breakStatus, report, reflect, playable, grabbable,
  benchStep, benchRisk, tolerance, TUNING,
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
  shape(context, 'M96 426 L364 396 L359 421 L92 457Z', '#241e18', '#b18143');
  context.save();
  context.transform(1, -.128, -.13, 1, 104, 447);
  label(context, 'ATENÇÃO  /  ESTEIRA EM MOVIMENTO', 0, 0, '#ffca70', 12);
  context.restore();
}

const meat = Object.fromEntries(Object.entries({
  peito: 'M-64 13 C-75 0 -54 -24 -32 -34 C-11 -47 9 -45 30 -32 C53 -31 72 -6 65 11 C56 29 8 34 -35 31 C-50 32 -63 25 -64 13Z',
  asa: 'M-68 15 C-63 5 -47 5 -35 -4 L-3 -31 C17 -46 41 -41 45 -26 C45 -13 28 -8 31 -3 C34 2 54 -8 65 -3 C81 8 68 22 53 24 L1 19 C-12 18 -28 26 -45 26 C-56 34 -75 28 -68 15Z',
  coxa: 'M-66 16 C-77 7 -60 -2 -53 -1 C-35 -4 -33 -11 -26 -23 C-17 -43 15 -47 40 -32 C63 -23 73 -2 61 17 C50 34 26 37 6 29 C-10 22 -32 15 -49 24 C-58 29 -70 25 -66 16Z',
}).map(([type, data]) => [type, new Path2D(data)]));
const flesh = gradient(context, -18, -40, 12, 39, '#f8d9ca', '#d8a69b', '#a56869', '#6f434b');
const shade = gradient(context, 0, -25, 0, 20, '#ffffff51', '#ffffff00');
const typeNames = { peito: 'Peito', asa: 'Asa', coxa: 'Coxa' };

// Desenha a carne em coordenadas locais (o contexto já está transladado e escalado).
function drawMeat(type, done) {
  ellipse(context, 3, 24, 70, 17, '#142d3b55');
  shape(context, meat[type], flesh, '#5f4248', 2);
  context.save();
  context.clip(meat[type]);
  shape(context, 'M-75 14 Q-32 -47 31 -43 Q54 -29 72 1 Q30 -21 9 -11 Q-9 -8 -19 5 Q-46 11 -75 14Z', shade);
  shape(context, 'M-45 21 Q-19 3 7 16 T55 13 M-34 -13 Q-14 -30 9 -29 M-19 22 Q8 24 25 28', null, '#703e4e55', 1.5);
  for (let i = 0; i < 42; i++) {
    ellipse(context, (i * 31 % 130) - 65, (i * 17 % 72) - 36, 1, .7, i % 2 ? '#f6d7c589' : '#6e43444d');
  }
  // Cortes já feitos: sulcos escuros com fiapos claros.
  for (let i = 0; i < done; i++) {
    const [[ax, ay], [bx, by]] = CUTS[type].steps[i];
    const route = `M${ax} ${ay} L${bx} ${by}`;
    shape(context, route, null, '#4a1c27', 4.5);
    shape(context, route, null, '#ffd9cc99', 1.2);
    const length = Math.hypot(bx - ax, by - ay);
    for (let f = 1; f < 6; f++) {
      const t = f / 6;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const nx = -(by - ay) / length * 4;
      const ny = (bx - ax) / length * 4;
      shape(context, `M${x - nx} ${y - ny} L${x + nx} ${y + ny}`, null, '#f8d2c4aa', 1);
    }
  }
  context.restore();
}

function drawBeltPiece(piece, highlight) {
  const { x, y, type, returned, step, steps } = piece;
  context.save();
  context.translate(x, y);
  if (returned) {
    context.scale(.85, .85);
    shape(context, new Path2D('M-80 -38 Q-82 -48 -70 -48 H70 Q82 -48 80 -38 L76 38 Q75 46 66 46 H-66 Q-75 46 -76 38 Z'),
      step >= steps ? '#dfe8eacc' : '#9aa8acaa', '#7d97a0', 2);
  }
  if (highlight) {
    context.save();
    context.shadowColor = '#ffcb73';
    context.shadowBlur = 14;
    shape(context, meat[type], null, '#ffcb73', 4);
    context.restore();
  }
  drawMeat(type, returned ? step : 0);
  context.restore();

  if (returned) {
    const complete = step >= steps;
    tag(complete ? 'PRONTA' : 'INCOMPLETA', x, y - 44, complete ? '#173328' : '#3a2a12', complete ? '#9ff0c4' : '#ffcb73', 11);
  } else if (highlight) {
    tag(`E · PEGAR ${type.toUpperCase()}`, x, y - 46, '#3a2a12', '#ffcb73', 12);
  } else if (x > WIDTH - 65) {
    tag('FORA DO ALCANCE', x, y - 46, '#273743', '#c3cdd3', 11);
  } else if (playable(x)) {
    tag(type.toUpperCase(), x, y - 46, '#132a36', '#edf8fa', 11);
  }
}

function drawRisk(risk) {
  if (risk.kind === 'mao') {
    context.save();
    context.translate(risk.x, risk.y + 2);
    context.scale(risk.r / 17, risk.r / 17);
    shape(context, 'M-8 15 L-14 4 Q-17 -3 -14 -4 Q-12 -6 -8 0 L-10 -10 Q-10 -14 -6 -13 L-2 -4 -4 -16 Q-2 -19 1 -16 L4 -6 4 -16 Q8 -18 9 -14 L10 -3 13 -10 Q17 -11 16 -6 L15 6 9 16Z', '#24383e', '#ffa39a', 1.6);
    context.restore();
  } else {
    shape(context, `M${risk.x - 7} ${risk.y + 4} l14 -8`, null, '#fff0d8', 5);
    ellipse(context, risk.x - 7, risk.y + 4, 4, 4, '#fff0d8');
    ellipse(context, risk.x + 7, risk.y - 4, 4, 4, '#fff0d8');
  }
  context.beginPath();
  context.arc(risk.x, risk.y, risk.r, 0, Math.PI * 2);
  context.fillStyle = '#ff6b5e1c';
  context.fill();
  context.strokeStyle = '#ff9c91';
  context.lineWidth = 2;
  context.stroke();
  tag(risk.kind === 'mao' ? 'MÃO' : 'OSSO', risk.x + risk.r + 28, risk.y + 5, '#321f25', '#ffc0b6', 12);
}

const board = new Path2D(`M${BENCH.x - 160} ${BENCH.y - 78} H${BENCH.x + 160} Q${BENCH.x + 172} ${BENCH.y - 78} ${BENCH.x + 172} ${BENCH.y - 66}
  V${BENCH.y + 90} H${BENCH.x - 172} V${BENCH.y - 66} Q${BENCH.x - 172} ${BENCH.y - 78} ${BENCH.x - 160} ${BENCH.y - 78}Z`);

function drawBench(now) {
  shape(context, `M${BENCH.x - 178} ${BENCH.y - 70} H${BENCH.x + 178} V${BENCH.y + 98} H${BENCH.x - 178}Z`, '#0a161e88');
  shape(context, board, gradient(context, 0, BENCH.y - 78, 0, BENCH.y + 90, '#eef5f5', '#cbdadd', '#a9bec3'), '#5e7a84', 3);
  shape(context, `M${BENCH.x - 160} ${BENCH.y - 70} H${BENCH.x + 160}`, null, '#ffffffaa', 2);
  for (let i = 0; i < 14; i++) {
    const x = BENCH.x - 150 + i * 23;
    shape(context, `M${x} ${BENCH.y - 50 + (i * 37) % 90} l${12 + i % 3 * 6} ${-3 + i % 4}`, null, '#8fa3a955', 1);
  }

  const piece = state.bench;
  if (!piece) {
    label(context, 'BANCADA VAZIA', BENCH.x - 56, BENCH.y - 4, '#5e7a84', 15);
    if (running && grabbable(state) && state.breakUntil === null) {
      label(context, 'E · pegar peça', BENCH.x - 56, BENCH.y + 18, '#a0712a', 14);
    }
    return;
  }

  context.save();
  context.translate(BENCH.x, BENCH.y);
  context.scale(BENCH.scale, BENCH.scale);
  drawMeat(piece.type, piece.step);
  context.restore();

  const cut = CUTS[piece.type];
  const complete = piece.step >= piece.steps;
  for (let i = piece.step + 1; i < piece.steps; i++) {
    const { a, b } = benchStep(piece, i);
    context.setLineDash([4, 6]);
    shape(context, `M${a.x} ${a.y} L${b.x} ${b.y}`, null, '#e9ffff55', 1.5);
    context.setLineDash([]);
  }
  if (!complete) {
    const { a, b } = benchStep(piece);
    const route = `M${a.x} ${a.y} L${b.x} ${b.y}`;
    const margin = tolerance(state);
    context.lineCap = 'round';
    shape(context, route, null, '#8de5ed24', margin * 2);
    shape(context, route, null, '#8de5ed2e', margin * 2 * TUNING.cleanDeviation);
    context.lineCap = 'butt';
    shape(context, route, null, '#092831', 6);
    context.setLineDash([8, 5]);
    shape(context, route, null, '#a3ffff', 3);
    context.setLineDash([]);
    ellipse(context, a.x, a.y, 4.5, 4.5, '#d4ffff');
    ellipse(context, b.x, b.y, 4.5, 4.5, '#d4ffff');
    label(context, String(piece.step + 1), a.x - 18, a.y - 6, '#0b3a44', 14);
  }
  drawRisk(benchRisk(piece.type));

  const title = complete
    ? `${typeNames[piece.type].toUpperCase()} PRONTO · E PARA DEVOLVER`
    : `${typeNames[piece.type].toUpperCase()} · ETAPA ${piece.step + 1}/${piece.steps} · ${cut.names[piece.step].toUpperCase()}`;
  const pulse = complete && !reducedMotion.matches ? .6 + .4 * Math.sin(now / 160) : 1;
  context.globalAlpha = pulse;
  tag(title, BENCH.x, BENCH.y - 86, complete ? '#3a2a12' : '#0b2630', complete ? '#ffcb73' : '#a3ffff', 13);
  context.globalAlpha = 1;

  if (state.elapsed < state.injuredUntil) {
    shape(context, board, '#6b0f1a55');
    const seconds = ((state.injuredUntil - state.elapsed) / 1000).toFixed(1).replace('.', ',');
    tag(`CURATIVO · ${seconds} s`, BENCH.x, BENCH.y + 6, '#321f25', '#ffc0b6', 15);
  }
}

const glove = gradient(context, 3, -47, 52, 73, '#91a5a8', '#52676c', '#202e35');
const steel = gradient(context, -103, -170, 25, -33, '#acced9', '#466575', '#e4f3f2');
function drawHands() {
  context.save();
  context.translate(215, 476);
  shape(context, 'M-59 82 L-36 24 -25 -5 -36 -31 Q-41 -43 -32 -45 Q-26 -48 -17 -35 L-9 -25 -15 -59 Q-17 -69 -8 -70 Q0 -70 3 -61 L11 -31 8 -73 Q7 -82 17 -82 Q25 -81 26 -71 L31 -39 31 -72 Q32 -82 41 -79 Q47 -77 48 -66 L49 -36 53 -59 Q55 -69 62 -66 Q69 -65 68 -52 L64 -13 Q61 10 44 28 L30 78Z',
    glove, '#182b34', 3);
  shape(context, 'M-36 24 Q5 19 44 28 L35 56 Q-1 48 -47 53Z', '#192e3c', '#6c8995', 2);
  shape(context, 'M-17 -27 L-6 -10 Q13 -20 43 -17 M5 -1 Q22 -8 42 -5 M-3 10 L24 4', null, '#263e48', 2);
  if (state.accidents) {
    shape(context, 'M-2 -20 L9 -15 16 -22 26 -16 38 -21 35 -9 20 -6 11 -10 2 -5Z', '#751e2e', '#ff8d81', 2);
    ellipse(context, 23, 2, 2, 4, '#b3474a');
    ellipse(context, 30, 8, 2, 2, '#9d3b48');
  }
  context.restore();

  context.save();
  context.translate(915, 492);
  context.scale(.8, .8);
  const tremorLevel = (state.fatigue + Math.min(state.accidents, 2) * .18) * (reducedMotion.matches ? 0 : 1);
  context.rotate(Math.sin(state.elapsed / 38) * tremorLevel * .04);
  shape(context, 'M160 36 L91 -16 43 -43 13 -44 Q-11 -40 -11 -14 L2 26 62 64 123 94Z', glove, '#192b34', 3);
  shape(context, 'M-2 16 L-19 7 -97 -135 -111 -187 Q-69 -170 -54 -139 L23 -10 31 12 18 29Z', steel, '#203743', 3);
  shape(context, 'M-102 -174 L-80 -138 19 12', null, '#e2f5f5', 2);
  shape(context, 'M-28 -19 L-3 -31 41 34 41 47 26 56 13 47Z', '#243945', '#101c26', 3);
  ellipse(context, 18, 32, 4, 4, '#7d929a');
  shape(context, 'M13 -24 Q26 -32 41 -21 L66 -6 60 11 Q52 20 42 11 L28 2 Q15 6 8 -4 Q4 -16 13 -24Z', glove, '#243943', 2);
  shape(context, 'M50 13 L47 30 M64 16 L61 39 M77 24 L74 48 M91 -15 L77 44 64 63', null, '#2a404b', 3);
  context.restore();
}

// Partículas: fiapos de carne nos cortes, gotas no acidente.
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
  { id: -1, x: 230, y: 265, type: 'peito', returned: false, step: 0, steps: 3 },
  { id: -2, x: 470, y: 265, type: 'asa', returned: true, step: 2, steps: 2 },
  { id: -3, x: 760, y: 265, type: 'coxa', returned: false, step: 0, steps: 3 },
];
const vignette = context.createRadialGradient(500, 255, 160, 500, 255, 570);
vignette.addColorStop(0, '#08152200');
vignette.addColorStop(1, '#061427e6');
let state = createShift();
let running = false;
let paused = false;
let pausedAt = 0;
let pauseOffset = 0;
let frame = 0;
let activePointer = null;
let previousPointer = null;
let keyboardStroke = false;
let keyboardAim = false;
let guideEnabled = false;
let aim = { x: BENCH.x, y: BENCH.y };
let beltOffset = 0;
let slatDistance = 0;
let lastFrame = 0;
let lastDraw = 0;
let feedbackUntil = 0;
let feedbackPriority = 0;
let seenEvents = 0;
let flash = 0;
let shake = 0;

const gameTime = (timestamp) => timestamp - pauseOffset;

function drawCoach() {
  if (!running || state.hour > 0 || state.processed >= 2) return;
  let text = '';
  if (state.breakUntil !== null) text = '';
  else if (!state.bench) text = grabbable(state) ? 'Treino · E (ou o botão Pegar) traz a peça destacada' : '';
  else if (state.bench.step < state.bench.steps) text = 'Treino · arraste de ponta a ponta, longe do vermelho';
  else text = 'Treino · peça pronta! E devolve à esteira';
  if (!text) return;
  tag(text, WIDTH / 2, 160, '#0b141def', '#ffcb73', 18);
}

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
  drawBelt(beltOffset);
  const target = running ? grabbable(state) : demo[2];
  const pieces = running ? state.pieces : demo;
  for (const piece of pieces) drawBeltPiece(piece, piece === target && !state.bench && state.breakUntil === null);
  drawBench(now);
  drawHands();
  drawParticles(dt);
  context.globalAlpha = .3 + state.fatigue * .6;
  context.fillStyle = vignette;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalAlpha = 1;
  const points = state.stroke?.points;
  if (points?.length > 1) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.strokeStyle = '#caffff';
    context.lineWidth = 2.5;
    context.stroke();
  }
  drawCoach();
  drawBreak();
  if (flash > 0) {
    context.fillStyle = `rgba(200, 20, 30, ${flash * .35})`;
    context.fillRect(-20, -20, WIDTH + 40, HEIGHT + 40);
  }
  if (running && keyboardAim) {
    shape(context, `M${aim.x - 9} ${aim.y} h18 M${aim.x} ${aim.y - 9} v18`, null, '#ffffff', 2);
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
};
const grabButton = byId('grab');
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
  breakButton.disabled = !playing || !status.ready;
  grabButton.disabled = !playing || state.breakUntil !== null || (!state.bench && !grabbable(state));
  const mode = state.bench ? 'release' : 'grab';
  if (grabButton.dataset.mode !== mode) {
    grabButton.dataset.mode = mode;
    grabButton.innerHTML = `${mode === 'release' ? 'Devolver peça' : 'Pegar peça'} <kbd>E</kbd>`;
  }
}

function clearInput() {
  cancelStroke(state);
  const pointer = activePointer;
  activePointer = null;
  previousPointer = null;
  keyboardStroke = false;
  if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
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
  clean: () => tone([1040, 1760, 2600], .16, { volume: .05, slide: .84 }),
  cut: () => tone([910, 1540], .14, { volume: .045, slide: .84 }),
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
  complete: 'Peça pronta · pressione E para devolver',
  busy: 'Devolva a peça à esteira antes da pausa',
  cooldown: 'Pausa indisponível por enquanto',
};

function presentEvent(event, now) {
  const piece = state.bench;
  switch (event.kind) {
    case 'clean':
    case 'cut': {
      const quality = event.kind === 'clean' ? 'Corte limpo' : 'Corte aceitável';
      const streak = event.streak >= 3 ? ` · sequência ${event.streak} (+bônus)` : '';
      const tail = event.complete ? ' · peça pronta, E para devolver' : ` · etapa ${event.step + 1}/${event.steps}`;
      announce('good', `${quality}${tail}${streak}`, now);
      if (piece) {
        const { a, b } = benchStep(piece, event.step);
        spawnParticles(a, b, event.kind === 'clean' ? 26 : 16, ['#f8d2c4', '#e6a99c', '#fff0e8'], 90);
      }
      sounds[event.kind]();
      break;
    }
    case 'error':
      announce('warn', 'Corte impreciso · siga a linha de ponta a ponta', now);
      sounds.error();
      break;
    case 'accident': {
      const text = event.risk === 'mao'
        ? 'Acidente · a faca atingiu a mão de apoio'
        : 'Acidente · a faca bateu no osso e escapou';
      announce('danger', text, now, 3);
      if (piece) {
        const risk = benchRisk(piece.type);
        spawnParticles(risk, risk, 30, ['#c2273b', '#8d1726', '#ff5a5a'], 120);
      }
      flash = 1;
      shake = 1;
      sounds.accident();
      break;
    }
    case 'grab':
      announce('good', `${typeNames[event.type]} na bancada · ${CUTS[event.type].steps.length} cortes`, now);
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
      announce('warn', `Peça devolvida incompleta (${event.step}/${event.steps}) · desconto`, now, 2);
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
        ? `Supervisor: ritmo abaixo da meta (${event.processed} de ${event.expected}) · esteira acelerou`
        : `Hora ${event.hour + 1} · meta até agora ${event.expected} · esteira acelerou`, now, 2);
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
  if (!state.stroke && (activePointer !== null || keyboardStroke)) clearInput();
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
  clearInput();
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
  const elapsed = state.elapsed;
  const speed = state.speed;
  const now = Math.max(gameTime(timestamp), lastFrame);
  lastFrame = now;
  advance(state, now);
  presentEvents();
  const moved = (state.speed + speed) / 2 * (state.elapsed - elapsed) / 1000;
  if (!reducedMotion.matches) beltOffset += moved;
  slatDistance += moved;
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

function start() {
  cancelAnimationFrame(frame);
  clearInput();
  unlockAudio();
  paused = false;
  pauseOffset = 0;
  byId('paused').hidden = true;
  lastFrame = performance.now();
  state = createShift(lastFrame);
  running = true;
  beltOffset = 0;
  slatDistance = 0;
  feedbackUntil = 0;
  feedbackPriority = 0;
  seenEvents = 0;
  particles = [];
  flash = 0;
  shake = 0;
  keyboardAim = guideEnabled;
  byId('guidance').textContent = '';
  aim = { x: BENCH.x, y: BENCH.y };
  feedback.textContent = '';
  byId('briefing').hidden = true;
  byId('results').hidden = true;
  byId('actions').hidden = false;
  byId('pause').textContent = 'Pausar jogo';
  canvas.tabIndex = 0;
  canvas.focus();
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
    clearInput();
    pausedAt = now;
    cancelAnimationFrame(frame);
    stopHum();
    feedback.textContent = '';
    updateHud();
    byId('resume').focus();
  } else {
    pauseOffset += now - pausedAt;
    lastDraw = now;
    canvas.focus();
    frame = requestAnimationFrame(tick);
  }
}

function act(action) {
  if (!running || paused) return;
  unlockAudio();
  const now = gameTime(performance.now());
  clearInput();
  action(state, now);
  presentEvents();
  updateHud();
  if (guideEnabled) describeAim();
}

function pointerTime(event) {
  const time = event.timeStamp > 0 && event.timeStamp < 1e12 ? event.timeStamp : performance.now();
  return gameTime(time);
}

function worldPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height,
  };
}

function inside({ x, y }) {
  return x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;
}

function samplePointer(event, ending = false) {
  const point = worldPoint(event);
  const now = pointerTime(event);
  if (!inside(point)) {
    const from = previousPointer;
    // Mantém colisões na parte do traço ainda dentro da área antes de sair.
    const fraction = Math.min(
      point.x < 0 ? -from.x / (point.x - from.x) : point.x > WIDTH ? (WIDTH - from.x) / (point.x - from.x) : 1,
      point.y < 0 ? -from.y / (point.y - from.y) : point.y > HEIGHT ? (HEIGHT - from.y) / (point.y - from.y) : 1,
    );
    const x = Math.max(0, Math.min(WIDTH, from.x + (point.x - from.x) * fraction));
    const y = Math.max(0, Math.min(HEIGHT, from.y + (point.y - from.y) * fraction));
    moveStroke(state, x, y, from.at + (Math.max(now, from.at) - from.at) * fraction);
    clearInput();
    presentEvents();
    return;
  }

  const at = Math.max(now, previousPointer.at);
  if (ending) {
    endStroke(state, point.x, point.y, at);
    clearInput();
    presentEvents();
    return;
  }
  moveStroke(state, point.x, point.y, at);
  previousPointer = { ...point, at };
  presentEvents();
}

canvas.addEventListener('pointerdown', (event) => {
  if (!running || paused || activePointer !== null || keyboardStroke || event.button !== 0) return;
  const point = worldPoint(event);
  if (!inside(point)) return;
  unlockAudio();
  keyboardAim = false;
  canvas.focus({ preventScroll: true });
  const at = pointerTime(event);
  beginStroke(state, point.x, point.y, at);
  presentEvents();
  if (!state.stroke) return;
  previousPointer = { ...point, at };
  activePointer = event.pointerId;
  canvas.setPointerCapture(activePointer);
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== activePointer) return;
  const samples = event.getCoalescedEvents?.();
  for (const sample of samples?.length ? samples : [event]) {
    samplePointer(sample);
    if (activePointer === null) break;
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (event.pointerId === activePointer) samplePointer(event, true);
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (event) => {
    if (event.pointerId === activePointer) clearInput();
  });
}

canvas.addEventListener('contextmenu', (event) => {
  if (!running) return;
  event.preventDefault();
  act(togglePiece);
});

const guidance = byId('guidance');
const guideToggle = byId('guide-toggle');
const arrowKeys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function nearestEnd() {
  const line = state.bench && benchStep(state.bench);
  if (!line) return null;
  return Math.hypot(line.a.x - aim.x, line.a.y - aim.y) <= Math.hypot(line.b.x - aim.x, line.b.y - aim.y) ? 'a' : 'b';
}

function relativePosition(point, origin, reference) {
  const dx = Math.round(point.x - origin.x);
  const dy = Math.round(point.y - origin.y);
  const offsets = [];
  if (dx) offsets.push(`${Math.abs(dx)} unidades ${dx > 0 ? 'à direita' : 'à esquerda'}`);
  if (dy) offsets.push(`${Math.abs(dy)} unidades ${dy > 0 ? 'abaixo' : 'acima'}`);
  return offsets.length ? `${offsets.join(' e ')} ${reference}` : 'no mesmo ponto';
}

let keyboardEnd = null;
function describeAim() {
  if (state.breakUntil !== null) {
    guidance.textContent = 'Em pausa NR-36. A esteira continua andando.';
    return;
  }
  const piece = state.bench;
  if (!piece) {
    const next = grabbable(state);
    guidance.textContent = next
      ? `Bancada vazia. ${typeNames[next.type]} ao alcance, a ${Math.round(WIDTH - 65 - next.x)} unidades do fim da área. Pressione E para pegar.`
      : 'Bancada vazia e nenhuma peça ao alcance. Aguarde a próxima e pressione G.';
    return;
  }
  if (piece.step >= piece.steps) {
    guidance.textContent = `${typeNames[piece.type]} pronto. Pressione E para devolver à esteira.`;
    return;
  }
  const line = benchStep(piece);
  const endKey = keyboardStroke ? keyboardEnd : nearestEnd();
  const point = line[endKey];
  const risk = benchRisk(piece.type);
  const riskName = risk.kind === 'mao' ? 'Mão de apoio' : 'Osso';
  const insideRisk = Math.hypot(risk.x - aim.x, risk.y - aim.y) <= risk.r;
  const aligned = Math.hypot(point.x - aim.x, point.y - aim.y) <= 12;
  const action = insideRisk ? 'Mira na zona de risco. Afaste-se com as setas.'
    : aligned ? (keyboardStroke ? 'Espaço encerra o traço.' : 'Espaço inicia o traço.')
    : 'Aproxime a mira da ponta com as setas. Pressione G para atualizar.';
  const end = keyboardStroke ? 'Ponta final' : 'Ponta mais próxima';
  guidance.textContent = `${typeNames[piece.type]}, etapa ${piece.step + 1} de ${piece.steps}: ${CUTS[piece.type].names[piece.step]}. `
    + `${end} ${relativePosition(point, aim, 'da mira')}. ${riskName}, centro ${relativePosition(risk, point, 'da ponta')}, `
    + `raio de ${Math.round(risk.r)} unidades. Margem aceita de ${Math.round(tolerance(state))} unidades. ${action}`;
}

guideToggle.addEventListener('click', () => {
  guideEnabled = !guideEnabled;
  guideToggle.setAttribute('aria-pressed', String(guideEnabled));
  if (!guideEnabled) {
    guidance.textContent = '';
    return;
  }
  keyboardAim = true;
  canvas.focus();
  if (running && !paused) advance(state, gameTime(performance.now()));
  presentEvents();
  describeAim();
});

canvas.addEventListener('keydown', (event) => {
  if (!running || paused || activePointer !== null) return;
  const direction = arrowKeys[event.key];
  const lookup = guideEnabled && event.code === 'KeyG';
  if (!direction && event.code !== 'Space' && !lookup) return;
  event.preventDefault();
  keyboardAim = true;
  const now = gameTime(performance.now());
  if (lookup) {
    if (!event.repeat) {
      advance(state, now);
      presentEvents();
      describeAim();
    }
  } else if (direction) {
    const step = event.shiftKey ? 3 : 12;
    aim.x = Math.max(0, Math.min(WIDTH, aim.x + direction[0] * step));
    aim.y = Math.max(0, Math.min(HEIGHT, aim.y + direction[1] * step));
    if (keyboardStroke) {
      moveStroke(state, aim.x, aim.y, now);
      presentEvents();
    }
  } else if (!event.repeat) {
    if (keyboardStroke) {
      endStroke(state, aim.x, aim.y, now);
      keyboardStroke = false;
      presentEvents();
    } else {
      advance(state, now);
      const end = nearestEnd();
      beginStroke(state, aim.x, aim.y, now);
      keyboardStroke = Boolean(state.stroke);
      keyboardEnd = end === 'a' ? 'b' : 'a';
      presentEvents();
    }
    if (guideEnabled) describeAim();
  }
});

document.addEventListener('keydown', (event) => {
  if (!running || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Escape') {
    if (state.stroke) {
      clearInput();
      if (guideEnabled) guidance.textContent = 'Traço cancelado.';
    } else {
      setPaused(!paused);
    }
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

canvas.addEventListener('blur', () => {
  if (activePointer === null) clearInput();
});
window.addEventListener('blur', clearInput);
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
