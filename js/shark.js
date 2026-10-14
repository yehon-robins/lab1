// A large shark that now and then glides across the pond along a slow S-curve:
// it rises out of the murk on one side, passes close to the surface mid-pond
// (dorsal fin cutting a wake), and sinks away again on the far side.
const SHARK_SEGMENTS = 22;

class Shark {
  constructor(pond) {
    this.length = clamp(Math.min(pond.rx, pond.ry) * 0.95, 170, 430);
    this.maxHalf = this.length * 0.08;
    this.segLen = this.length / (SHARK_SEGMENTS - 1);

    // Cross along the pond's long axis, in a random direction.
    const across = pond.rx >= pond.ry ? Math.PI : -Math.PI / 2;
    const flip = Math.random() < 0.5 ? 0 : Math.PI;
    const start = pond.point(across + flip + rand(-0.3, 0.3), 0.86);
    const end = pond.point(across + flip + Math.PI + rand(-0.3, 0.3), 0.86);

    const ex = end.x - start.x;
    const ey = end.y - start.y;
    const span = Math.hypot(ex, ey) || 1;
    const nx = -ey / span;
    const ny = ex / span;
    const o1 = rand(-1, 1) * span * 0.2;
    const o2 = -o1 * rand(0.5, 1);
    const c1 = { x: start.x + ex * 0.33 + nx * o1, y: start.y + ey * 0.33 + ny * o1 };
    const c2 = { x: start.x + ex * 0.67 + nx * o2, y: start.y + ey * 0.67 + ny * o2 };
    pond.clampInside(c1, 0.75);
    pond.clampInside(c2, 0.75);

    // Arc-length table so the shark moves at an even pace along the curve.
    this.samples = [];
    let len = 0;
    let prev = start;
    for (let i = 0; i <= 240; i++) {
      const u = i / 240;
      const v = 1 - u;
      const p = {
        x: v * v * v * start.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * end.x,
        y: v * v * v * start.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * end.y,
      };
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      p.len = len;
      this.samples.push(p);
      prev = p;
    }
    this.total = len;
    this.s = 0;
    this.idx = 0;
    this.speed = rand(58, 76);
    this.phase = rand(0, TAU);
    this.visibility = 0;
    this.rise = 0;
    this.done = false;

    // Body starts trailing straight back from the entry point.
    const bx = start.x - c1.x;
    const by = start.y - c1.y;
    const bl = Math.hypot(bx, by) || 1;
    this.points = [];
    this.disp = [];
    for (let i = 0; i < SHARK_SEGMENTS; i++) {
      this.points.push({ x: start.x + (bx / bl) * this.segLen * i, y: start.y + (by / bl) * this.segLen * i });
      this.disp.push({ x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0, w: 0 });
    }
    this.computeDisplay();
  }

  pointAt(s) {
    const S = this.samples;
    while (this.idx < S.length - 2 && S[this.idx + 1].len < s) this.idx++;
    const a = S[this.idx];
    const b = S[this.idx + 1];
    const u = clamp((s - a.len) / (b.len - a.len || 1), 0, 1);
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }

  halfWidth(t) {
    const m = this.maxHalf;
    if (t < 0.28) return m * (0.04 + 0.96 * Math.pow(t / 0.28, 0.6));
    if (t < 0.9) return m * (1 - 0.85 * Math.pow((t - 0.28) / 0.62, 1.6));
    return m * 0.15 * (1 - ((t - 0.9) / 0.1) * 0.4);
  }

