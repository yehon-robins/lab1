// Pond geometry (an irregular blob) plus everything growing around it:
// a pre-painted land layer (earth, grass, bushes, rocks) and animated plants
// (reeds, overhanging trees, underwater weed).

class Pond {
  constructor(W, H, harmonics) {
    this.cx = W / 2;
    this.cy = H / 2;
    this.harmonics = harmonics || [
      { k: 2, a: rand(0.03, 0.06), p: rand(0, TAU) },
      { k: 3, a: rand(0.03, 0.05), p: rand(0, TAU) },
      { k: 4, a: rand(0.015, 0.03), p: rand(0, TAU) },
      { k: 6, a: rand(0.008, 0.016), p: rand(0, TAU) },
      { k: 9, a: rand(0.004, 0.008), p: rand(0, TAU) },
    ];
    const bulge = 1 + this.harmonics.reduce((s, h) => s + h.a, 0);
    const margin = clamp(Math.min(W, H) * 0.1, 36, 120) + 18;
    this.rx = Math.max(60, W / 2 - margin) / bulge;
    this.ry = Math.max(60, H / 2 - margin) / bulge;
    this.perimeter = Math.PI * (3 * (this.rx + this.ry) - Math.sqrt((3 * this.rx + this.ry) * (this.rx + 3 * this.ry)));
    this.area = Math.PI * this.rx * this.ry;

    this.path = new Path2D();
    for (let i = 0; i <= 240; i++) {
      const p = this.point((i / 240) * TAU);
      if (i === 0) this.path.moveTo(p.x, p.y);
      else this.path.lineTo(p.x, p.y);
    }
    this.path.closePath();
  }

  shape(theta) {
    let s = 1;
    for (const h of this.harmonics) s += h.a * Math.sin(h.k * theta + h.p);
    return s;
  }

  // Point on the shoreline (f = 1) or scaled toward the centre (f < 1).
  point(theta, f = 1) {
    const s = this.shape(theta) * f;
    return { x: this.cx + Math.cos(theta) * this.rx * s, y: this.cy + Math.sin(theta) * this.ry * s };
  }

  // Shoreline point pushed `px` pixels outward (negative = into the water).
  offsetPoint(theta, px) {
    const b = this.point(theta);
    const ux = b.x - this.cx;
    const uy = b.y - this.cy;
    const l = Math.hypot(ux, uy) || 1;
    return { x: b.x + (ux / l) * px, y: b.y + (uy / l) * px };
  }

  // < 1 inside the pond, 1 on the shore, > 1 on land.
  norm(x, y) {
    const dx = (x - this.cx) / this.rx;
    const dy = (y - this.cy) / this.ry;
    return Math.hypot(dx, dy) / this.shape(Math.atan2(dy, dx));
  }

  // Approximate distance to the shore in pixels: positive in the water, negative on land.
  shoreDist(x, y) {
    const dx = (x - this.cx) / this.rx;
    const dy = (y - this.cy) / this.ry;
    const theta = Math.atan2(dy, dx);
    const s = this.shape(theta);
    const n = Math.hypot(dx, dy) / s;
    return (1 - n) * s * Math.hypot(this.rx * Math.cos(theta), this.ry * Math.sin(theta));
  }

  inward(x, y) {
    const dx = this.cx - x;
    const dy = this.cy - y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  // Pull a point back inside if it has crossed `f` of the way to the shore.
  clampInside(p, f) {
    const n = this.norm(p.x, p.y);
    if (n > f) {
      p.x = this.cx + ((p.x - this.cx) * f) / n;
      p.y = this.cy + ((p.y - this.cy) * f) / n;
    }
  }

  randomInside(minShore) {
    for (let tries = 0; tries < 200; tries++) {
      const p = this.point(rand(0, TAU), Math.sqrt(Math.random()));
      if (this.shoreDist(p.x, p.y) > minShore) return p;
    }
    return { x: this.cx, y: this.cy };
  }
}

// ---------- Static land layer ----------

function smoothPoly(g, pts) {
  const n = pts.length;
  g.beginPath();
  g.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    g.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  g.closePath();
}

function drawRock(g, x, y, r) {
  const pts = [];
  const n = 9;
  const rot = rand(0, TAU);
  const squash = rand(0.7, 1);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const rr = r * rand(0.78, 1.08);
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * squash });
  }
  g.save();
  g.translate(r * 0.22, r * 0.32);
  g.fillStyle = 'rgba(10,12,8,0.35)';
  smoothPoly(g, pts);
  g.fill();
  g.restore();

  const warm = rand(-8, 8);
  const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.15);
  grad.addColorStop(0, `rgb(${168 + warm},${163 + warm * 0.5},${148})`);
  grad.addColorStop(0.55, `rgb(${118 + warm},${114 + warm * 0.5},${104})`);
  grad.addColorStop(1, `rgb(${70 + warm},${68},${62})`);
  g.fillStyle = grad;
  smoothPoly(g, pts);
  g.fill();

  if (Math.random() < 0.45) {
    g.save();
    smoothPoly(g, pts);
    g.clip();
    g.fillStyle = 'rgba(88,116,48,0.6)';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.6, r * rand(0.2, 0.45), 0, TAU);
      g.fill();
    }
    g.restore();
  }
}

