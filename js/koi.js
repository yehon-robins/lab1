// Koi: a chain of spine points that follows the head (follow-the-leader),
// with a travelling sine wave added at draw time for the swimming motion.
const KOI_VARIETIES = [
  { base: '#f5f0e6', fin: 'rgba(245,240,230,0.55)', spots: ['#e4471b', '#d63d16', '#ea5a24'] },  // kohaku
  { base: '#f5f0e6', fin: 'rgba(245,240,230,0.55)', spots: ['#e4471b', '#e4471b', '#1a1a1d'] },  // sanke
  { base: '#1c1b1f', fin: 'rgba(40,38,44,0.55)',    spots: ['#e6521f', '#f3eee4', '#e6521f'] },  // showa
  { base: '#f0a530', fin: 'rgba(250,190,90,0.5)',   spots: ['#f7c76a'] },                        // orange ogon
  { base: '#f3cf4f', fin: 'rgba(250,225,130,0.5)',  spots: ['#fae49a'] },                        // yamabuki
  { base: '#d9802e', fin: 'rgba(230,150,80,0.5)',   spots: ['#ee9a45'] },                        // chagoi
  { base: '#f6f2ea', fin: 'rgba(246,242,234,0.55)', spots: [], tancho: true },                   // tancho
  { base: '#7d97ad', fin: 'rgba(160,180,200,0.5)',  spots: ['#e0662a', '#e0662a', '#a9bccb'] },  // asagi
];

const KOI_SEGMENTS = 16;

class Koi {
  constructor(x, y, length) {
    this.length = length;
    this.segLen = length / (KOI_SEGMENTS - 1);
    this.maxHalfWidth = length * 0.115;
    this.heading = rand(0, TAU);
    this.baseSpeed = rand(26, 46);
    this.speed = this.baseSpeed;
    this.burst = 0;
    this.scatterTime = 0;
    this.targetHeading = 0;
    this.phase = rand(0, TAU);
    this.seed = rand(0, 1000);
    this.depth = Math.random(); // 0 = near the bottom, 1 = just under the surface

    this.variety = pick(KOI_VARIETIES);
    this.spots = this.makeSpots();

    this.points = [];
    this.disp = [];
    for (let i = 0; i < KOI_SEGMENTS; i++) {
      this.points.push({
        x: x - Math.cos(this.heading) * this.segLen * i,
        y: y - Math.sin(this.heading) * this.segLen * i,
      });
      this.disp.push({ x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0, w: 0 });
    }
    this.computeDisplay();
  }

