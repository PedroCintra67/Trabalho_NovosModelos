import {
  WIDTH, HEIGHT, SHIFT_MS, createShift, advance, beginStroke, moveStroke,
  endStroke, cancelStroke, report, playable,
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
  const path = new Path2D(data);
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

// The belt runs diagonally in perspective, with the playable coordinates left unwarped.
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

const meat = {
  peito: 'M-64 13 C-75 0 -54 -24 -32 -34 C-11 -47 9 -45 30 -32 C53 -31 72 -6 65 11 C56 29 8 34 -35 31 C-50 32 -63 25 -64 13Z',
  asa: 'M-68 15 C-63 5 -47 5 -35 -4 L-3 -31 C17 -46 41 -41 45 -26 C45 -13 28 -8 31 -3 C34 2 54 -8 65 -3 C81 8 68 22 53 24 L1 19 C-12 18 -28 26 -45 26 C-56 34 -75 28 -68 15Z',
  coxa: 'M-66 16 C-77 7 -60 -2 -53 -1 C-35 -4 -33 -11 -26 -23 C-17 -43 15 -47 40 -32 C63 -23 73 -2 61 17 C50 34 26 37 6 29 C-10 22 -32 15 -49 24 C-58 29 -70 25 -66 16Z',
};
const flesh = gradient(context, -18, -40, 12, 39, '#f8d9ca', '#d8a69b', '#a56869', '#6f434b');
const shade = gradient(context, 0, -25, 0, 20, '#ffffff51', '#ffffff00');

function drawPiece(piece, preview) {
  const { x, y, type, a, b, risk } = piece;
  context.save();
  context.translate(x, y);
  ellipse(context, 3, 24, 70, 17, '#142d3b55');
  shape(context, meat[type], flesh, '#5f4248', 2);
  context.save();
  context.clip(new Path2D(meat[type]));
  shape(context, 'M-75 14 Q-32 -47 31 -43 Q54 -29 72 1 Q30 -21 9 -11 Q-9 -8 -19 5 Q-46 11 -75 14Z', shade);
  shape(context, 'M-45 21 Q-19 3 7 16 T55 13 M-34 -13 Q-14 -30 9 -29 M-19 22 Q8 24 25 28', null, '#703e4e55', 1.5);
  for (let i = 0; i < 42; i++) {
    ellipse(context, (i * 31 % 130) - 65, (i * 17 % 72) - 36, 1, .7, i % 2 ? '#f6d7c589' : '#6e43444d');
  }
  context.restore();
  context.restore();

  if (!preview && !playable(x)) {
    context.fillStyle = '#273743';
    context.fillRect(x - 44, y - 53, 88, 17);
    label(context, 'FORA DA ÁREA', x - 39, y - 41, '#c3cdd3', 11);
    return;
  }

  const route = `M${a.x} ${a.y} L${b.x} ${b.y}`;
  shape(context, route, null, '#092831', 6);
  context.setLineDash([7, 5]);
  shape(context, route, null, '#a3ffff', 2.5);
  context.setLineDash([]);
  ellipse(context, a.x, a.y, 3.2, 3.2, '#d4ffff');
  ellipse(context, b.x, b.y, 3.2, 3.2, '#d4ffff');
  if (!risk) return;

  if (risk.kind === 'mao') {
    context.save();
    context.translate(risk.x, risk.y);
    context.scale(risk.r / 18, risk.r / 18);
    shape(context, 'M-8 15 L-14 4 Q-17 -3 -14 -4 Q-12 -6 -8 0 L-10 -10 Q-10 -14 -6 -13 L-2 -4 -4 -16 Q-2 -19 1 -16 L4 -6 4 -16 Q8 -18 9 -14 L10 -3 13 -10 Q17 -11 16 -6 L15 6 9 16Z', '#24383e', '#ffa39a', 1.6);
    context.restore();
  } else {
    shape(context, `M${risk.x - 5} ${risk.y + 3} l10 -6`, null, '#fff0d8', 4);
    ellipse(context, risk.x - 5, risk.y + 3, 3.1, 3.1, '#fff0d8');
    ellipse(context, risk.x + 5, risk.y - 3, 3.1, 3.1, '#fff0d8');
  }

  context.beginPath();
  context.arc(risk.x, risk.y, risk.r, 0, Math.PI * 2);
  context.strokeStyle = '#ff9c91';
  context.lineWidth = 1.8;
  context.stroke();
  const tag = risk.kind === 'mao' ? 'MÃO' : 'OSSO';
  const width = tag.length * 7 + 9;
  const tagY = risk.y + risk.r + 3;
  context.fillStyle = '#321f25';
  context.fillRect(risk.x - width / 2, tagY, width, 16);
  label(context, tag, risk.x - width / 2 + 5, tagY + 12, '#ffc0b6', 12);
  const captionY = Math.min(y - 48, risk.y - risk.r - 4);
  context.fillStyle = '#132a36';
  context.fillRect(x - 31, captionY - 12, 62, 17);
  label(context, type.toUpperCase(), x - type.length * 3.6, captionY, '#edf8fa', 12);
}

const glove = gradient(context, 3, -47, 52, 73, '#91a5a8', '#52676c', '#202e35');
const steel = gradient(context, -103, -170, 25, -33, '#acced9', '#466575', '#e4f3f2');
function drawHands(state) {
  context.save();
  context.translate(253, 466);
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
  context.translate(855, 456);
  const tremor = (state.fatigue + Math.min(state.accidents, 2) * .18) * (reducedMotion.matches ? 0 : 1);
  context.rotate(Math.sin(state.elapsed / 38) * tremor * .033);
  shape(context, 'M160 36 L91 -16 43 -43 13 -44 Q-11 -40 -11 -14 L2 26 62 64 123 94Z', glove, '#192b34', 3);
  shape(context, 'M-2 16 L-19 7 -97 -135 -111 -187 Q-69 -170 -54 -139 L23 -10 31 12 18 29Z', steel, '#203743', 3);
  shape(context, 'M-102 -174 L-80 -138 19 12', null, '#e2f5f5', 2);
  shape(context, 'M-28 -19 L-3 -31 41 34 41 47 26 56 13 47Z', '#243945', '#101c26', 3);
  ellipse(context, 18, 32, 4, 4, '#7d929a');
  shape(context, 'M13 -24 Q26 -32 41 -21 L66 -6 60 11 Q52 20 42 11 L28 2 Q15 6 8 -4 Q4 -16 13 -24Z', glove, '#243943', 2);
  shape(context, 'M50 13 L47 30 M64 16 L61 39 M77 24 L74 48 M91 -15 L77 44 64 63', null, '#2a404b', 3);
  context.restore();
}

const demo = [
  { x: 370, y: 265, type: 'peito', a: { x: 337, y: 284 }, b: { x: 395, y: 245 }, risk: { x: 422, y: 278, r: 15, kind: 'mao' } },
  { x: 567, y: 265, type: 'asa', a: { x: 531, y: 273 }, b: { x: 587, y: 247 }, risk: { x: 612, y: 272, r: 12, kind: 'osso' } },
  { x: 778, y: 265, type: 'coxa', a: { x: 750, y: 250 }, b: { x: 797, y: 278 }, risk: { x: 825, y: 252, r: 15, kind: 'mao' } },
];
const vignette = context.createRadialGradient(500, 255, 160, 500, 255, 570);
vignette.addColorStop(0, '#08152200');
vignette.addColorStop(1, '#061427e6');
let state = createShift();
let running = false;
let frame = 0;
let activePointer = null;
let previousPointer = null;
let keyboardStroke = false;
let keyboardAim = false;
let guideEnabled = false;
let keyboardTarget = null;
let aim = { x: WIDTH / 2, y: HEIGHT / 2 };
let beltOffset = 0;
let lastFrame = 0;
let feedbackUntil = 0;
let presentedEvent = null;
let warned = false;

function draw() {
  context.drawImage(background, 0, 0);
  drawBelt(beltOffset);
  for (const piece of running ? state.pieces : demo) drawPiece(piece, !running);
  drawHands(state);
  context.globalAlpha = .3 + state.fatigue * .54;
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
  if (running && keyboardAim) {
    shape(context, `M${aim.x - 8} ${aim.y} h16 M${aim.x} ${aim.y - 8} v16`, null, '#ffffff', 2);
  }
}


const hud = {
  meter: byId('fatigue'),
  fatigue: byId('fatigue-value'),
  clock: byId('clock'),
  remaining: byId('time-left'),
  processed: byId('processed'),
};
const feedback = byId('feedback');
const audioButton = byId('audio');
let audioContext;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function updateText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function updateHud() {
  const minutes = Math.floor(state.elapsed / SHIFT_MS * 480);
  const two = (value) => String(value).padStart(2, '0');
  updateText(hud.clock, `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`);
  updateText(hud.remaining, `${Math.ceil((SHIFT_MS - state.elapsed) / 1000)} s restantes`);
  updateText(hud.processed, String(state.processed));
  updateText(hud.fatigue, percent(state.fatigue));
  if (hud.meter.value !== state.fatigue) hud.meter.value = state.fatigue;
}

function clearInput() {
  cancelStroke(state);
  presentEvent();
  const pointer = activePointer;
  activePointer = null;
  previousPointer = null;
  keyboardStroke = false;
  keyboardTarget = null;
  if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
}

function unlockAudio() {
  if (audioButton.getAttribute('aria-pressed') !== 'true' || !window.AudioContext) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
  } catch {
    // The simulation stays playable if the browser cannot open an audio device.
  }
}