function drawBush(g, x, y, r) {
  g.fillStyle = 'rgba(8,14,4,0.35)';
  g.beginPath();
  g.ellipse(x + r * 0.3, y + r * 0.4, r * 1.05, r * 0.95, 0, 0, TAU);
  g.fill();
  const layers = [
    { c: ['#24391a', '#2b4220'], k: 12, s: 0.55, off: 0 },
    { c: ['#35532a', '#3d5e2c', '#2f4c24'], k: 14, s: 0.42, off: -0.08 },
    { c: ['#4f7536', '#5a803b', '#46692f'], k: 12, s: 0.3, off: -0.18 },
    { c: ['#6f9646', '#7ea552'], k: 8, s: 0.18, off: -0.28 },
  ];
  for (const l of layers) {
    for (let i = 0; i < l.k; i++) {
      const a = rand(0, TAU);
      const d = Math.sqrt(Math.random()) * r * (1 - l.s);
      g.fillStyle = pick(l.c);
      g.beginPath();
      g.arc(x + Math.cos(a) * d + r * l.off, y + Math.sin(a) * d + r * l.off, r * l.s * rand(0.7, 1.1), 0, TAU);
      g.fill();
    }
  }
}

function paintLand(pond, W, H, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);

  // Earth and grass base, mottled.
  g.fillStyle = '#52592f';
  g.fillRect(0, 0, W, H);
  const patches = ['rgba(74,96,42,0.5)', 'rgba(92,114,50,0.45)', 'rgba(60,80,34,0.5)', 'rgba(112,98,66,0.35)', 'rgba(118,132,64,0.35)', 'rgba(96,84,56,0.3)'];
  for (let k = 0; k < (W * H) / 1600; k++) {
    const r = rand(10, 60);
    g.fillStyle = pick(patches);
    g.beginPath();
    g.ellipse(rand(0, W), rand(0, H), r, r * rand(0.5, 1), rand(0, TAU), 0, TAU);
    g.fill();
  }

  // Earth bank: dry soil fading to wet mud at the waterline.
  g.lineJoin = 'round';
  for (const [w, col] of [[54, '#6e5d40'], [36, '#5b4a32'], [20, '#433626']]) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke(pond.path);
  }

  // Ragged grass edge over the bank, crumbs and pebbles in the mud.
  for (let k = 0; k < pond.perimeter / 2.5; k++) {
    const p = pond.offsetPoint(rand(0, TAU), rand(18, 32));
    g.fillStyle = pick(['#4f6a2d', '#5b7833', '#465f28', '#61803a']);
    g.beginPath();
    g.ellipse(p.x, p.y, rand(3, 9), rand(2, 6), rand(0, TAU), 0, TAU);
    g.fill();
  }
  for (let k = 0; k < pond.perimeter / 3; k++) {
    const p = pond.offsetPoint(rand(0, TAU), rand(-2, 22));
    const v = rand(70, 140) | 0;
    g.fillStyle = `rgba(${v},${(v * 0.95) | 0},${(v * 0.85) | 0},${rand(0.4, 0.9)})`;
    g.beginPath();
    g.ellipse(p.x, p.y, rand(1, 3.5), rand(1, 2.5), rand(0, TAU), 0, TAU);
    g.fill();
  }

  // Grass blades, batched by colour.
  const greens = ['#3e5a24', '#4b6b2a', '#58792f', '#668a36', '#76993f', '#86a84a'];
  const buckets = greens.map(() => new Path2D());
  const blades = Math.min(30000, (W * H) / 40);
  for (let k = 0; k < blades; k++) {
    const x = rand(0, W);
    const y = rand(0, H);
    if (pond.shoreDist(x, y) > -18) continue;
    const a = rand(0, TAU);
    const len = rand(3, 8);
    const b = buckets[Math.floor(Math.random() * buckets.length)];
    b.moveTo(x, y);
    b.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  g.lineWidth = 1.1;
  g.lineCap = 'round';
  buckets.forEach((b, i) => { g.strokeStyle = greens[i]; g.stroke(b); });

  // Wildflowers.
  for (let k = 0; k < (W * H) / 6000; k++) {
    const x = rand(0, W);
    const y = rand(0, H);
    if (pond.shoreDist(x, y) > -30) continue;
    g.fillStyle = pick(['rgba(250,248,235,0.85)', 'rgba(246,214,90,0.85)', 'rgba(190,160,220,0.8)']);
    g.beginPath();
    g.arc(x, y, rand(1, 2.2), 0, TAU);
    g.fill();
  }

  // Bushes on the land, away from the bank.
  const bushCount = clamp(Math.round((W * H - pond.area) / 45000), 5, 18);
  for (let k = 0, tries = 0; k < bushCount && tries < 400; tries++) {
    const x = rand(-20, W + 20);
    const y = rand(-20, H + 20);
    const r = rand(18, 42);
    if (pond.shoreDist(x, y) > -(r + 40)) continue;
    drawBush(g, x, y, r);
    k++;
  }

  // Cut the pond out, then cast the bank's shadow onto the water.
  g.globalCompositeOperation = 'destination-out';
  g.fill(pond.path);
  g.globalCompositeOperation = 'source-over';
  g.save();
  g.clip(pond.path);
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 26 * dpr;
  g.shadowOffsetX = 5 * dpr;
  g.shadowOffsetY = 7 * dpr;
  const ring = new Path2D();
  ring.rect(-W, -H, W * 3, H * 3);
  ring.addPath(pond.path);
  g.fillStyle = '#000';
  g.fill(ring, 'evenodd');
  g.restore();

  // Rocks straddling the shoreline, plus a few out on the land.
  const rockCount = clamp(Math.round(pond.perimeter / 70), 12, 40);
  for (let k = 0; k < rockCount; k++) {
    const p = pond.offsetPoint(rand(0, TAU), rand(-6, 14));
    drawRock(g, p.x, p.y, rand(7, 22));
  }
  for (let k = 0; k < rockCount / 3; k++) {
    const x = rand(0, W);
    const y = rand(0, H);
    if (pond.shoreDist(x, y) < -40) drawRock(g, x, y, rand(6, 16));
  }
  return c;
}

