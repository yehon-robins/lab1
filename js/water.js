// Water surface: a low-resolution height field running the classic two-buffer
// wave equation, shaded into two images each frame:
//   - `canvas`     opaque pond bottom with caustics and slope lighting (drawn under the fish)
//   - `specCanvas` transparent surface glints (drawn over the fish)
// Cells outside the pond are masked to zero, so waves reflect off the shore.
class Water {
  constructor(scale = 4) {
    this.scale = scale;     // CSS pixels per simulation cell
    this.damping = 0.982;
  }

  resize(width, height, pond) {
    const s = this.scale;
    const cols = (this.cols = Math.ceil(width / s) + 1);
    const rows = (this.rows = Math.ceil(height / s) + 1);
    const n = cols * rows;

    this.cur = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.mask = new Float32Array(n);
    this.baseR = new Float32Array(n);
    this.baseG = new Float32Array(n);
    this.baseB = new Float32Array(n);
    this.shallow = new Float32Array(n);
    this.colT = new Float32Array(cols);
    this.rowT = new Float32Array(rows);

    // Pond bottom: dark green-teal in the deep middle, olive-brown silt in the shallows,
    // with large mottled patches and fine grain.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const dist = pond.shoreDist(x * s, y * s);
        this.mask[i] = dist > -6 && x > 0 && y > 0 && x < cols - 1 && y < rows - 1 ? 1 : 0;
        const sh = Math.pow(1 - smoothstep(0, 130, dist), 1.3);
        const mott = Math.sin(x * 0.07 + Math.sin(y * 0.04) * 2) * Math.sin(y * 0.06 + Math.sin(x * 0.035) * 2) * 0.5 + 0.5;
        const grain = (hash2(x, y) - 0.5) * 6;
        this.shallow[i] = sh;
        this.baseR[i] = lerp(16, 84, sh) + mott * 10 * (0.4 + sh) + grain;
        this.baseG[i] = lerp(46, 90, sh) + mott * 11 * (0.4 + sh) + grain;
        this.baseB[i] = lerp(46, 58, sh) + mott * 6 * (0.4 + sh) + grain;
      }
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = cols;
    this.canvas.height = rows;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(cols, rows);

    this.specCanvas = document.createElement('canvas');
    this.specCanvas.width = cols;
    this.specCanvas.height = rows;
    this.specCtx = this.specCanvas.getContext('2d');
    this.specImg = this.specCtx.createImageData(cols, rows);

    // Fill once so masked cells have sane colours; glints are white, only alpha changes.
    const d = this.img.data;
    const sd = this.specImg.data;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      d[p] = this.baseR[i];
      d[p + 1] = this.baseG[i];
      d[p + 2] = this.baseB[i];
      d[p + 3] = 255;
      sd[p] = sd[p + 1] = sd[p + 2] = 255;
      sd[p + 3] = 0;
    }
  }

  // Push the surface down/up around a point given in CSS pixels.
  disturb(px, py, radius, strength) {
    const s = this.scale;
    const cx = px / s;
    const cy = py / s;
    const r = Math.max(1.5, radius / s);
    const x0 = Math.max(1, Math.floor(cx - r));
    const x1 = Math.min(this.cols - 2, Math.ceil(cx + r));
    const y0 = Math.max(1, Math.floor(cy - r));
    const y1 = Math.min(this.rows - 2, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * this.cols + x;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < r) this.cur[i] += strength * 0.5 * (1 + Math.cos((Math.PI * dist) / r)) * this.mask[i];
      }
    }
  }

  // Tiny constant agitation plus the occasional insect/drip so the pond never goes glassy.
  ambient() {
    const { cols, rows, cur, mask } = this;
    for (let k = 0; k < 14; k++) {
      const i = Math.floor(Math.random() * cols * rows);
      cur[i] += (Math.random() - 0.5) * 0.3 * mask[i];
    }
    if (Math.random() < 0.012) {
      this.disturb(Math.random() * cols * this.scale, Math.random() * rows * this.scale, 7, 1.4);
    }
  }

  step() {
    const { cols, rows, damping, mask } = this;
    const a = this.cur;
    const b = this.prev;
    for (let y = 1; y < rows - 1; y++) {
      let i = y * cols + 1;
      for (let x = 1; x < cols - 1; x++, i++) {
        b[i] = ((a[i - 1] + a[i + 1] + a[i - cols] + a[i + cols]) * 0.5 - b[i]) * damping * mask[i];
      }
    }
    this.cur = b;
    this.prev = a;
  }

  render(t) {
    const { cols, rows, cur, colT, rowT, baseR, baseG, baseB, shallow, mask } = this;
    const d = this.img.data;
    const sd = this.specImg.data;

    for (let x = 0; x < cols; x++) colT[x] = Math.sin(x * 0.045 - t * 0.35) * 1.6;
    for (let y = 0; y < rows; y++) rowT[y] = Math.sin(y * 0.05 + t * 0.3) * 1.6;

    const t1 = t * 0.9;
    const t2 = t * 0.7;
    for (let y = 1; y < rows - 1; y++) {
      const ry = rowT[y];
      let i = y * cols + 1;
      for (let x = 1; x < cols - 1; x++, i++) {
        if (mask[i] === 0) continue;
        const dx = cur[i + 1] - cur[i - 1];
        const dy = cur[i + cols] - cur[i - cols];

        // Caustic web: two warped wave trains, bright where they cancel. Ripples bend it.
        const c1 = Math.sin(x * 0.16 + ry + t1 + dx * 0.7);
        const c2 = Math.sin(y * 0.17 + colT[x] - t2 + dy * 0.7);
        let caus = 1 - Math.abs(c1 + c2) * 0.5;
        caus *= caus;
        caus *= caus;

        const slope = -dx - dy;
        const swell = colT[x] * ry * 1.5;
        const light = slope * 7 + swell;
        const k = (0.25 + shallow[i] * 0.4) * caus;

        const p = i * 4;
        d[p] = baseR[i] + k * 52 + light;
        d[p + 1] = baseG[i] + k * 60 + light;
        d[p + 2] = baseB[i] + k * 36 + light;
        sd[p + 3] = slope > 0.6 ? (slope - 0.6) * 85 : 0;
      }
    }

    this.ctx.putImageData(this.img, 0, 0);
    this.specCtx.putImageData(this.specImg, 0, 0);
  }

  drawBottom(ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, 0, 0, this.cols * this.scale, this.rows * this.scale);
  }

  drawGlints(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.specCanvas, 0, 0, this.cols * this.scale, this.rows * this.scale);
    ctx.restore();
  }
}
