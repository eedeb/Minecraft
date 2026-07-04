# ⛏ WebCraft — Minecraft in your browser

A 3D Minecraft clone that runs entirely in the browser. No build step, no dependencies to install — just static HTML/JS (Three.js loaded from a CDN), so it works out of the box on GitHub Pages.

## Features

- **Infinite procedural terrain** — seeded Perlin-noise world with rolling plains, forests, deserts, beaches, oceans, and snow-capped mountains
- **Caves & ores** — winding tunnel systems with coal, iron, and diamond ore
- **Mining & building** — break any block, place 9 block types from the hotbar (creative-style)
- **Mobs** — pigs, sheep, and cows wander the world; zombies spawn at night, chase you, and burn at dawn
- **Day/night cycle** — moving sun and moon, stars, sunsets, and fog that matches the sky
- **Survival elements** — health, fall damage, zombie attacks with knockback, drowning-free swimming, death & respawn
- **Physics** — gravity, jumping, swimming, sprinting, and creative flight
- **World persistence** — your edits, position, and time of day auto-save to `localStorage`
- **Juice** — block-break particles, procedural sound effects, ambient-occlusion shading, held-block viewmodel, damage vignette

## Controls

| Input | Action |
| --- | --- |
| **W A S D** | Move |
| **Mouse** | Look |
| **Space** | Jump / swim up |
| **Shift** | Sprint (or descend while flying) |
| **Left click** | Mine block / punch mob |
| **Right click** | Place block |
| **Middle click** | Pick targeted block |
| **1–9 / scroll** | Select hotbar slot |
| **F** | Toggle flight |
| **F3** | Debug overlay |
| **Esc** | Pause / release mouse |

## Play locally

Because the game uses ES modules, it needs to be served over HTTP (opening `index.html` directly from disk won't work):

```sh
ruby -run -e httpd . -p 8123     # or: python3 -m http.server 8123
```

Then open <http://localhost:8123>.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In the repo: **Settings → Pages → Source: Deploy from a branch**, pick `main` and `/ (root)`.
3. Your world is live at `https://<username>.github.io/<repo>/`.

## URL parameters

- `?seed=12345` — play a specific world seed (ignores the local save)
- `?rd=6` — render distance in chunks (2–8, default 4)

## How it works

| File | Purpose |
| --- | --- |
| `js/noise.js` | Seeded Perlin noise + fBm |
| `js/blocks.js` | Block definitions and a 16px texture atlas painted procedurally on a canvas |
| `js/world.js` | Chunk storage, terrain/biome/cave/tree generation, chunk meshing with baked ambient occlusion |
| `js/physics.js` | Swept AABB vs. voxel collision shared by player and mobs |
| `js/player.js` | First-person controller (walk/sprint/jump/swim/fly, health, fall damage) |
| `js/mobs.js` | Mob models, wander/chase AI, spawning |
| `js/sound.js` | Procedural WebAudio sound effects |
| `js/main.js` | Renderer, input, mining/building raycast, HUD, day/night cycle, save/load |

The world is generated in 16×16×80 chunks. Each chunk is meshed into a single geometry containing only the exposed block faces, with per-vertex ambient occlusion, and re-meshed on edit. Block edits are stored as per-chunk diffs so worlds regenerate deterministically from the seed plus your changes.
