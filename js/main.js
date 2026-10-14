// Entry point: sets up the canvas, owns the simulation state and runs the frame loop.
// Everything runs client-side; there is no network access of any kind.
(() => {
  const canvas = document.getElementById('pond');
  const ctx = canvas.getContext('2d');
  const hud = {
    phase: document.getElementById('phase'),
    time: document.getElementById('time'),
    fill: document.getElementById('cycle-fill'),
    hint: document.getElementById('hint'),
  };

  const water = new Water(4);
  let W = 0;
  let H = 0;
  let fish = [];
  let pads = [];
  let petals = [];
  let gusts = [];
  let sky = null;
  let vignette = null;

  function buildVignette() {
    vignette = document.createElement('canvas');
    vignette.width = W;
    vignette.height = H;
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,10,12,0.5)');
    v.fillStyle = g;
    v.fillRect(0, 0, W, H);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    water.resize(W, H);
    buildVignette();
    if (sky) sky.resize(W, H);
  }

  function populate() {
    const count = clamp(Math.round((W * H) / 110000), 6, 14);
    const minDim = Math.min(W, H);
    fish = [];
    for (let k = 0; k < count; k++) {
      const len = clamp(minDim * rand(0.11, 0.17), 60, 170);
      fish.push(new Koi(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.8), len));
    }
    fish.sort((a, b) => a.depth - b.depth); // deeper fish drawn first

    pads = [];
    for (let k = 0; k < clamp(Math.round((W * H) / 200000), 4, 9); k++) pads.push(new LilyPad(W, H));
    petals = [];
    for (let k = 0; k < 16; k++) petals.push(new Petal(W, H));
    sky = new NightSky(W, H);
  }

  // ---------- Input ----------
  function fishAt(x, y) {
    for (let i = fish.length - 1; i >= 0; i--) if (fish[i].hitTest(x, y)) return fish[i];
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const koi = fishAt(x, y);
    if (koi) {
      koi.scatter(W, H);
      water.disturb(koi.head.x, koi.head.y, 24, 6);
      gusts.push(new Gust(W, H));
      hud.hint.classList.add('hidden');
    } else {
      water.disturb(x, y, 14, 3); // tapping open water just makes a ripple
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = fishAt(e.clientX, e.clientY) ? 'pointer' : 'default';
  });

  window.addEventListener('resize', () => {
    resize();
    for (const f of fish) for (const p of f.points) { p.x = clamp(p.x, 5, W - 5); p.y = clamp(p.y, 5, H - 5); }
  });

  // ---------- Simulation ----------
  const STEP = 1 / 60;
  let elapsed = DAY_LENGTH * 0.06; // start in the early morning
  let acc = 0;
  let last = performance.now();
  let lastClock = '';

  function waterStep() {
    water.ambient();
    for (const f of fish) water.disturb(f.head.x, f.head.y, f.length * 0.1, 0.04 + f.speed * 0.0011);
    for (const g of gusts) g.ruffle(water, W, H);
    water.step();
  }

  function update(dt) {
    for (const f of fish) f.update(dt, elapsed, W, H, fish);
    for (const g of gusts) g.update(dt);
    gusts = gusts.filter((g) => !g.done);
    for (const p of pads) p.update(dt, elapsed, W, H, gusts, pads);
    for (const p of petals) p.update(dt, elapsed, W, H, gusts);
    sky.update(dt, elapsed);
  }

  function render(day) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    water.render(elapsed);
    water.drawBottom(ctx);
    for (const f of fish) f.drawShadow(ctx);
    for (const f of fish) f.draw(ctx);
    water.drawGlints(ctx, 0.45 + 0.55 * day.daylight);
    for (const g of gusts) g.draw(ctx, elapsed);
    for (const p of petals) p.draw(ctx);
    for (const p of pads) p.draw(ctx);

    // Time-of-day tint over the whole scene.
    const [r, g, b] = day.sky;
    if (r < 254 || g < 254 || b < 254) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    sky.draw(ctx, elapsed, day.night);
    ctx.drawImage(vignette, 0, 0, W, H);
  }

  function updateHud(day) {
    if (day.clock !== lastClock) {
      lastClock = day.clock;
      hud.time.textContent = day.clock;
      hud.phase.textContent = day.phase;
    }
    hud.fill.style.width = `${(day.t * 100).toFixed(2)}%`;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      waterStep();
      acc -= STEP;
      steps++;
    }
    if (steps === 4) acc = 0;

    update(dt);
    const day = dayInfo(elapsed);
    render(day);
    updateHud(day);
    requestAnimationFrame(frame);
  }

  resize();
  populate();
  requestAnimationFrame(frame);
})();
