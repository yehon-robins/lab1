// Everything above or around the fish: wind gusts, lily pads, petals,
// the day/night cycle and the night-time lights.

// ---------- Wind gust ----------
// A band of wind sweeping across the whole pond in one direction.
class Gust {
  constructor(W, H) {
    const angle = rand(0, TAU);
    this.dx = Math.cos(angle);
    this.dy = Math.sin(angle);
    this.px = -this.dy; // perpendicular
    this.py = this.dx;
    this.cx = W / 2;
    this.cy = H / 2;
    this.halfDiag = Math.hypot(W, H) / 2;
    this.band = 150;
    this.start = -this.halfDiag - this.band * 2;
    this.end = this.halfDiag + this.band * 2;
    this.pos = this.start;
    this.speed = 330;
    this.strength = rand(0.8, 1.2);

    this.streaks = [];
    for (let k = 0; k < 60; k++) {
      this.streaks.push({
        lat: rand(-this.halfDiag, this.halfDiag),
        along: rand(-this.band, this.band),
        len: rand(40, 150),
        alpha: rand(0.06, 0.2),
        width: rand(0.8, 2),
        wobble: rand(0, TAU),
      });
    }
  }

  get done() { return this.pos > this.end; }

  // Fade in as the band enters, fade out as it leaves.
  get envelope() {
    return Math.sin(clamp((this.pos - this.start) / (this.end - this.start), 0, 1) * Math.PI) * this.strength;
  }

  update(dt) { this.pos += this.speed * dt; }

  influence(x, y) {
    const d = (x - this.cx) * this.dx + (y - this.cy) * this.dy - this.pos;
    return Math.exp(-(d * d) / (this.band * this.band * 2)) * this.envelope;
  }

  // Roughen the water under the band ("cat's paws").
  ruffle(water, W, H) {
    const env = this.envelope;
    for (let k = 0; k < 30; k++) {
      const lat = rand(-this.halfDiag, this.halfDiag);
      const along = this.pos + (Math.random() + Math.random() - 1) * this.band;
      const x = this.cx + this.dx * along + this.px * lat;
      const y = this.cy + this.dy * along + this.py * lat;
      if (x > 0 && x < W && y > 0 && y < H) water.disturb(x, y, 6, 0.55 * env);
    }
  }

