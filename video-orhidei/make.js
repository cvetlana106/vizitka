// Рекламный ролик магазина «Орхидеи»: 5 секунд, 1280x720, H.264
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

GlobalFonts.registerFromPath('C:/Windows/Fonts/impact.ttf', 'Impact');
GlobalFonts.registerFromPath('C:/Windows/Fonts/ariblk.ttf', 'ArialBlack');
GlobalFonts.registerFromPath('C:/Windows/Fonts/arialbd.ttf', 'ArialBold');

const W = 1280, H = 720, FPS = 25, DUR = 5, N = FPS * DUR;
const SWITCH = 2.4; // момент «взрыва»

// Убираем белый фон: заливка от краёв по светлым пикселям
async function cutout(file) {
  const img = await loadImage(file);
  const c = createCanvas(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, w = c.width, h = c.height;
  const seen = new Uint8Array(w * h), st = [];
  const light = i => p[i * 4 + 3] < 20 || (p[i * 4] > 225 && p[i * 4 + 1] > 225 && p[i * 4 + 2] > 225);
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) {
    const i = st.pop();
    if (seen[i] || !light(i)) continue;
    seen[i] = 1; p[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1);
    if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w);
  }
  g.putImageData(d, 0, 0);
  return c;
}

const ease = t => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const back = t => { t = Math.min(Math.max(t, 0), 1); const s = 2.2; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };

// Частицы взрыва (фиксированный «случайный» набор)
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BURST = Array.from({ length: 26 }, () => 1 + rnd() * 0.3);
const parts =Array.from({ length: 160 }, () => ({
  a: rnd() * Math.PI * 2, v: 300 + rnd() * 900, r: 3 + rnd() * 9,
  col: ['#fff6a0', '#ffd400', '#ff7a00', '#ff2a2a', '#ffffff'][(rnd() * 5) | 0],
}));