function playSound(kind) {
  if (audioButton.getAttribute('aria-pressed') !== 'true' || audioContext?.state !== 'running') return;
  const now = audioContext.currentTime;
  if (kind === 'cut') {
    for (const frequency of [910, 1540, 2370]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .84, now + .13);
      gain.gain.setValueAtTime(.054, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + .16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + .17);
    }
    return;
  }
  const duration = kind === 'accident' ? .11 : .065;
  const noise = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
  }
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = noise;
  filter.type = 'lowpass';
  filter.frequency.value = kind === 'accident' ? 740 : 1600;
  gain.gain.value = kind === 'accident' ? .49 : .21;
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(now);
}

function announce(kind, message, now) {
  feedback.dataset.kind = kind;
  feedback.textContent = message;
  feedbackUntil = now + 1650;
}

const messages = {
  cut: 'Corte válido · peça processada',
  error: 'Corte impreciso',
  accident: 'Acidente · lesão na mão de apoio',
};

function presentEvent() {
  const event = state.event;
  if (!event || event === presentedEvent) return;
  presentedEvent = event;
  announce(event.kind, messages[event.kind], performance.now());
  playSound(event.kind);
}

function commit(point, now) {
  endStroke(state, point.x, point.y, now);
  presentEvent();
}

function finish() {
  running = false;
  clearInput();
  canvas.tabIndex = -1;
  const balance = report(state);
  for (const [key, value] of Object.entries(balance)) {
    const formatted = ['gross', 'deductions', 'net'].includes(key)
      ? money.format(value / 100)
      : key === 'fatigue' ? percent(value) : String(value);
    byId(`r-${key}`).textContent = formatted;
  }
  byId('actions').hidden = true;
  byId('guidance').textContent = '';
  byId('results').hidden = false;
  byId('result-title').focus();
}

