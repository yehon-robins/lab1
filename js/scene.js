// Everything floating on or drifting over the pond: wind, lily pads, petals,
// the day/night cycle with its sun shadows, and the night-time lights.

// ---------- Wind ----------
// One continuous breeze that lives on its own: its heading slowly wanders and its
// strength rises and falls in gusts and lulls. Things on the pond ask the field for
// the push at their spot (a cheap formula, no particle search). A small, capped pool
// of particles traces the field and leaves fading trails, so the wind reads as wavy
// lines that bend and drift.
const MAX_WIND_LINES = 26;

class Wind {
  constructor(W, H) {
    this.resize(W, H);
    this.t = 0;
    this.base = rand(0, TAU);
    this.seedA = rand(0, 100);
    this.seedB = rand(0, 100);
    this.seedC = rand(0, 100);
    this.spawnAcc = 0;
    this.particles = [];
  }

  resize(W, H) {
    this.W = W;
    this.H = H;
    this.particles = [];
  }

  // Overall heading: drifts slowly through the day.
  get angle() {
    const t = this.t;
    return this.base + Math.sin(t * 0.031 + this.seedA) * 0.9 + Math.sin(t * 0.077 + this.seedB) * 0.5;
  }

  // Overall strength in [0.08, 1]: long swells with quicker gusts on top.
  get strength() {
    const t = this.t;
    return clamp(0.4 + Math.sin(t * 0.11 + this.seedC) * 0.3 + Math.sin(t * 0.29 + this.seedA) * 0.22, 0.08, 1);
  }

  flowAngle(x, y) {
    const t = this.t;
    return this.angle
      + Math.sin(x * 0.005 + t * 0.9 + this.seedA) * 0.6
      + Math.sin(y * 0.0045 - t * 0.7 + this.seedB) * 0.5;
  }

  spawn() {
    const m = 60;
    this.particles.push({
      x: rand(-m, this.W + m),
      y: rand(-m, this.H + m),
      vx: 0,
      vy: 0,
      age: 0,
      life: rand(4, 6.5),
      sp: rand(0.8, 1.2),
      ph: rand(0, TAU),
      wf: rand(1.8, 3.2),
      bright: rand(0.6, 1),
      width: rand(0.7, 1.4),
      trail: [],
    });
  }

  fade(p) { return Math.min(1, p.age / 1) * Math.min(1, (p.life - p.age) / 1.5); }