// Уютная кухня: рисуется один раз, затем размывается (эффект глубины резкости)
const TABLE = 588;
function buildKitchen() {
  const c = createCanvas(W + 80, H + 60), g = c.getContext('2d');
  g.translate(40, 30);
  // стена с зелёной плиткой
  g.fillStyle = '#2f8a4a'; g.fillRect(-40, -30, W + 80, TABLE + 30);
  for (let y = -30; y < TABLE; y += 46) for (let x = -40 + ((y / 46) % 2 ? 23 : 0); x < W + 40; x += 92) {
    const gr = g.createLinearGradient(x, y, x, y + 44);
    gr.addColorStop(0, '#5cc777'); gr.addColorStop(1, '#2e8a49');
    g.fillStyle = gr; g.fillRect(x + 2, y + 2, 88, 42);
  }
  // окно с тёплым светом
  const wx = 40, wy = 40, ww = 300, wh = 300;
  const sky = g.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, '#fff6c8'); sky.addColorStop(1, '#ffd27a');
  g.fillStyle = '#f4ede0'; g.fillRect(wx - 14, wy - 14, ww + 28, wh + 28);
  g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = '#f4ede0'; g.fillRect(wx + ww / 2 - 6, wy, 12, wh); g.fillRect(wx, wy + wh / 2 - 6, ww, 12);
  // полка с баночками справа
  g.fillStyle = '#8a5a2e'; g.fillRect(820, 300, 420, 16);
  ['#e85a3c', '#f2c14e', '#ffffff', '#c0392b', '#f5e6c8'].forEach((col, i) => {
    g.fillStyle = col; g.beginPath(); g.roundRect(850 + i * 75, 220, 52, 80, 10); g.fill();
    g.fillStyle = '#6b3f1d'; g.fillRect(848 + i * 75, 210, 56, 16);
  });
  // деревянная столешница
  const wood = g.createLinearGradient(0, TABLE, 0, H + 30);
  wood.addColorStop(0, '#c98b4f'); wood.addColorStop(1, '#7a4a22');
  g.fillStyle = wood; g.fillRect(-40, TABLE, W + 80, H - TABLE + 30);
  g.strokeStyle = 'rgba(90,50,20,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-40, TABLE + 14 + i * 16); g.bezierCurveTo(400, TABLE + 4 + i * 17, 800, TABLE + 24 + i * 15, W + 40, TABLE + 10 + i * 16); g.stroke(); }
  g.fillStyle = 'rgba(255,230,180,0.5)'; g.fillRect(-40, TABLE, W + 80, 5);
  // тарелка с булочками и круассанами
  const bun = (x, y, rx, ry, rot) => {
    const b = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 2, x, y, rx);
    b.addColorStop(0, '#f7c875'); b.addColorStop(0.6, '#d98a32'); b.addColorStop(1, '#8f4f16');
    g.save(); g.fillStyle = b; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); g.restore();
  };
  g.fillStyle = '#fbf6ee'; g.beginPath(); g.ellipse(110, TABLE + 40, 140, 30, 0, 0, Math.PI * 2); g.fill();
  bun(60, TABLE + 18, 52, 30, -0.1); bun(150, TABLE + 14, 58, 34, 0.15); bun(105, TABLE - 8, 48, 28, 0);
  for (let i = -3; i <= 3; i++) bun(105 + i * 14, TABLE - 8 - Math.abs(i) * 2, 12, 22 - Math.abs(i) * 2, i * 0.25);
  // чашка чая
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(640, TABLE + 52, 70, 14, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(595, TABLE - 10); g.lineTo(685, TABLE - 10); g.lineTo(675, TABLE + 45); g.lineTo(605, TABLE + 45); g.fill();
  g.lineWidth = 9; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(690, TABLE + 14, 18, -1.4, 1.4); g.stroke();
  g.fillStyle = '#9a4a12'; g.beginPath(); g.ellipse(640, TABLE - 10, 45, 8, 0, 0, Math.PI * 2); g.fill();
  // тёплые блики (боке)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = rnd() * 420, r = 10 + rnd() * 34;
    const b = g.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, 'rgba(255,240,170,0.55)'); b.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = b; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // размытие и затемнение по краям
  const out = createCanvas(c.width, c.height), og = out.getContext('2d');
  og.filter = 'blur(5px)'; og.drawImage(c, 0, 0); og.filter = 'none';
  const v = og.createRadialGradient(c.width * 0.4, c.height * 0.55, 200, c.width * 0.5, c.height * 0.5, 900);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,20,5,0.6)');
  og.fillStyle = v; og.fillRect(0, 0, c.width, c.height);
  return out;
}
let KITCHEN;
function background(g, t) {
  const z = 1 + t * 0.012; // медленный «наезд» камеры
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z);
  g.drawImage(KITCHEN, -W / 2 - 40, -H / 2 - 30);
  g.restore();
  // мягкий свет из окна
  const l = g.createRadialGradient(190, 190, 20, 190, 190, 600);
  l.addColorStop(0, `rgba(255,230,150,${0.25 + Math.sin(t * 2) * 0.05})`); l.addColorStop(1, 'rgba(255,230,150,0)');
  g.fillStyle = l; g.fillRect(0, 0, W, H);
}