// ---------- Animated plants ----------

function makeCanopy(r, dpr) {
  const size = Math.ceil(r * 2.4);
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    return [c, g];
  };
  const [leaf, g] = mk();
  const [shadow, s] = mk();
  const cx = size / 2;
  const clumps = [];
  for (let i = 0; i < 26; i++) {
    const a = rand(0, TAU);
    const d = Math.sqrt(Math.random()) * r * 0.75;
    clumps.push({ x: cx + Math.cos(a) * d, y: cx + Math.sin(a) * d, r: r * rand(0.22, 0.36) });
  }
  s.fillStyle = '#000';
  for (const c of clumps) { s.beginPath(); s.arc(c.x, c.y, c.r * 1.05, 0, TAU); s.fill(); }

  const tones = [
    ['#20361a', 1.0, 0],
    ['#2e4a22', 0.82, -0.08],
    ['#3f6129', 0.6, -0.16],
    ['#557a33', 0.4, -0.24],
    ['#6f9341', 0.2, -0.3],
  ];
  for (const [col, sc, off] of tones) {
    g.fillStyle = col;
    for (const c of clumps) {
      g.beginPath();
      g.arc(c.x + c.r * off * 2, c.y + c.r * off * 2, c.r * sc, 0, TAU);
      g.fill();
    }
  }
  // Leaf speckle.
  for (let i = 0; i < 260; i++) {
    const c = pick(clumps);
    const a = rand(0, TAU);
    const d = rand(0, c.r);
    g.fillStyle = pick(['rgba(130,170,80,0.35)', 'rgba(20,40,15,0.35)', 'rgba(100,140,60,0.3)']);
    g.beginPath();
    g.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, rand(1.5, 3.5), 0, TAU);
    g.fill();
  }
  return { leaf, shadow, size };
}

class Flora {
  constructor(pond, W, H, dpr) {
    this.pond = pond;

    // Reed tufts along the shore, some standing in the shallows.
    this.tufts = [];
    const tuftCount = clamp(Math.round(pond.perimeter / 55), 10, 40);
    for (let k = 0; k < tuftCount; k++) {
      const p = pond.offsetPoint(rand(0, TAU), rand(-22, 16));
      const blades = [];
      const n = 7 + Math.floor(Math.random() * 9);
      for (let i = 0; i < n; i++) {
        blades.push({
          a: rand(0, TAU),
          len: rand(14, 40),
          w: rand(1.2, 2.6),
          color: pick(['#4e6e2c', '#5d7f33', '#6f8f3a', '#40602a', '#7d9b46']),
          cattail: Math.random() < 0.18,
          ph: rand(0, TAU),
        });
      }
      this.tufts.push({ x: p.x, y: p.y, blades });
    }

    // Underwater weed in the shallows.
    this.weeds = [];
    const weedCount = clamp(Math.round(pond.perimeter / 90), 8, 26);
    for (let k = 0; k < weedCount; k++) {
      const theta = rand(0, TAU);
      const p = pond.offsetPoint(theta, -rand(18, 80));
      const inward = pond.inward(p.x, p.y);
      const base = Math.atan2(inward.y, inward.x);
      const strands = [];
      for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) {
        strands.push({ a: base + rand(-0.9, 0.9), len: rand(24, 64), ph: rand(0, TAU), w: rand(2, 3.5) });
      }
      this.weeds.push({ x: p.x, y: p.y, strands });
    }