  update(dt, t) {
    this.t = t;
    const s = this.strength;
    // More (and faster) lines when it blows harder, none at all in a lull.
    if (this.particles.length < MAX_WIND_LINES * s) {
      this.spawnAcc += 9 * s * s * dt;
      while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawn(); }
    }
    const speed = 200 * (0.5 + 0.5 * s);
    for (const p of this.particles) {
      const a = this.flowAngle(p.x, p.y) + Math.sin(p.age * p.wf + p.ph) * 0.3;
      p.vx = Math.cos(a) * speed * p.sp;
      p.vy = Math.sin(a) * speed * p.sp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      p.trail.push(p.x, p.y);
      if (p.trail.length > 80) p.trail.splice(0, 2);
    }
    const m = 200;
    this.particles = this.particles.filter(
      (p) => p.age < p.life && p.x > -m && p.y > -m && p.x < this.W + m && p.y < this.H + m
    );
  }

  // Push felt at a point: the local flow heading, with gust patches rolling downwind.
  forceAt(x, y) {
    const a = this.flowAngle(x, y);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const along = x * Math.cos(this.angle) + y * Math.sin(this.angle);
    const patch = 0.65 + 0.35 * Math.sin(along * 0.006 - this.t * 1.3 + this.seedC);
    const mag = this.strength * 0.4 * patch;
    return { x: dx * mag, y: dy * mag };
  }

  // Roughen the water along the wind lines ("cat's paws").
  ruffle(water) {
    const n = this.particles.length;
    if (!n) return;
    const s = this.strength;
    for (let k = 0; k < 8; k++) {
      const p = this.particles[Math.floor(Math.random() * n)];
      const i = Math.floor(Math.random() * (p.trail.length / 2)) * 2;
      if (i + 1 >= p.trail.length) continue;
      water.disturb(p.trail[i], p.trail[i + 1], 5, 0.35 * s * this.fade(p));
    }
  }

  // Each wind line is a soft white brush stroke: a filled ribbon that swells in the
  // middle and tapers to nothing at both ends, fading along its length. Three ribbons
  // stacked (wide and faint, medium, narrow core) give it soft edges.
  draw(ctx) {
    const passes = [[24, 0.07], [13, 0.1], [5, 0.16]];
    const s = this.strength;
    ctx.save();
    for (const p of this.particles) {
      const tr = p.trail;
      const n = tr.length / 2;
      if (n < 8) continue;
      const f = this.fade(p) * Math.min(1, s + 0.35) * p.bright;
      if (f < 0.02) continue;

      // Spine points with normals, every other trail point.
      const pts = [];
      for (let i = 0; i < n; i += 2) pts.push(i);
      if (pts[pts.length - 1] !== n - 1) pts.push(n - 1);
      const m = pts.length;
      const sx = new Float32Array(m);
      const sy = new Float32Array(m);
      const nx = new Float32Array(m);
      const ny = new Float32Array(m);
      for (let k = 0; k < m; k++) {
        sx[k] = tr[pts[k] * 2];
        sy[k] = tr[pts[k] * 2 + 1];
      }
      for (let k = 0; k < m; k++) {
        const a = Math.max(0, k - 1);
        const b = Math.min(m - 1, k + 1);
        const dx = sx[b] - sx[a];
        const dy = sy[b] - sy[a];
        const l = Math.hypot(dx, dy) || 1;
        nx[k] = -dy / l;
        ny[k] = dx / l;
      }

      for (const [width, alpha] of passes) {
        const grad = ctx.createLinearGradient(sx[0], sy[0], sx[m - 1], sy[m - 1]);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.6, `rgba(255,255,255,${alpha * f})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let k = 0; k < m; k++) {
          const hw = width * p.width * 0.5 * Math.pow(Math.sin((Math.PI * k) / (m - 1)), 0.7);
          if (k === 0) ctx.moveTo(sx[k] + nx[k] * hw, sy[k] + ny[k] * hw);
          else ctx.lineTo(sx[k] + nx[k] * hw, sy[k] + ny[k] * hw);
        }
        for (let k = m - 1; k >= 0; k--) {
          const hw = width * p.width * 0.5 * Math.pow(Math.sin((Math.PI * k) / (m - 1)), 0.7);
          ctx.lineTo(sx[k] - nx[k] * hw, sy[k] - ny[k] * hw);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function windAt(wind, x, y) {
  return wind.forceAt(x, y);
}

// Slow ambient surface current that floating things drift with.
function currentAt(t) {
  const a = t * 0.04;
  return { x: Math.cos(a) * 5, y: Math.sin(a * 1.3) * 4 };
}

// Keep a floating thing on the water, nudging it away from the shore.
function keepAfloat(obj, pond, margin, dt) {
  const d = pond.shoreDist(obj.x, obj.y);
  if (d < margin) {
    const inward = pond.inward(obj.x, obj.y);
    const push = (margin - d) * 3;
    obj.vx += inward.x * push * dt;
    obj.vy += inward.y * push * dt;
  }
  pond.clampInside(obj, 0.995);
}

// ---------- Lily pads ----------
class LilyPad {
  constructor(x, y, r) {
    this.r = r;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = rand(0, TAU);
    this.spin = 0;
    const g = rand(0, 1);
    const young = Math.random() < 0.06; // fresh leaves have a bronze tint
    this.light = young ? '#86883f' : `rgb(${lerp(88, 112, g) | 0},${lerp(138, 156, g) | 0},${lerp(60, 72, g) | 0})`;
    this.dark = young ? '#4f5626' : `rgb(${lerp(40, 54, g) | 0},${lerp(86, 100, g) | 0},${lerp(38, 46, g) | 0})`;
    const roll = Math.random();
    this.flower = r > 26 && roll < 0.22 ? { size: r * rand(0.45, 0.6), rot: rand(0, TAU) } : null;
    this.bud = !this.flower && roll < 0.32 ? { a: rand(0, TAU), size: rand(5, 8) } : null;
  }

  update(dt, t, pond, wind, pads) {
    const cur = currentAt(t);
    const w = windAt(wind, this.x, this.y);
    this.vx += ((cur.x - this.vx) * 0.3 + w.x * 12) * dt;
    this.vy += ((cur.y - this.vy) * 0.3 + w.y * 12) * dt;
    this.spin += ((w.x - w.y) * 0.1 - this.spin * 0.5) * dt;

    for (const o of pads) {
      if (o === this) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const dist = Math.hypot(dx, dy);
      const min = (this.r + o.r) * 0.88; // pads may overlap a little, like real ones
      if (dist > 0 && dist < min) {
        const push = (min - dist) * 0.5;
        this.x += (dx / dist) * push;
        this.y += (dy / dist) * push;
      }
    }

    keepAfloat(this, pond, this.r * 0.7, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;
  }

  draw(ctx, sun) {
    const r = this.r;
    const notch = 0.2;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.fillStyle = `rgba(0, 18, 12, ${sun.alpha * 1.1})`;
    ctx.beginPath();
    ctx.arc(sun.x * 5, sun.y * 5, r, 0, TAU);
    ctx.fill();

    ctx.rotate(this.angle);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, this.light);
    g.addColorStop(1, this.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, notch, TAU - notch);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(24, 52, 22, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200, 225, 160, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = notch + 0.25 + (k * (TAU - 2 * notch - 0.5)) / 8;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    }
    ctx.stroke();

    if (this.flower) drawLotus(ctx, -r * 0.15, r * 0.1, this.flower.size, this.flower.rot);
    if (this.bud) {
      const bx = Math.cos(this.bud.a) * r * 1.15;
      const by = Math.sin(this.bud.a) * r * 1.15;
      ctx.fillStyle = '#4a6a2c';
      ctx.beginPath();
      ctx.ellipse(bx, by, this.bud.size * 0.55, this.bud.size, this.bud.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e7a3b8';
      ctx.beginPath();
      ctx.ellipse(bx, by, this.bud.size * 0.35, this.bud.size * 0.7, this.bud.a, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Lily pads grow in clusters near the shore, with a few loners further out.
function makeLilyPads(pond, total) {
  const pads = [];
  const clusters = clamp(Math.round(total / 5), 2, 4);
  for (let c = 0; c < clusters; c++) {
    const theta = rand(0, TAU);
    const center = pond.offsetPoint(theta, -rand(50, 130));
    const n = Math.floor((total * 0.7) / clusters);
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU);
      const d = Math.sqrt(Math.random()) * 80;
      const r = rand(14, 40);
      const p = { x: center.x + Math.cos(a) * d, y: center.y + Math.sin(a) * d };
      pond.clampInside(p, 0.93);
      pads.push(new LilyPad(p.x, p.y, r));
    }
  }
  while (pads.length < total) {
    const r = rand(20, 44);
    const p = pond.randomInside(r + 10);
    pads.push(new LilyPad(p.x, p.y, r));
  }
  return pads;
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
    { n: 8, len: 0.95, w: 0.32, color: '#eaa3b8', off: 0 },
    { n: 8, len: 0.72, w: 0.28, color: '#f3c3d1', off: Math.PI / 8 },
    { n: 6, len: 0.48, w: 0.22, color: '#fae2e8', off: 0.2 },
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
  ctx.fillStyle = '#e9c548';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- Floating petals ----------
class Petal {
  constructor(pond) {
    const p = pond.randomInside(10);
    this.x = p.x;
    this.y = p.y;
    this.vx = 0;
    this.vy = 0;
    this.rot = rand(0, TAU);
    this.vr = rand(-0.3, 0.3);
    this.size = rand(3.5, 6);
    this.color = pick(['#f1c3cf', '#f4d4dc', '#eab4c3', '#f7e2e6']);
  }

  update(dt, t, pond, wind) {
    const cur = currentAt(t);
    const w = windAt(wind, this.x, this.y);
    this.vx += ((cur.x * 1.3 - this.vx) * 0.6 + w.x * 45) * dt;
    this.vy += ((cur.y * 1.3 - this.vy) * 0.6 + w.y * 45) * dt;
    this.vr += (Math.hypot(w.x, w.y) * rand(-6, 6) - this.vr * 0.4) * dt;
    keepAfloat(this, pond, 12, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
  }

  draw(ctx, sun) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = `rgba(0,0,0,${sun.alpha * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(sun.x * 2, sun.y * 2, this.size, this.size * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- Day / night ----------
const DAY_LENGTH = 120; // seconds for one full day

// t = 0 is 06:00, t = 0.5 is 18:00. Colour is multiplied over the whole scene.
const SKY_KEYS = [
  [0.0, [226, 168, 150]],   // sunrise
  [0.05, [250, 212, 178]],  // early golden light
  [0.12, [255, 240, 222]],
  [0.25, [255, 253, 246]],  // noon
  [0.4, [255, 244, 226]],
  [0.46, [252, 206, 158]],  // golden hour
  [0.51, [214, 140, 112]],  // sunset
  [0.56, [146, 132, 172]],  // dusk
  [0.62, [102, 114, 152]],  // moonlit night
  [0.9, [96, 108, 148]],
  [0.95, [146, 132, 168]],  // pre-dawn
  [1.0, [226, 168, 150]],
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
  const night = clamp((0.85 - lum) / 0.4, 0, 1);

  // Sun crosses from east (right) to west (left); shadows are long and faint at the ends of the day.
  let sun;
  if (t < 0.5) {
    const p = t / 0.5;
    const elev = Math.sin(p * Math.PI);
    const len = 1 + 2.4 * (1 - elev);
    const dx = -Math.cos(p * Math.PI);
    const dy = 0.45;
    const l = Math.hypot(dx, dy);
    sun = { x: (dx / l) * len, y: (dy / l) * len, alpha: 0.05 + 0.2 * Math.min(1, elev * 4) };
  } else {
    sun = { x: 0.6, y: 0.8, alpha: 0.09 * night }; // soft moon shadows
  }

  // Warm, low light near sunrise and sunset.
  const golden = Math.max(Math.exp(-(((t - 0.02) / 0.04) ** 2)), Math.exp(-(((t - 0.48) / 0.04) ** 2)));

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
    night,
    sun,
    golden,
    sunFromRight: t < 0.25,
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

// Fireflies hover around the banks, each loosely tied to a home spot.
class Firefly {
  constructor(pond) {
    const home = pond.offsetPoint(rand(0, TAU), rand(-50, 70));
    this.hx = home.x;
    this.hy = home.y;
    this.x = home.x + rand(-30, 30);
    this.y = home.y + rand(-30, 30);
    this.heading = rand(0, TAU);
    this.speed = rand(10, 22);
    this.blink = rand(0.8, 1.8);
    this.ph = rand(0, TAU);
  }

  update(dt, t) {
    let turn = Math.sin(t * 0.8 + this.ph) * 1.5;
    const dx = this.hx - this.x;
    const dy = this.hy - this.y;
    if (Math.hypot(dx, dy) > 70) turn += angleDiff(Math.atan2(dy, dx), this.heading) * 1.5;
    this.heading += turn * dt;
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
  }

  glow(t) {
    const s = Math.max(0, Math.sin(t * this.blink + this.ph));
    return s * s;
  }
}

class NightSky {
  constructor(pond) {
    this.pond = pond;
    this.fireflySprite = makeGlowSprite(48, '214,255,140');
    this.moonSprite = makeGlowSprite(256, '196,206,240');
    this.stars = [];
    for (let k = 0; k < 120; k++) {
      const p = pond.randomInside(0);
      this.stars.push({ x: p.x, y: p.y, s: rand(0.6, 1.7), tw: rand(1, 4), ph: rand(0, TAU) });
    }
    this.fireflies = [];
    for (let k = 0; k < 26; k++) this.fireflies.push(new Firefly(pond));
    this.moon = pond.point(-0.75, 0.5); // halfway out, so it stays on the water whatever the shoreline does
  }

  update(dt, t) {
    for (const f of this.fireflies) f.update(dt, t);
  }

  // Drawn with additive blending after the scene has been darkened.
  draw(ctx, t, night) {
    if (night <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Stars and moon are reflections, so they only appear on the water.
    ctx.save();
    ctx.clip(this.pond.path);
    for (const s of this.stars) {
      const a = night * (0.35 + 0.65 * Math.max(0, Math.sin(t * s.tw + s.ph))) * 0.6;
      ctx.fillStyle = `rgba(215,225,250,${a})`;
      ctx.fillRect(s.x + Math.sin(t * 1.3 + s.ph) * 1.2, s.y, s.s, s.s);
    }
    const { x: mx, y: my } = this.moon;
    const R = 24;
    ctx.globalAlpha = night * 0.3;
    ctx.drawImage(this.moonSprite, mx - 140, my - 140, 280, 280);
    ctx.globalAlpha = 1;
    ctx.globalAlpha = night * 0.55;
    ctx.drawImage(this.moonSprite, mx - R * 1.6, my - R * 1.6, R * 3.2, R * 3.2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(222,228,245,${0.28 * night})`;
    for (let yy = -R; yy < R; yy += 2) {
      const hw = Math.sqrt(Math.max(0, R * R - (yy + 1) * (yy + 1))) * (0.85 + 0.15 * Math.sin(t * 2.3 + yy * 0.7));
      const xo = Math.sin(t * 2.1 + yy * 0.9) * 3 + Math.sin(t * 1.3 + yy * 0.23) * 2;
      ctx.fillRect(mx - hw + xo, my + yy, hw * 2, 2);
    }
    ctx.restore();

    for (const f of this.fireflies) {
      const g = f.glow(t) * night;
      if (g < 0.02) continue;
      ctx.globalAlpha = g;
      ctx.drawImage(this.fireflySprite, f.x - 24, f.y - 24, 48, 48);
    }
    ctx.restore();
  }
}
