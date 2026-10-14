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
  let pond = null;
  let land = null;
  let flora = null;
  let fish = [];
  let pads = [];
  let petals = [];
  let gusts = [];
  let sky = null;
  let shark = null;
  let vignette = null;

  function buildVignette() {
    vignette = document.createElement('canvas');
    vignette.width = W;
    vignette.height = H;
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(8,12,6,0.38)');
    v.fillStyle = g;
    v.fillRect(0, 0, W, H);
  }

  // Build (or rebuild after a resize) the pond and everything tied to its shape.
  function setup() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const firstRun = !pond;
    pond = new Pond(W, H, pond && pond.harmonics);
    water.resize(W, H, pond);
    land = paintLand(pond, W, H, dpr);
    flora = new Flora(pond, W, H, dpr);
    sky = new NightSky(pond);
    buildVignette();
    gusts = [];
    shark = null;

    // As many koi as lily pads.
    const count = clamp(Math.round(pond.area / 40000), 8, 22);
    if (firstRun) {
      const minDim = Math.min(pond.rx, pond.ry) * 2;
      for (let k = 0; k < count; k++) {
        const p = pond.randomInside(80);
        fish.push(new Koi(p.x, p.y, clamp(minDim * rand(0.09, 0.14), 50, 140)));
      }
      fish.sort((a, b) => a.depth - b.depth); // deeper fish drawn first
    } else {
      for (const f of fish) for (const p of f.points) pond.clampInside(p, 0.9);
    }
    pads = makeLilyPads(pond, fish.length);
    petals = [];
    for (let k = 0; k < 18; k++) petals.push(new Petal(pond));
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
      koi.scatter(pond);
      water.disturb(koi.head.x, koi.head.y, 24, 6);
      gusts.push(new Gust(W, H, rand(0.9, 1.2)));
      hud.hint.classList.add('hidden');
    } else if (pond.norm(x, y) < 1) {
      water.disturb(x, y, 14, 3); // tapping open water just makes a ripple
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = fishAt(e.clientX, e.clientY) ? 'pointer' : 'default';
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 150);
  });

  // ---------- Simulation ----------
  const STEP = 1 / 60;
  let elapsed = DAY_LENGTH * 0.06; // start in the early morning
  let acc = 0;
  let last = performance.now();
  let lastClock = '';
  let nextShark = elapsed + rand(12, 20);
  let nextBreeze = elapsed + rand(8, 16);

  function waterStep() {
    water.ambient();
    for (const f of fish) water.disturb(f.head.x, f.head.y, f.length * 0.1, 0.04 + f.speed * 0.0011);
    for (const g of gusts) g.ruffle(water);
    water.step();
  }

  function update(dt) {
    // Occasional breezes on their own, from any direction.
    if (elapsed > nextBreeze) {
      gusts.push(new Gust(W, H, rand(0.4, 0.75)));
      nextBreeze = elapsed + rand(14, 30);
    }
    if (!shark && elapsed > nextShark) shark = new Shark(pond);
    if (shark) {
      shark.update(dt, elapsed, water);
      if (shark.done) {
        shark = null;
        nextShark = elapsed + rand(35, 70);
      }
    }

    const threats = shark && shark.visibility > 0.25 ? [shark] : [];
    for (const f of fish) f.update(dt, elapsed, pond, fish, threats);
    for (const g of gusts) g.update(dt, elapsed);
    gusts = gusts.filter((g) => !g.done);
    for (const p of pads) p.update(dt, elapsed, pond, gusts, pads);
    for (const p of petals) p.update(dt, elapsed, pond, gusts);
    sky.update(dt, elapsed);
  }

  function render(day) {
    const sun = day.sun;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Under water.
    water.render(elapsed);
    water.drawBottom(ctx);
    flora.drawWeeds(ctx, elapsed);
    if (shark) shark.drawShadow(ctx, sun);
    for (const f of fish) f.drawShadow(ctx, sun);
    if (shark) shark.draw(ctx);
    for (const f of fish) f.draw(ctx);
    water.drawGlints(ctx, 0.4 + 0.5 * day.daylight);

    // On the surface, then the banks, then what grows over them.
    for (const p of petals) p.draw(ctx, sun);
    for (const p of pads) p.draw(ctx, sun);
    ctx.drawImage(land, 0, 0, W, H);
    flora.drawTufts(ctx, elapsed, sun, gusts);
    flora.drawTreeShadows(ctx, elapsed, sun, gusts);
    flora.drawTrees(ctx, elapsed, gusts);
    for (const g of gusts) g.draw(ctx);

    // Time-of-day light: tint everything, then add warm low sun near sunrise/sunset.
    const [r, g, b] = day.sky;
    if (r < 254 || g < 254 || b < 254) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (day.golden > 0.02) {
      const sx = day.sunFromRight ? W * 1.1 : -W * 0.1;
      const glow = ctx.createRadialGradient(sx, H * 0.35, 0, sx, H * 0.35, Math.max(W, H) * 1.1);
      glow.addColorStop(0, `rgba(255,170,90,${0.22 * day.golden})`);
      glow.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';

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

  setup();
  requestAnimationFrame(frame);
})();