    // A few trees on the bank whose canopies hang out over the water.
    this.trees = [];
    const treeCount = Math.min(W, H) < 500 ? 2 : 3;
    const start = rand(0, TAU);
    for (let k = 0; k < treeCount; k++) {
      const r = clamp(Math.min(W, H) * rand(0.11, 0.15), 50, 140);
      const theta = start + (k * TAU) / treeCount + rand(-0.4, 0.4);
      const p = pond.offsetPoint(theta, r * 0.45);
      this.trees.push({ x: p.x, y: p.y, r, ph: rand(0, TAU), ...makeCanopy(r, dpr) });
    }
  }

  drawWeeds(ctx, t) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const wd of this.weeds) {
      for (const s of wd.strands) {
        const sway = Math.sin(t * 0.9 + s.ph) * 0.35;
        const a = s.a + sway * 0.4;
        const mx = wd.x + Math.cos(a) * s.len * 0.5 + Math.cos(a + Math.PI / 2) * sway * 10;
        const my = wd.y + Math.sin(a) * s.len * 0.5 + Math.sin(a + Math.PI / 2) * sway * 10;
        const ex = wd.x + Math.cos(a + sway * 0.5) * s.len;
        const ey = wd.y + Math.sin(a + sway * 0.5) * s.len;
        ctx.strokeStyle = 'rgba(46,82,40,0.55)';
        ctx.lineWidth = s.w * 1.8;
        ctx.beginPath();
        ctx.moveTo(wd.x, wd.y);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(92,130,62,0.4)';
        ctx.lineWidth = s.w * 0.6;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTufts(ctx, t, sun, gusts) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const tf of this.tufts) {
      const wind = windAt(gusts, tf.x, tf.y);
      // Shadow first, then blades.
      for (const pass of [0, 1]) {
        for (const b of tf.blades) {
          const swayX = wind.x * b.len * 0.5 + Math.sin(t * 1.4 + b.ph) * 1.5;
          const swayY = wind.y * b.len * 0.5 + Math.cos(t * 1.1 + b.ph) * 1.5;
          const ex = tf.x + Math.cos(b.a) * b.len + swayX;
          const ey = tf.y + Math.sin(b.a) * b.len + swayY;
          const mx = tf.x + Math.cos(b.a) * b.len * 0.5 + swayX * 0.3;
          const my = tf.y + Math.sin(b.a) * b.len * 0.5 + swayY * 0.3;
          const ox = pass === 0 ? sun.x * 5 : 0;
          const oy = pass === 0 ? sun.y * 5 : 0;
          ctx.strokeStyle = pass === 0 ? `rgba(0,10,0,${sun.alpha * 0.9})` : b.color;
          ctx.lineWidth = b.w;
          ctx.beginPath();
          ctx.moveTo(tf.x + ox, tf.y + oy);
          ctx.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy);
          ctx.stroke();
          if (pass === 1 && b.cattail) {
            ctx.fillStyle = '#5a3d24';
            ctx.beginPath();
            ctx.ellipse(ex, ey, 2.4, 5.5, b.a + Math.PI / 2, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }

  drawTreeShadows(ctx, t, sun, gusts) {
    ctx.save();
    for (const tr of this.trees) {
      const sway = this.treeSway(tr, t, gusts);
      const off = 30 + tr.r * 0.25;
      ctx.globalAlpha = sun.alpha * 1.6;
      ctx.drawImage(tr.shadow, tr.x - tr.size / 2 + sway.x + sun.x * off, tr.y - tr.size / 2 + sway.y + sun.y * off, tr.size, tr.size);
    }
    ctx.restore();
  }

  drawTrees(ctx, t, gusts) {
    for (const tr of this.trees) {
      const sway = this.treeSway(tr, t, gusts);
      ctx.drawImage(tr.leaf, tr.x - tr.size / 2 + sway.x, tr.y - tr.size / 2 + sway.y, tr.size, tr.size);
    }
  }

  treeSway(tr, t, gusts) {
    const w = windAt(gusts, tr.x, tr.y);
    return { x: w.x * 10 + Math.sin(t * 0.6 + tr.ph) * 1.5, y: w.y * 10 + Math.cos(t * 0.5 + tr.ph) * 1.2 };
  }
}