// Пар из носика
const steamP = Array.from({ length: 40 }, () => ({ o: rnd(), dx: rnd() - 0.5, s: 0.6 + rnd() * 0.8 }));
function steam(g, x, y, t, dir, alpha, sz = 1) {
  g.save();
  for (const p of steamP) {
    const life = (t * 0.7 * p.s + p.o) % 1;
    const px = x + (dir * life * 40 + Math.sin(life * 6 + p.o * 10) * 22 + p.dx * 30) * sz;
    const py = y - life * 230 * sz;
    const r = (10 + life * 45) * sz;
    const a = alpha * Math.sin(life * Math.PI) * 0.35;
    const gr = g.createRadialGradient(px, py, 0, px, py, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function title(g, t) {
  // «ОРХИДЕИ»: красные буквы с жёлтым градиентом, мерцающий блик
  // зелёная плашка под названием, чтобы оно выделялось на любом фоне
  g.save();
  const pg = g.createLinearGradient(0, 28, 0, 188);
  pg.addColorStop(0, 'rgba(34,176,74,0.72)'); pg.addColorStop(1, 'rgba(6,86,30,0.72)');
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 22; g.shadowOffsetY = 6;
  g.fillStyle = pg; g.beginPath(); g.roundRect(W * 0.36 - 250, 26, 500, 162, 28); g.fill();
  g.shadowColor = 'transparent'; g.lineWidth = 5; g.strokeStyle = '#ffe600'; g.stroke();
  g.restore();
  g.save();
  g.font = '112px Impact'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const x = W * 0.36, y = 122, txt = 'ОРХИДЕЯ';
  const tw = g.measureText(txt).width;
  const gr = g.createLinearGradient(0, y - 46, 0, y + 46);
  gr.addColorStop(0, '#ffe600'); gr.addColorStop(0.35, '#ff3b1f'); gr.addColorStop(0.7, '#d40000'); gr.addColorStop(1, '#ffcc00');
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
  g.lineWidth = 12; g.strokeStyle = '#7a0000'; g.strokeText(txt, x, y);
  g.shadowColor = 'transparent';
  g.lineWidth = 4; g.strokeStyle = '#ffe94d'; g.strokeText(txt, x, y);
  g.fillStyle = gr; g.fillText(txt, x, y);
  // бегущий блик
  const sx = x - tw / 2 - 150 + ((t * 0.9) % 1.6) / 1.6 * (tw + 300);
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(sx - 60, 0, sx + 60, 0);
  sh.addColorStop(0, 'rgba(255,255,200,0)'); sh.addColorStop(0.5, 'rgba(255,255,220,0.85)'); sh.addColorStop(1, 'rgba(255,255,200,0)');
  g.restore();
  // блик рисуем через маску текста
  const m = createCanvas(W, 200), mg = m.getContext('2d');
  mg.font = '112px Impact'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.fillText(txt, x, 100);
  mg.globalCompositeOperation = 'source-in';
  const sh2 = mg.createLinearGradient(sx - 60, 0, sx + 60, 0);
  sh2.addColorStop(0, 'rgba(255,255,200,0)'); sh2.addColorStop(0.5, 'rgba(255,255,230,0.6)'); sh2.addColorStop(1, 'rgba(255,255,200,0)');
  mg.fillStyle = sh2; mg.fillRect(0, 0, W, 200);
  g.drawImage(m, 0, y - 100);
  g.save(); g.font = '26px ArialBold'; g.fillStyle = '#fff7b0'; g.textAlign = 'center';
  g.fillText('магазин', x, 50); g.restore();
}

// spout: положение носика в долях картинки, dir: куда клонится пар
function product(g, img, t0, t, out, spout, dir) {
  const k = back((t - t0) / 0.5);
  const s = Math.min(390 / img.height, 430 / img.width) * k * (out ? 1 + out * 0.6 : 1);
  const a = out ? Math.max(0, 1 - out * 1.5) : 1;
  const cx = W * 0.36, bottom = TABLE + 12, w = img.width * s, h = img.height * s;
  g.save(); g.globalAlpha = a;
  // тень на столе
  const sh = g.createRadialGradient(cx, bottom, 10, cx, bottom, w * 0.6);
  sh.addColorStop(0, 'rgba(40,20,5,0.55)'); sh.addColorStop(1, 'rgba(40,20,5,0)');
  g.save(); g.scale(1, 0.18); g.fillStyle = sh; g.beginPath(); g.arc(cx, bottom / 0.18, w * 0.6, 0, Math.PI * 2); g.fill(); g.restore();
  g.drawImage(img, cx - w / 2, bottom - h, w, h);
  g.restore();
  if (k > 0.9) steam(g, cx - w / 2 + spout[0] * w, bottom - h + spout[1] * h, t, dir, a * Math.min(1, (t - t0) * 2));
}

function price(g, t, t0) {
  const k = back((t - t0 - 0.25) / 0.4);
  if (k <= 0) return;
  g.save(); g.translate(165, 430); g.scale(k * 0.9, k * 0.9); g.rotate(-0.12);
  const pulse = 1 + Math.sin(t * 5) * 0.04; g.scale(pulse, pulse);
  // звезда-ценник
  g.beginPath();
  for (let i = 0; i < 32; i++) { const r = i % 2 ? 92 : 110, a = i * Math.PI / 16; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fillStyle = '#ffd400'; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 16; g.fill();
  g.shadowColor = 'transparent'; g.lineWidth = 6; g.strokeStyle = '#e60000'; g.stroke();
  g.fillStyle = '#c00000'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '64px Impact'; g.fillText('650', 0, -8);
  g.font = '30px ArialBlack'; g.fillText('руб.', 0, 42);
  g.restore();
}

// ===== Сцена 2: девушка и приборы для волос =====
function salonBg(g, t) {
  const gr = g.createRadialGradient(420, 380, 40, 420, 380, 950);
  gr.addColorStop(0, '#ff7ac8'); gr.addColorStop(0.45, '#b0228c'); gr.addColorStop(1, '#3a0a4a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.translate(420, 360); g.rotate(t * 0.3);
  for (let i = 0; i < 16; i++) {
    g.rotate(Math.PI / 8); g.fillStyle = 'rgba(255,220,240,0.08)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(1100, -100); g.lineTo(1100, 100); g.fill();
  }
  g.restore();
  for (const b of BOKEH) {
    const y = (b.y - t * 20 * b.s + H) % H;
    const gg = g.createRadialGradient(b.x, y, 0, b.x, y, b.r);
    gg.addColorStop(0, 'rgba(255,230,160,0.45)'); gg.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = gg; g.beginPath(); g.arc(b.x, y, b.r, 0, Math.PI * 2); g.fill();
  }
}
const BOKEH = Array.from({ length: 30 }, () => ({ x: rnd() * W, y: rnd() * H, r: 8 + rnd() * 30, s: 0.5 + rnd() }));

// фото девушки: обрезаем низ (значок), края плавно растворяются в фоне
function buildModel(img) {
  const ch = 1170, c = createCanvas(img.width, ch), g = c.getContext('2d');
  g.drawImage(img, 0, 0, img.width, ch, 0, 0, img.width, ch);
  // закрашиваем инструменты из примера цветом фона (руки и провода не трогаем)
  const erase = [
    [[360, 250], [[40, 245], [335, 245], [335, 445], [140, 445], [140, 360], [40, 352]]],
    [[235, 480], [[45, 500], [228, 500], [228, 725], [132, 722], [130, 652], [45, 648]]],
    [[520, 240], [[535, 330], [598, 272], [645, 278], [795, 418], [765, 478], [700, 482], [540, 368]]],
    [[660, 470], [[635, 528], [785, 528], [790, 742], [700, 760], [638, 705]]],
  ];
  const src = g.getImageData(0, 0, img.width, ch).data;
  for (const [[sx, sy], poly] of erase) {
    const i = (sy * img.width + sx) * 4;
    const layer = createCanvas(img.width, ch), lg = layer.getContext('2d');
    lg.filter = 'blur(10px)'; lg.fillStyle = `rgb(${src[i]},${src[i + 1]},${src[i + 2]})`;
    lg.beginPath(); poly.forEach(([x, y]) => lg.lineTo(x, y)); lg.closePath(); lg.fill();
    g.drawImage(layer, 0, 0);
  }
  if (process.env.MODEL_PREVIEW) require('fs').writeFileSync('model_preview.png', c.toBuffer('image/png'));
  // мягкий овал вокруг девушки: руки и провода с фото по краям уходят в прозрачность
  g.globalCompositeOperation = 'destination-in';
  g.save(); g.translate(425, 820); g.scale(1, 2.6);
  const m = g.createRadialGradient(0, 0, 120, 0, 0, 245);
  m.addColorStop(0, '#000'); m.addColorStop(0.75, 'rgba(0,0,0,0.85)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(-500, -400, 1000, 800);
  g.restore();
  return c;
}

// прибор: центр, ширина, поворот, зеркало; smoke — точка дыма в долях картинки
function item(g, img, t, t0, o) {
  const k = back((t - t0) / 0.45); if (k <= 0) return;
  const s = o.w / img.width * k;
  const P = ([fx, fy]) => {
    const lx = (fx - 0.5) * img.width * s * (o.flip ? -1 : 1), ly = (fy - 0.5) * img.height * s;
    return [o.x + lx * Math.cos(o.a) - ly * Math.sin(o.a), o.y + lx * Math.sin(o.a) + ly * Math.cos(o.a)];
  };
  // провод: свисает от ручки вниз за край экрана, слегка покачивается
  if (o.cord) {
    const [cx, cy] = P(o.cord), sw = Math.sin(t * 2 + o.x) * 12;
    g.save(); g.strokeStyle = '#111'; g.lineWidth = 4; g.lineCap = 'round';
    g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(cx, cy);
    g.bezierCurveTo(cx + o.cd * 40, cy + 80, cx + o.cd * 10 + sw, cy + 200, cx + o.cd * 30 + sw, H + 20);
    g.stroke(); g.restore();
  }
  g.save(); g.translate(o.x, o.y); g.rotate(o.a); g.scale(o.flip ? -s : s, s);
  g.shadowColor = 'rgba(40,0,30,0.6)'; g.shadowBlur = 25; g.shadowOffsetY = 12;
  g.drawImage(img, -img.width / 2, -img.height / 2);
  g.restore();
  if (o.smoke && k > 0.9) {
    const [px, py] = P(o.smoke);
    steam(g, px, py, t, o.flip ? 1 : -1, Math.min(1, (t - t0 - 0.3) * 2) * 0.8, 0.45);
  }
}

function tag(g, t, t0, x, y, big, small, top) {
  const k = back((t - t0) / 0.4); if (k <= 0) return;
  const on = false; // ценники не моргают: жёлтые с красными цифрами
  g.save(); g.translate(x, y); const p = 0.62 * k; g.scale(p, p); g.rotate(-0.1);
  g.beginPath();
  for (let i = 0; i < 32; i++) { const r = i % 2 ? 92 : 110, a = i * Math.PI / 16; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fillStyle = on ? '#e60000' : '#ffd400'; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 16; g.fill();
  g.shadowColor = 'transparent'; g.lineWidth = 6; g.strokeStyle = on ? '#ffe600' : '#e60000'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (top) { g.font = '30px ArialBlack'; g.fillStyle = on ? '#ffe600' : '#c00000'; g.fillText(top, 0, -52); }
  g.font = '64px Impact'; g.fillStyle = on ? '#fff' : '#c00000'; g.fillText(big, 0, top ? 0 : -8);
  g.font = '30px ArialBlack'; g.fillStyle = on ? '#ffe600' : '#c00000'; g.fillText(small, 0, top ? 48 : 42);
  g.restore();
}

function scene2(g, t, t0, A) {
  salonBg(g, t);
  const k = ease((t - t0) / 0.4), ms = 720 / 1170 * (0.9 + 0.1 * k);
  g.save(); g.globalAlpha = k;
  g.drawImage(A.model, 406 - A.model.width * ms / 2, 720 - A.model.height * ms, A.model.width * ms, A.model.height * ms);
  g.restore();
  // товары вокруг девушки, у каждого свисает провод
  item(g, A.fen, t, t0 + 0.1, { x: 250, y: 300, w: 195, a: 0.15, flip: true, smoke: [0.07, 0.2], cord: [0.77, 0.97], cd: -1 });
  item(g, A.shipcy, t, t0 + 0.2, { x: 590, y: 300, w: 240, a: 0.79, cord: [0.99, 0.75], cd: 1 });
  item(g, A.ploika, t, t0 + 0.3, { x: 625, y: 480, w: 230, a: 1.11, smoke: [0.05, 0.37], cord: [0.96, 0.5], cd: 1 });
  item(g, A.brash, t, t0 + 0.4, { x: 225, y: 480, w: 240, a: 2.23, cord: [0.9, 0.42], cd: -1 });
  tag(g, t, t0 + 0.35, 85, 215, '870', 'руб.', 'ФЕН');
  tag(g, t, t0 + 0.45, 730, 300, '250', 'руб.', 'ОТ');
  tag(g, t, t0 + 0.55, 700, 600, '650', 'руб.');
  tag(g, t, t0 + 0.65, 85, 560, '800', 'руб.', 'ОТ');
}

function sale(g, t) {
  // правый верхний угол: мерцающая «ГРАНДИОЗНАЯ СКИДКА 50%»
  const on = Math.floor(t * 2) % 2 === 0; // смена цвета 2 раза в секунду
  const x = 995, y = 190;
  g.save(); g.translate(x, y); g.rotate(0.04);
  const s = 0.95 * (1 + Math.sin(t * 5) * 0.03); g.scale(s, s);
  // плашка-«взрыв» с рваными лучами
  const burst = (sc) => {
    g.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, j = BURST[i] * (1 + Math.sin(t * 4 + i) * 0.04);
      const r = (i % 2 ? 0.78 : j) * sc;
      g.lineTo(Math.cos(a) * 215 * r, Math.sin(a) * 140 * r);
    }
    g.closePath();
  };
  g.fillStyle = on ? '#ff1a1a' : '#ffe600';
  g.shadowColor = on ? '#ff3300' : '#fff36b'; g.shadowBlur = 30;
  burst(1.12); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = on ? '#ffe600' : '#ff1a1a'; burst(0.98); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = on ? '#d40000' : '#ffffff';
  g.font = '40px Impact'; g.fillText('ГРАНДИОЗНАЯ', 0, -62);
  g.font = '40px Impact'; g.fillText('СКИДКА', 0, -20);
  g.font = '96px Impact'; g.fillStyle = on ? '#b00000' : '#ffe600'; g.fillText('50%', 0, 50);
  g.restore();
}

function info(g) {
  g.save();
  g.fillStyle = 'rgba(0,40,10,0.72)'; g.beginPath(); g.roundRect(800, 420, 360, 220, 18); g.fill();
  g.strokeStyle = '#ffe600'; g.lineWidth = 3; g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'top';
  g.font = '24px ArialBlack'; g.fillStyle = '#ffe600'; g.fillText('г. Туймазы,', 825, 440);
  g.fillText('ул. Пугачёва, 22', 825, 472);
  g.font = '19px ArialBold'; g.fillStyle = '#ffffff';
  g.fillText('Работаем с 10:00 до 19:00', 825, 520);
  g.fillText('без перерыва и выходных', 825, 546);
  g.font = '27px ArialBlack'; g.fillStyle = '#ffffff';
  g.fillText('+7 (987) 489-03-88', 825, 590);
  g.restore();
}

function explosion(g, dt) {
  if (dt < 0 || dt > 0.9) return;
  const cx = W * 0.36, cy = H * 0.55;
  // ударная волна
  g.save();
  g.lineWidth = 30 * (1 - dt / 0.9); g.strokeStyle = `rgba(255,230,80,${1 - dt / 0.9})`;
  g.beginPath(); g.arc(cx, cy, 40 + dt * 1300, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 12 * (1 - dt / 0.9); g.strokeStyle = `rgba(255,255,255,${1 - dt / 0.9})`;
  g.beginPath(); g.arc(cx, cy, 20 + dt * 900, 0, Math.PI * 2); g.stroke();
  // огненный шар
  const fb = g.createRadialGradient(cx, cy, 0, cx, cy, 80 + dt * 500);
  const a = Math.max(0, 1 - dt / 0.5);
  fb.addColorStop(0, `rgba(255,255,255,${a})`); fb.addColorStop(0.3, `rgba(255,220,0,${a})`);
  fb.addColorStop(0.7, `rgba(255,60,0,${a * 0.7})`); fb.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = fb; g.fillRect(0, 0, W, H);
  // частицы
  for (const p of parts) {
    const d = p.v * dt, x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d + 200 * dt * dt;
    g.globalAlpha = Math.max(0, 1 - dt / 0.9); g.fillStyle = p.col;
    g.beginPath(); g.arc(x, y, p.r * (1 - dt / 1.2), 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // белая вспышка на весь экран
  if (dt < 0.15) { g.fillStyle = `rgba(255,255,255,${1 - dt / 0.15})`; g.fillRect(0, 0, W, H); }
}

(async () => {
  const k1 = await cutout('kettle1.jpg');
  const A = { fen: await cutout('fen.jpg'), shipcy: await cutout('shipcy.jpg'), ploika: await cutout('ploika.jpg'),
    brash: await cutout('brash.jpg'), model: buildModel(await loadImage('model.jpg')) };
  KITCHEN = buildKitchen();
  const c = createCanvas(W, H), g = c.getContext('2d');
  const enc = (out, extra) => spawn(ffmpeg, ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', `${FPS}`, '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', ...extra, out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const mov = enc('orhidei_reklama.mov', []), mp4 = enc('orhidei_reklama.mp4', ['-movflags', '+faststart']);
  for (let f = 0; f < N; f++) {
    const t = f / FPS, dt = t - SWITCH;
    g.save();
    if (dt > 0 && dt < 0.4) { const a = 18 * (1 - dt / 0.4); g.translate((rnd() - 0.5) * a, (rnd() - 0.5) * a); }
    if (dt < 0.08) background(g, t); else scene2(g, t, SWITCH + 0.08, A);
    if (t < SWITCH + 0.15) { product(g, k1, 0, t, dt > 0 ? dt / 0.15 : 0, [0.2, 0.2], -1); if (dt < 0) price(g, t, 0); }
    title(g, t); info(g); sale(g, t);
    explosion(g, dt);
    g.restore();
    const buf = Buffer.from(g.getImageData(0, 0, W, H).data.buffer);
    await Promise.all([mov, mp4].map(p => new Promise(r => p.stdin.write(buf) ? r() : p.stdin.once('drain', r))));
    if (f === 30 || f === 62 || f === 100) require('fs').writeFileSync(`kadr_${f}.png`, c.toBuffer('image/png'));
  }
  mov.stdin.end(); mp4.stdin.end();
})();