  draw(ctx, t) {
    const env = this.envelope;
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of this.streaks) {
      const along = this.pos + s.along;
      const x0 = this.cx + this.dx * along + this.px * s.lat;
      const y0 = this.cy + this.dy * along + this.py * s.lat;
      const x1 = x0 + this.dx * s.len;
      const y1 = y0 + this.dy * s.len;
      const bend = Math.sin(t * 3 + s.wobble) * 6;
      ctx.strokeStyle = `rgba(255,255,255,${s.alpha * env})`;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + this.px * bend, (y0 + y1) / 2 + this.py * bend, x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Sum of all active gusts' push at a point.
function windAt(gusts, x, y) {
  let wx = 0;
  let wy = 0;
  for (const g of gusts) {
    const f = g.influence(x, y);
    wx += g.dx * f;
    wy += g.dy * f;
  }
  return { x: wx, y: wy };
}

// Slow ambient surface current that floating things drift with.
function currentAt(t) {
  const a = t * 0.04;
  return { x: Math.cos(a) * 5, y: Math.sin(a * 1.3) * 4 };
}

// ---------- Lily pads ----------
class LilyPad {
  constructor(W, H) {
    this.r = rand(26, 48);
    this.x = rand(this.r, W - this.r);
    this.y = rand(this.r, H - this.r);
    this.vx = 0;
    this.vy = 0;
    this.angle = rand(0, TAU);
    this.spin = 0;
    const g = rand(0, 1);
    this.light = `rgb(${lerp(96, 120, g) | 0},${lerp(160, 178, g) | 0},${lerp(70, 84, g) | 0})`;
    this.dark = `rgb(${lerp(38, 52, g) | 0},${lerp(98, 112, g) | 0},${lerp(42, 50, g) | 0})`;
    this.flower = Math.random() < 0.35 ? { size: this.r * rand(0.45, 0.6), rot: rand(0, TAU) } : null;
  }

  update(dt, t, W, H, gusts, pads) {
    const cur = currentAt(t);
    const wind = windAt(gusts, this.x, this.y);
    this.vx += ((cur.x - this.vx) * 0.3 + wind.x * 90) * dt;
    this.vy += ((cur.y - this.vy) * 0.3 + wind.y * 90) * dt;
    this.spin += ((wind.x * this.dy() - wind.y * this.dx()) * 0.4 - this.spin * 0.5) * dt;

    for (const o of pads) {
      if (o === this) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const dist = Math.hypot(dx, dy);
      const min = this.r + o.r;
      if (dist > 0 && dist < min) {
        const push = (min - dist) * 0.5;
        this.x += (dx / dist) * push;
        this.y += (dy / dist) * push;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;

    if (this.x < this.r) { this.x = this.r; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.x > W - this.r) { this.x = W - this.r; this.vx = -Math.abs(this.vx) * 0.5; }
    if (this.y < this.r) { this.y = this.r; this.vy = Math.abs(this.vy) * 0.5; }
    if (this.y > H - this.r) { this.y = H - this.r; this.vy = -Math.abs(this.vy) * 0.5; }
  }

  dx() { return Math.cos(this.angle); }
  dy() { return Math.sin(this.angle); }

  draw(ctx) {
    const r = this.r;
    const notch = 0.2;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.fillStyle = 'rgba(0, 18, 12, 0.28)';
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.arc(6, 8, r, notch, TAU - notch);
    ctx.closePath();
    ctx.fill();

    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, this.light);
    g.addColorStop(1, this.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, notch, TAU - notch);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 60, 25, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(210, 240, 180, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = notch + 0.25 + (k * (TAU - 2 * notch - 0.5)) / 8;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    }
    ctx.stroke();

    if (this.flower) drawLotus(ctx, -r * 0.15, r * 0.1, this.flower.size, this.flower.rot);
    ctx.restore();
  }
}

function drawLotus(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.arc(3, 4, s * 0.9, 0, TAU);
  ctx.fill();
  const layers = [
    { n: 8, len: 0.95, w: 0.32, color: '#f2a7c0', off: 0 },
    { n: 8, len: 0.72, w: 0.28, color: '#f8c8d8', off: Math.PI / 8 },
    { n: 6, len: 0.48, w: 0.22, color: '#fde6ee', off: 0.2 },
  ];
  for (const l of layers) {
    ctx.fillStyle = l.color;
    for (let k = 0; k < l.n; k++) {
      const a = l.off + (k * TAU) / l.n;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * s * l.len * 0.5, Math.sin(a) * s * l.len * 0.5, s * l.len * 0.5, s * l.w * 0.5, a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#f2cf48';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- Floating petals ----------
class Petal {
  constructor(W, H) {
    this.x = rand(0, W);
    this.y = rand(0, H);
    this.vx = 0;
    this.vy = 0;
    this.rot = rand(0, TAU);
    this.vr = rand(-0.3, 0.3);
    this.size = rand(4, 7);
    this.color = pick(['#f7c5d3', '#f9d7e1', '#f3b3c6', '#fbe4ea']);
  }

  update(dt, t, W, H, gusts) {
    const cur = currentAt(t);
    const wind = windAt(gusts, this.x, this.y);
    this.vx += ((cur.x * 1.3 - this.vx) * 0.6 + wind.x * 220) * dt;
    this.vy += ((cur.y * 1.3 - this.vy) * 0.6 + wind.y * 220) * dt;
    this.vr += (Math.hypot(wind.x, wind.y) * rand(-6, 6) - this.vr * 0.4) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;

    // Wrap so petals blown off one side drift back in from the other.
    const m = 20;
    if (this.x < -m) this.x = W + m;
    if (this.x > W + m) this.x = -m;
    if (this.y < -m) this.y = H + m;
    if (this.y > H + m) this.y = -m;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(2, 3, this.size, this.size * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- Day / night ----------
const DAY_LENGTH = 240; // seconds for one full day, as requested

// t = 0 is 06:00, t = 0.5 is 18:00. Colour is multiplied over the whole scene.
const SKY_KEYS = [
  [0.0, [255, 186, 168]],
  [0.07, [255, 236, 220]],
  [0.15, [255, 255, 252]],
  [0.4, [255, 252, 244]],
  [0.48, [255, 196, 140]],
  [0.53, [235, 140, 120]],
  [0.59, [110, 108, 170]],
  [0.66, [44, 58, 112]],
  [0.9, [44, 58, 112]],
  [0.96, [120, 110, 165]],
  [1.0, [255, 186, 168]],
];

function skyAt(t) {
  for (let k = 1; k < SKY_KEYS.length; k++) {
    const [t1, c1] = SKY_KEYS[k];
    if (t <= t1) {
      const [t0, c0] = SKY_KEYS[k - 1];
      const u = smoothstep(0, 1, (t - t0) / (t1 - t0));
      return [lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u)];
    }
  }
  return SKY_KEYS[0][1];
}

function dayInfo(elapsed) {
  const t = (elapsed % DAY_LENGTH) / DAY_LENGTH;
  const sky = skyAt(t);
  const lum = (sky[0] * 0.3 + sky[1] * 0.59 + sky[2] * 0.11) / 255;
  const minutes = Math.floor((6 * 60 + t * 24 * 60) % (24 * 60));
  const hour = Math.floor(minutes / 60);
  let phase = 'Night';
  if (hour >= 5 && hour < 7) phase = 'Dawn';
  else if (hour >= 7 && hour < 11) phase = 'Morning';
  else if (hour >= 11 && hour < 16) phase = 'Afternoon';
  else if (hour >= 16 && hour < 18) phase = 'Evening';
  else if (hour >= 18 && hour < 20) phase = 'Dusk';
  return {
    t,
    sky,
    daylight: lum,
    night: clamp((0.8 - lum) / 0.5, 0, 1),
    clock: `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    phase,
  };
}

// ---------- Night lights ----------
function makeGlowSprite(size, rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.45)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

class Firefly {
  constructor(W, H) {
    this.x = rand(0, W);
    this.y = rand(0, H);
    this.heading = rand(0, TAU);
    this.speed = rand(12, 26);
    this.blink = rand(0.8, 1.8);
    this.ph = rand(0, TAU);
  }

  update(dt, t, W, H) {
    this.heading += Math.sin(t * 0.8 + this.ph) * 1.5 * dt;
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
    if (this.x < -20) this.x = W + 20;
    if (this.x > W + 20) this.x = -20;
    if (this.y < -20) this.y = H + 20;
    if (this.y > H + 20) this.y = -20;
  }

  glow(t) {
    const s = Math.max(0, Math.sin(t * this.blink + this.ph));
    return s * s;
  }
}

class NightSky {
  constructor(W, H) {
    this.resize(W, H);
    this.fireflySprite = makeGlowSprite(48, '210,255,130');
    this.moonSprite = makeGlowSprite(256, '190,205,255');
  }

  resize(W, H) {
    this.W = W;
    this.H = H;
    this.stars = [];
    for (let k = 0; k < 110; k++) {
      this.stars.push({ x: rand(0, W), y: rand(0, H), s: rand(0.6, 1.8), tw: rand(1, 4), ph: rand(0, TAU) });
    }
    this.fireflies = [];
    for (let k = 0; k < 24; k++) this.fireflies.push(new Firefly(W, H));
  }

  update(dt, t) {
    for (const f of this.fireflies) f.update(dt, t, this.W, this.H);
  }

  // Drawn with additive blending after the scene has been darkened.
  draw(ctx, t, night) {
    if (night <= 0.01) return;
    const { W, H } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Reflected stars, twinkling and wobbling with the water.
    for (const s of this.stars) {
      const a = night * (0.35 + 0.65 * Math.max(0, Math.sin(t * s.tw + s.ph))) * 0.7;
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.fillRect(s.x + Math.sin(t * 1.3 + s.ph) * 1.2, s.y, s.s, s.s);
    }

    // Moon reflection: a glow plus a disk broken into shimmering horizontal slices.
    const mx = W * 0.72;
    const my = H * 0.27;
    const R = 26;
    ctx.globalAlpha = night * 0.35;
    ctx.drawImage(this.moonSprite, mx - 140, my - 140, 280, 280);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(225,232,255,${0.55 * night})`;
    for (let yy = -R; yy < R; yy += 3) {
      const hw = Math.sqrt(R * R - (yy + 1.5) * (yy + 1.5)) * (0.9 + 0.1 * Math.sin(t * 2.3 + yy));
      const xo = Math.sin(t * 1.8 + yy * 0.35) * 3.5;
      ctx.fillRect(mx - hw + xo, my + yy, hw * 2, 2.4);
    }

    // Fireflies hovering over the pond.
    for (const f of this.fireflies) {
      const g = f.glow(t) * night;
      if (g < 0.02) continue;
      ctx.globalAlpha = g;
      ctx.drawImage(this.fireflySprite, f.x - 24, f.y - 24, 48, 48);
    }
    ctx.restore();
  }
}