  update(dt, t, water) {
    this.s += this.speed * (0.9 + 0.1 * Math.sin(t * 0.4)) * dt;
    const u = this.s / this.total;
    if (u >= 1) { this.done = true; return; }

    const head = this.points[0];
    const p = this.pointAt(this.s);
    head.x = p.x;
    head.y = p.y;
    for (let i = 1; i < SHARK_SEGMENTS; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      b.x = a.x + (dx / l) * this.segLen;
      b.y = a.y + (dy / l) * this.segLen;
    }

    this.phase += dt * 1.7;
    this.visibility = smoothstep(0, 0.14, u) * (1 - smoothstep(0.84, 1, u));
    this.rise = Math.pow(Math.sin(u * Math.PI), 2);
    this.computeDisplay();

    water.disturb(head.x, head.y, this.length * 0.06, 0.06 * this.visibility);
    if (this.rise > 0.72) {
      const fin = this.disp[Math.round(SHARK_SEGMENTS * 0.4)];
      water.disturb(fin.x, fin.y, 9, (this.rise - 0.72) * 2.2 * this.visibility);
    }
  }

  computeDisplay() {
    const N = SHARK_SEGMENTS;
    const amp = this.length * 0.03;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const a = this.points[Math.max(0, i - 1)];
      const b = this.points[Math.min(N - 1, i + 1)];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const off = Math.sin(this.phase - t * 4) * amp * (t * t * 1.1 + 0.03);
      const d = this.disp[i];
      d.x = this.points[i].x - dy * off;
      d.y = this.points[i].y + dx * off;
      d.nx = -dy;
      d.ny = dx;
      d.dx = dx;
      d.dy = dy;
      d.w = this.halfWidth(t);
    }
  }

  at(t) { return this.disp[Math.round(t * (SHARK_SEGMENTS - 1))]; }

  bodyPath(ctx) {
    const d = this.disp;
    const h = d[0];
    ctx.beginPath();
    ctx.moveTo(h.x + h.dx * this.maxHalf * 0.35, h.y + h.dy * this.maxHalf * 0.35);
    for (let i = 0; i < d.length; i++) ctx.lineTo(d[i].x + d[i].nx * d[i].w, d[i].y + d[i].ny * d[i].w);
    for (let i = d.length - 1; i >= 0; i--) ctx.lineTo(d[i].x - d[i].nx * d[i].w, d[i].y - d[i].ny * d[i].w);
    ctx.closePath();
  }

  finsPath(ctx) {
    const L = this.length;
    const flap = Math.sin(this.phase * 0.5) * 0.08;
    // Pectoral and pelvic fins: swept-back blades.
    for (const [t0, t1, len, sweep] of [[0.26, 0.36, L * 0.21, 0.95], [0.6, 0.66, L * 0.08, 0.8]]) {
      const a = this.at(t0);
      const b = this.at(t1);
      for (const side of [1, -1]) {
        const ang = Math.atan2(-a.dy, -a.dx) - side * (sweep + flap);
        const ax = a.x + a.nx * side * a.w * 0.9;
        const ay = a.y + a.ny * side * a.w * 0.9;
        const tx = ax + Math.cos(ang) * len;
        const ty = ay + Math.sin(ang) * len;
        const bx = b.x + b.nx * side * b.w * 0.9;
        const by = b.y + b.ny * side * b.w * 0.9;
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(ax + a.nx * side * len * 0.55, ay + a.ny * side * len * 0.55, tx, ty);
        ctx.quadraticCurveTo((tx + bx) / 2 - a.nx * side * len * 0.1, (ty + by) / 2 - a.ny * side * len * 0.1, bx, by);
        ctx.closePath();
      }
    }
    // Tail: long upper lobe trailing behind.
    const e = this.disp[SHARK_SEGMENTS - 1];
    const ang = Math.atan2(-e.dy, -e.dx) + Math.sin(this.phase - 4.4) * 0.3;
    const tl = L * 0.2;
    const tw = this.maxHalf * 0.45;
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    ctx.moveTo(e.x, e.y);
    ctx.quadraticCurveTo(e.x + cx * tl * 0.5 - cy * tw, e.y + cy * tl * 0.5 + cx * tw, e.x + cx * tl, e.y + cy * tl);
    ctx.quadraticCurveTo(e.x + cx * tl * 0.5 + cy * tw * 0.6, e.y + cy * tl * 0.5 - cx * tw * 0.6, e.x, e.y);
    ctx.closePath();
  }

  drawShadow(ctx, sun) {
    if (this.visibility <= 0) return;
    const off = 8 + this.rise * 16;
    ctx.save();
    ctx.translate(sun.x * off, sun.y * off);
    ctx.fillStyle = `rgba(0,10,12,${sun.alpha * this.visibility * 1.2})`;
    this.bodyPath(ctx);
    ctx.fill();
    ctx.beginPath();
    this.finsPath(ctx);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    if (this.visibility <= 0) return;
    const L = this.length;
    ctx.save();
    ctx.globalAlpha = this.visibility * (0.5 + 0.42 * this.rise);

    ctx.fillStyle = '#56636d';
    ctx.beginPath();
    this.finsPath(ctx);
    ctx.fill();

    this.bodyPath(ctx);
    ctx.fillStyle = '#6c7a84';
    ctx.fill();

    ctx.save();
    ctx.clip();
    // Countershading: darker along the back, lighter flanks.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.disp[1].x, this.disp[1].y);
    for (let i = 2; i < SHARK_SEGMENTS; i++) ctx.lineTo(this.disp[i].x, this.disp[i].y);
    ctx.strokeStyle = 'rgba(40,50,58,0.55)';
    ctx.lineWidth = this.maxHalf * 1.1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,38,45,0.4)';
    ctx.lineWidth = this.maxHalf * 0.45;
    ctx.stroke();
    this.bodyPath(ctx);
    ctx.strokeStyle = 'rgba(190,205,212,0.25)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Gill slits.
    ctx.strokeStyle = 'rgba(30,38,44,0.35)';
    ctx.lineWidth = 1;
    for (const side of [1, -1]) {
      for (let k = 0; k < 5; k++) {
        const p = this.at(0.2 + k * 0.018);
        const x = p.x + p.nx * side * p.w * 0.75;
        const y = p.y + p.ny * side * p.w * 0.75;
        ctx.beginPath();
        ctx.moveTo(x - p.dx * 2, y - p.dy * 2);
        ctx.lineTo(x - p.nx * side * p.w * 0.25, y - p.ny * side * p.w * 0.25);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Murk: the deeper it swims, the more the water colour swallows it.
    ctx.globalAlpha = this.visibility * (1 - this.rise) * 0.45;
    ctx.fillStyle = '#1b3a3a';
    this.bodyPath(ctx);
    ctx.fill();
    ctx.globalAlpha = this.visibility * (0.5 + 0.42 * this.rise);

    // Eyes.
    const h = this.at(0.07);
    ctx.fillStyle = '#111';
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.arc(h.x + h.nx * side * h.w * 0.8, h.y + h.ny * side * h.w * 0.8, Math.max(1.2, L * 0.006), 0, TAU);
      ctx.fill();
    }

    // Dorsal fins seen from above: thin dark blades, catching light when they break the surface.
    for (const [t0, t1, wid] of [[0.34, 0.47, 0.28], [0.7, 0.75, 0.12]]) {
      const a = this.at(t0);
      const b = this.at(t1);
      const w = this.maxHalf * wid;
      ctx.fillStyle = '#323d46';
      ctx.beginPath();
      ctx.moveTo(a.x + a.nx * w, a.y + a.ny * w);
      ctx.quadraticCurveTo(b.x + b.nx * w * 0.3, b.y + b.ny * w * 0.3, b.x - b.dx * w * 2.2, b.y - b.dy * w * 2.2);
      ctx.quadraticCurveTo(b.x - b.nx * w * 0.3, b.y - b.ny * w * 0.3, a.x - a.nx * w, a.y - a.ny * w);
      ctx.closePath();
      ctx.fill();
      if (this.rise > 0.72) {
        ctx.strokeStyle = `rgba(225,235,240,${(this.rise - 0.72) * 1.2})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(b.x - b.dx * w * 2.2, b.y - b.dy * w * 2.2);
        ctx.quadraticCurveTo(b.x + b.nx * w * 0.3, b.y + b.ny * w * 0.3, a.x + a.nx * w, a.y + a.ny * w);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
