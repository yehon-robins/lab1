# Koi Pond

An interactive, top-down koi pond that runs entirely in the browser — no server, no backend, no database, no API keys, no network requests.

## Run

Open `index.html` in any modern browser (double-click works; the scripts are plain classic scripts, so `file://` is fine).

## What it does

- **Living water** — a wave-equation height field with moving caustics, slope lighting and surface glints. Fish leave wakes; tapping open water makes a ripple.
- **Koi** — several varieties (kohaku, sanke, showa, ogon, tancho, …) with flexible bodies, flapping fins and a swaying tail.
- **Click a koi** — it darts off in a random new direction, and a breeze sweeps across the pond, ruffling the water and pushing lily pads and petals along.
- **Day–night cycle** — one full day every 4 minutes: dawn, daylight, sunset, then night with a shimmering moon reflection, reflected stars and fireflies.

## Files

- `js/water.js` — height-field simulation and water shading
- `js/koi.js` — fish movement and drawing
- `js/scene.js` — wind gusts, lily pads, petals, day/night colours, night lights
- `js/main.js` — canvas setup, input and the frame loop