function tick(timestamp) {
  const elapsed = state.elapsed;
  const speed = state.speed;
  const now = Math.max(timestamp, lastFrame);
  lastFrame = now;
  advance(state, now);
  presentEvent();
  if (!reducedMotion.matches) beltOffset += (state.speed + speed) / 2 * (state.elapsed - elapsed) / 1000;
  if (now >= feedbackUntil && feedback.textContent) feedback.textContent = '';
  if (!warned && !state.finished && state.elapsed >= SHIFT_MS * .7 && now >= feedbackUntil) {
    warned = true;
    announce('pace', 'Ritmo acelerado · atenção ao corte', now);
  }
  updateHud();
  draw();
  if (state.finished) finish();
  else frame = requestAnimationFrame(tick);
}

function start() {
  cancelAnimationFrame(frame);
  clearInput();
  unlockAudio();
  lastFrame = performance.now();
  state = createShift(lastFrame);
  running = true;
  beltOffset = 0;
  warned = false;
  feedbackUntil = 0;
  presentedEvent = null;
  keyboardAim = guideEnabled;
  byId('guidance').textContent = '';
  aim = { x: WIDTH / 2, y: HEIGHT / 2 };
  feedback.textContent = '';
  byId('briefing').hidden = true;
  byId('results').hidden = true;
  byId('actions').hidden = false;
  canvas.tabIndex = 0;
  canvas.focus();
  updateHud();
  draw();
  frame = requestAnimationFrame(tick);
}

function pointerTime(event) {
  return event.timeStamp > 0 && event.timeStamp < 1e12 ? event.timeStamp : performance.now();
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
    // Preserve collisions on the in-bounds portion of a captured pointer's exit.
    const fraction = Math.min(
      point.x < 0 ? -from.x / (point.x - from.x) : point.x > WIDTH ? (WIDTH - from.x) / (point.x - from.x) : 1,
      point.y < 0 ? -from.y / (point.y - from.y) : point.y > HEIGHT ? (HEIGHT - from.y) / (point.y - from.y) : 1,
    );
    const x = Math.max(0, Math.min(WIDTH, from.x + (point.x - from.x) * fraction));
    const y = Math.max(0, Math.min(HEIGHT, from.y + (point.y - from.y) * fraction));
    moveStroke(state, x, y, from.at + (Math.max(now, from.at) - from.at) * fraction);
    clearInput();
    return;
  }

  const at = Math.max(now, previousPointer.at);
  if (ending) {
    commit(point, at);
    clearInput();
    return;
  }
  moveStroke(state, point.x, point.y, at);
  previousPointer = { ...point, at };
  presentEvent();
}

