# Koi Pond

An interactive, top-down koi pond that runs entirely in the browser — no server, no backend, no database, no API keys, no network requests.

## Run

Open `index.html` in any modern browser (double-click works; the scripts are plain classic scripts, so `file://` is fine).

## What it does

- **A natural pond** — an irregular pond set in grass and earth banks, with rocks, bushes, reeds, overhanging trees and weed swaying under the water.
- **Living water** — a wave-equation height field with moving caustics, slope lighting and surface glints. Waves reflect off the shore, fish leave wakes, and tapping open water makes a ripple.
- **Koi** — several varieties (kohaku, sanke, showa, ogon, tancho, …) with flexible bodies, flapping fins and a swaying tail.
- **Click a koi** — it darts off in a random new direction, and a breeze sweeps across the pond as wavy, meandering wind lines that ruffle the water and push lily pads, petals, reeds and trees. Gentle breezes also come and go on their own.
- **The shark** — every so often a large shark glides across the pond on a slow S-curve, rising from the murk, cutting the surface with its fin, and sinking away. The koi move out of its path.
- **Day–night cycle** — one full day every 2 minutes, with shadows that follow the sun, golden light at sunrise and sunset, and a night of moon and star reflections on the water and fireflies along the banks.

## Files

- `js/pond.js` — pond shape, the painted land around it, and animated plants
- `js/water.js` — height-field simulation and water shading
- `js/koi.js` — fish movement and drawing
- `js/shark.js` — the occasional passing shark
- `js/scene.js` — wind, lily pads, petals, day/night light and shadows, night lights
- `js/main.js` — canvas setup, input and the frame loop
