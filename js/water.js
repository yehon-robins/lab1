// Water surface: a low-resolution height field running the classic two-buffer
// wave equation, shaded into two images each frame:
//   - `canvas`     opaque pond bottom with caustics and slope lighting (drawn under the fish)
//   - `specCanvas` transparent surface glints (drawn over the fish)
class Water {
  constructor(scale = 4) {
    this.scale = scale;     // CSS pixels per simulation cell
    this.damping = 0.982;
  }

  resize(width, height) {
    const s = this.scale;
    const cols = (this.cols = Math.ceil(width / s) + 1);
    const rows = (this.rows = Math.ceil(height / s) + 1);
    const n = cols * rows;

    this.cur = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.baseR = new Float32Array(n);
    this.baseG = new Float32Array(n);
    this.baseB = new Float32Array(n);
    this.shallow = new Float32Array(n);
    this.colT = new Float32Array(cols);
    this.rowT = new Float32Array(rows);

    // Pond bottom: deep teal in the middle, sandy-green shallows at the rim,
    // with large mottled patches and fine pebble grain.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const nx = (x / (cols - 1)) * 2 - 1;
        const ny = (y / (rows - 1)) * 2 - 1;
        const d = Math.max(Math.abs(nx), Math.abs(ny)) * 0.6 + (Math.hypot(nx, ny) / Math.SQRT2) * 0.4;
        const sh = smoothstep(0.5, 1.0, d);
        const mott = Math.sin(x * 0.07 + Math.sin(y * 0.04) * 2) * Math.sin(y * 0.06 + Math.sin(x * 0.035) * 2) * 0.5 + 0.5;
        const grain = (hash2(x, y) - 0.5) * 7;
        this.shallow[i] = sh;
        this.baseR[i] = lerp(10, 62, sh) + mott * 9 * (0.4 + sh) + grain;
        this.baseG[i] = lerp(52, 106, sh) + mott * 12 * (0.4 + sh) + grain;
        this.baseB[i] = lerp(64, 86, sh) + mott * 7 * (0.4 + sh) + grain;
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

    // Fill once so the untouched 1-cell border has sane colours; glints are white, only alpha changes.
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
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < r) this.cur[y * this.cols + x] += strength * 0.5 * (1 + Math.cos((Math.PI * dist) / r));
      }
    }
  }

  // Tiny constant agitation plus the occasional insect/drip so the pond never goes glassy.
  ambient() {
    const { cols, rows, cur } = this;
    for (let k = 0; k < 14; k++) {
      const x = 1 + Math.floor(Math.random() * (cols - 2));
      const y = 1 + Math.floor(Math.random() * (rows - 2));
      cur[y * cols + x] += (Math.random() - 0.5) * 0.3;
    }
    if (Math.random() < 0.012) {
      this.disturb(Math.random() * cols * this.scale, Math.random() * rows * this.scale, 7, 1.4);
    }
  }

  step() {
    const { cols, rows, damping } = this;
    const a = this.cur;
    const b = this.prev;
    for (let y = 1; y < rows - 1; y++) {
      let i = y * cols + 1;
      for (let x = 1; x < cols - 1; x++, i++) {
        b[i] = ((a[i - 1] + a[i + 1] + a[i - cols] + a[i + cols]) * 0.5 - b[i]) * damping;
      }
    }
    this.cur = b;
    this.prev = a;
  }

  render(t) {
    const { cols, rows, cur, colT, rowT, baseR, baseG, baseB, shallow } = this;
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
        const dx = cur[i + 1] - cur[i - 1];
        const dy = cur[i + cols] - cur[i - cols];

        // Caustic web: two warped wave trains, bright where they cancel. Ripples bend it.
        const c1 = Math.sin(x * 0.16 + ry + t1 + dx * 0.7);
        const c2 = Math.sin(y * 0.17 + colT[x] - t2 + dy * 0.7);
        let caus = 1 - Math.abs(c1 + c2) * 0.5;
        caus *= caus;
        caus *= caus;

        const slope = -dx - dy;
        const swell = colT[x] * ry * 1.8;
        const light = slope * 7 + swell;
        const k = (0.35 + shallow[i] * 0.65) * caus;

        const p = i * 4;
        d[p] = baseR[i] + k * 58 + light;
        d[p + 1] = baseG[i] + k * 74 + light;
        d[p + 2] = baseB[i] + k * 56 + light;
        sd[p + 3] = slope > 0.6 ? (slope - 0.6) * 90 : 0;
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