canvas.addEventListener('pointerdown', (event) => {
  if (!running || activePointer !== null || keyboardStroke || event.button !== 0) return;
  const point = worldPoint(event);
  if (!inside(point)) return;
  keyboardAim = false;
  canvas.focus({ preventScroll: true });
  const at = pointerTime(event);
  beginStroke(state, point.x, point.y, at);
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

const guidance = byId('guidance');
const guideToggle = byId('guide-toggle');
const cutNames = { peito: 'Peito', asa: 'Asa', coxa: 'Coxa' };
const arrowKeys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function nearestTarget() {
  let result = null;
  let nearest = Infinity;
  for (const piece of state.pieces) {
    if (!playable(piece.x)) continue;
    for (const end of ['a', 'b']) {
      const point = piece[end];
      const distance = Math.hypot(point.x - aim.x, point.y - aim.y);
      if (distance >= nearest) continue;
      nearest = distance;
      result = { id: piece.id, end };
    }
  }
  return result;
}

function relativePosition(point, origin, reference) {
  const dx = Math.round(point.x - origin.x);
  const dy = Math.round(point.y - origin.y);
  const offsets = [];
  if (dx) offsets.push(`${Math.abs(dx)} unidades ${dx > 0 ? 'à direita' : 'à esquerda'}`);
  if (dy) offsets.push(`${Math.abs(dy)} unidades ${dy > 0 ? 'abaixo' : 'acima'}`);
  return offsets.length ? `${offsets.join(' e ')} ${reference}` : 'no mesmo ponto';
}

function describeAim() {
  const target = keyboardStroke ? keyboardTarget : nearestTarget();
  const piece = state.pieces.find((candidate) => candidate.id === target?.id && playable(candidate.x));
  if (!piece) {
    guidance.textContent = keyboardStroke
      ? 'A peça saiu da área de corte. Pressione Escape para cancelar.'
      : 'Nenhuma peça disponível. Pressione G para consultar novamente.';
    return;
  }

  const point = piece[target.end];
  const risk = piece.risk;
  const end = keyboardStroke ? 'Ponta final' : 'Ponta mais próxima';
  const riskName = risk.kind === 'mao' ? 'Mão de apoio' : 'Osso';
  const insideRisk = Math.hypot(risk.x - aim.x, risk.y - aim.y) <= risk.r;
  const aligned = Math.hypot(point.x - aim.x, point.y - aim.y) <= 9;
  const action = insideRisk ? 'Mira na zona de risco. Afaste-se com as setas.'
    : aligned ? (keyboardStroke ? 'Espaço encerra o traço.' : 'Espaço inicia o traço.')
    : 'Aproxime a mira da ponta com as setas. Pressione G para atualizar.';
  guidance.textContent = `${cutNames[piece.type]}. ${end} ${relativePosition(point, aim, 'da mira')}. ${riskName}, centro ${relativePosition(risk, point, 'da ponta')}, raio de ${risk.r} unidades. ${action}`;
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
  advance(state, performance.now());
  presentEvent();
  describeAim();
});

canvas.addEventListener('keydown', (event) => {
  if (!running) return;
  if (event.key === 'Escape') {
    clearInput();
    if (guideEnabled) guidance.textContent = 'Traço cancelado. Pressione G para localizar uma peça.';
    return;
  }
  if (activePointer !== null) return;
  const direction = arrowKeys[event.key];
  const lookup = guideEnabled && event.code === 'KeyG';
  if (!direction && event.code !== 'Space' && !lookup) return;
  event.preventDefault();
  keyboardAim = true;
  const now = performance.now();
  if (lookup) {
    if (!event.repeat) {
      advance(state, now);
      presentEvent();
      describeAim();
    }
  } else if (direction) {
    const step = event.shiftKey ? 3 : 12;
    aim.x = Math.max(0, Math.min(WIDTH, aim.x + direction[0] * step));
    aim.y = Math.max(0, Math.min(HEIGHT, aim.y + direction[1] * step));
    if (keyboardStroke) moveStroke(state, aim.x, aim.y, now);
  } else if (!event.repeat) {
    if (keyboardStroke) {
      commit(aim, now);
      keyboardStroke = false;
      keyboardTarget = null;
    } else {
      advance(state, now);
      const target = guideEnabled ? nearestTarget() : null;
      beginStroke(state, aim.x, aim.y, now);
      keyboardStroke = Boolean(state.stroke);
      keyboardTarget = target && { id: target.id, end: target.end === 'a' ? 'b' : 'a' };
    }
    if (guideEnabled) describeAim();
  }
});

canvas.addEventListener('blur', clearInput);
window.addEventListener('blur', clearInput);
audioButton.addEventListener('click', () => {
  const enabled = audioButton.getAttribute('aria-pressed') !== 'true';
  audioButton.setAttribute('aria-pressed', String(enabled));
  if (enabled) unlockAudio();
});
for (const id of ['start', 'restart', 'replay']) byId(id).addEventListener('click', start);
updateHud();
draw();