  makeSpots() {
    const v = this.variety;
    if (v.tancho) return [{ s: 0.07, o: 0, rx: 0.075, ry: 0.07, color: '#d8321a' }];
    const spots = [];
    const count = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < count; k++) {
      spots.push({
        s: rand(0.04, 0.72),          // position along the body (0 = head)
        o: rand(-0.6, 0.6),           // lateral offset, fraction of half-width
        rx: rand(0.07, 0.16),         // radii as fractions of body length
        ry: rand(0.05, 0.11),
        color: pick(v.spots),
      });
    }
    return spots;
  }

  halfWidth(t) {
    const m = this.maxHalfWidth;
    if (t < 0.18) return m * (0.55 + 0.45 * Math.sin((t / 0.18) * Math.PI * 0.5));
    return m * (1 - 0.86 * Math.pow((t - 0.18) / 0.82, 1.15));
  }

  // Dart off in a random new direction (at least 60 degrees away from the current one),
  // preferring directions that don't point straight into the pond edge.
  scatter(W, H) {
    const head = this.points[0];
    let heading = this.heading + rand(Math.PI / 3, (Math.PI * 5) / 3);
    for (let tries = 0; tries < 10; tries++) {
      const h = this.heading + rand(Math.PI / 3, (Math.PI * 5) / 3);
      const px = head.x + Math.cos(h) * 160;
      const py = head.y + Math.sin(h) * 160;
      if (px > 60 && px < W - 60 && py > 60 && py < H - 60) { heading = h; break; }
    }
    this.targetHeading = heading;
    this.burst = rand(220, 300);
    this.scatterTime = 0.9;
  }

  update(dt, t, W, H, school) {
    const head = this.points[0];
    const vx = Math.cos(this.heading);
    const vy = Math.sin(this.heading);

    // Gentle meandering turn.
    let turn = (Math.sin(t * 0.37 + this.seed) * 0.9 + Math.sin(t * 0.91 + this.seed * 1.7) * 0.5) * 0.5;

    // Steering: stay off the edges, keep a little space from other fish.
    let sx = 0;
    let sy = 0;
    const m = 120;
    if (head.x < m) sx += ((m - head.x) / m) * 2.5;
    if (head.x > W - m) sx -= ((head.x - (W - m)) / m) * 2.5;
    if (head.y < m) sy += ((m - head.y) / m) * 2.5;
    if (head.y > H - m) sy -= ((head.y - (H - m)) / m) * 2.5;
    const wallX = sx;
    const wallY = sy;

    const personal = this.length * 0.9;
    for (const other of school) {
      if (other === this) continue;
      const dx = head.x - other.points[0].x;
      const dy = head.y - other.points[0].y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < personal) {
        const f = (1 - dist / personal) * 1.2;
        sx += (dx / dist) * f;
        sy += (dy / dist) * f;
      }
    }

    let maxTurn = 1.8;
    if (this.scatterTime > 0) {
      this.scatterTime -= dt;
      turn = angleDiff(this.targetHeading, this.heading) * 9;
      maxTurn = 8;
      if (wallX || wallY) turn += angleDiff(Math.atan2(vy + wallY, vx + wallX), this.heading) * 2;
    } else if (sx || sy) {
      turn += angleDiff(Math.atan2(vy + sy, vx + sx), this.heading) * 2.2;
    }
    this.heading += clamp(turn, -maxTurn, maxTurn) * dt;

    this.burst *= Math.exp(-dt * 1.4);
    this.speed = this.baseSpeed * (0.85 + 0.15 * Math.sin(t * 0.5 + this.seed)) + this.burst;

    head.x = clamp(head.x + Math.cos(this.heading) * this.speed * dt, 5, W - 5);
    head.y = clamp(head.y + Math.sin(this.heading) * this.speed * dt, 5, H - 5);

    for (let i = 1; i < KOI_SEGMENTS; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      b.x = a.x + (dx / len) * this.segLen;
      b.y = a.y + (dy / len) * this.segLen;
    }

    this.phase += dt * (3 + this.speed * 0.07);
    this.computeDisplay();
  }

  // Spine points with the swimming undulation applied, plus normals and widths for drawing.
  computeDisplay() {
    const N = KOI_SEGMENTS;
    const amp = this.length * 0.05 * (0.7 + Math.min(1, this.speed / 150) * 0.6);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const a = this.points[Math.max(0, i - 1)];
      const b = this.points[Math.min(N - 1, i + 1)];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const nx = -dy;
      const ny = dx;
      const off = Math.sin(this.phase - t * 5) * amp * (t * t * 0.9 + 0.08);
      const d = this.disp[i];
      d.x = this.points[i].x + nx * off;
      d.y = this.points[i].y + ny * off;
      d.nx = nx;
      d.ny = ny;
      d.dx = dx;
      d.dy = dy;
      d.w = this.halfWidth(t);
    }
  }

  get head() { return this.points[0]; }

  hitTest(x, y) {
    for (const d of this.disp) {
      const r = d.w + 10;
      if ((x - d.x) ** 2 + (y - d.y) ** 2 < r * r) return true;
    }
    return false;
  }

  bodyPath(ctx) {
    const d = this.disp;
    const h = d[0];
    const pts = [
      { x: h.x + h.dx * h.w * 0.95, y: h.y + h.dy * h.w * 0.95 },
      { x: h.x + h.dx * h.w * 0.6 + h.nx * h.w * 0.78, y: h.y + h.dy * h.w * 0.6 + h.ny * h.w * 0.78 },
    ];
    for (let i = 0; i < d.length; i++) pts.push({ x: d[i].x + d[i].nx * d[i].w, y: d[i].y + d[i].ny * d[i].w });
    for (let i = d.length - 1; i >= 0; i--) pts.push({ x: d[i].x - d[i].nx * d[i].w, y: d[i].y - d[i].ny * d[i].w });
    pts.push({ x: h.x + h.dx * h.w * 0.6 - h.nx * h.w * 0.78, y: h.y + h.dy * h.w * 0.6 - h.ny * h.w * 0.78 });

    ctx.beginPath();
    const n = pts.length;
    const last = pts[n - 1];
    ctx.moveTo((last.x + pts[0].x) / 2, (last.y + pts[0].y) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    ctx.closePath();
  }

  drawShadow(ctx) {
    const off = 5 + this.depth * 10;
    ctx.save();
    ctx.translate(off, off * 1.3);
    ctx.fillStyle = 'rgba(0, 12, 16, 0.22)';
    this.bodyPath(ctx);
    ctx.fill();
    ctx.restore();
  }

  drawFin(ctx, d, side, len, width, spread, flap) {
    const ang = Math.atan2(d.dy, d.dx) + Math.PI + side * (spread + flap);
    const bx = d.x + d.nx * side * d.w * 0.6;
    const by = d.y + d.ny * side * d.w * 0.6;
    ctx.beginPath();
    ctx.ellipse(bx + Math.cos(ang) * len * 0.45, by + Math.sin(ang) * len * 0.45, len * 0.5, width, ang, 0, TAU);
    ctx.fill();
  }

  drawTail(ctx) {
    const d = this.disp[KOI_SEGMENTS - 1];
    const ang = Math.atan2(-d.dy, -d.dx) + Math.sin(this.phase - 5.6) * 0.35;
    const tl = this.length * 0.26;
    const tip = (a, r) => ({ x: d.x + Math.cos(ang + a) * tl * r, y: d.y + Math.sin(ang + a) * tl * r });
    const l1 = tip(0.5, 1);
    const l2 = tip(-0.5, 1);
    const notch = tip(0, 0.55);
    const c1 = tip(0.28, 0.9);
    const c2 = tip(-0.28, 0.9);

    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.quadraticCurveTo(tip(0.42, 0.45).x, tip(0.42, 0.45).y, l1.x, l1.y);
    ctx.quadraticCurveTo(c1.x, c1.y, notch.x, notch.y);
    ctx.quadraticCurveTo(c2.x, c2.y, l2.x, l2.y);
    ctx.quadraticCurveTo(tip(-0.42, 0.45).x, tip(-0.42, 0.45).y, d.x, d.y);
    ctx.fill();

    // Fin rays.
    ctx.save();
    ctx.globalAlpha *= 0.35;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) {
      const p = tip(k * 0.13, 0.8);
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx) {
    const d = this.disp;
    const v = this.variety;
    const L = this.length;
    const flap = Math.sin(this.phase * 0.6) * 0.25;

    ctx.save();
    ctx.globalAlpha = 0.8 + this.depth * 0.18;

    // Fins sit under the body.
    ctx.fillStyle = v.fin;
    ctx.strokeStyle = v.base;
    this.drawFin(ctx, d[3], 1, L * 0.2, L * 0.05, 1.05, flap);
    this.drawFin(ctx, d[3], -1, L * 0.2, L * 0.05, 1.05, flap);
    this.drawFin(ctx, d[9], 1, L * 0.1, L * 0.028, 0.9, -flap * 0.6);
    this.drawFin(ctx, d[9], -1, L * 0.1, L * 0.028, 0.9, -flap * 0.6);
    this.drawTail(ctx);

    // Body and pattern.
    this.bodyPath(ctx);
    ctx.fillStyle = v.base;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (const s of this.spots) {
      const f = s.s * (KOI_SEGMENTS - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(KOI_SEGMENTS - 1, i0 + 1);
      const u = f - i0;
      const a = d[i0];
      const b = d[i1];
      const w = this.halfWidth(s.s);
      const cx = lerp(a.x, b.x, u) + a.nx * s.o * w;
      const cy = lerp(a.y, b.y, u) + a.ny * s.o * w;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s.rx * L, s.ry * L, Math.atan2(a.dy, a.dx), 0, TAU);
      ctx.fill();
    }

    // Rounded-back highlight along the spine and a soft dark rim.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = this.maxHalfWidth * 0.7;
    ctx.beginPath();
    ctx.moveTo(d[1].x, d[1].y);
    for (let i = 2; i < KOI_SEGMENTS - 3; i++) ctx.lineTo(d[i].x, d[i].y);
    ctx.stroke();
    this.bodyPath(ctx);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Dorsal fin ridge.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(d[4].x, d[4].y);
    for (let i = 5; i <= 10; i++) ctx.lineTo(d[i].x, d[i].y);
    ctx.stroke();

    // Eyes.
    const h = d[0];
    ctx.fillStyle = '#111';
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.arc(
        h.x + h.dx * h.w * 0.35 + h.nx * side * h.w * 0.62,
        h.y + h.dy * h.w * 0.35 + h.ny * side * h.w * 0.62,
        Math.max(1.2, L * 0.012), 0, TAU
      );
      ctx.fill();
    }
    ctx.restore();
  }
}
