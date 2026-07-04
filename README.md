# ⛏ WebCraft — Minecraft in your browser

A 3D Minecraft clone that runs entirely in the browser. No build step, no dependencies to install — just static HTML/JS (Three.js loaded from a CDN), so it works out of the box on GitHub Pages.

## Features

- **Infinite procedural terrain** — seeded Perlin-noise world with rolling plains, forests, deserts, beaches, oceans, and snow-capped mountains
- **Caves & ores** — winding tunnel systems with coal, iron, and diamond ore
- **Survival mining** — blocks take time to break (with crack animation); stone and ores require a pickaxe of the right tier to drop anything
- **Minecraft-style inventory** — 36 slots (27 + 9 hotbar) with 64-stack limits, a mouse cursor stack, drag-to-distribute, right-click splitting, shift-click quick-move, double-click collect, tooltips, and Q to drop; craft in the 2×2 grid or build a **crafting table** for the 3×3 grid and advanced recipes
- **Tools** — pickaxes, axes, and shovels mine their blocks much faster; swords hit harder
- **Mobs & drops** — pigs, sheep, and cows wander the world and drop food and wool; zombies spawn at night, chase you, and burn at dawn
- **Food** — eat porkchops, beef, mutton, and apples (right-click) to heal
- **Day/night cycle** — moving sun and moon, stars, sunsets, and fog that matches the sky
- **Survival elements** — health, fall damage, zombie attacks with knockback, death & respawn
- **Minecraft Java physics** — fixed 20-tick simulation with authentic per-tick gravity/friction formulas, 1.25-block floaty jumps, sprinting (double-tap W), sneaking with edge protection, slippery ice, view bobbing, and Minecraft's mouse sensitivity curve (adjustable on the pause screen)
- **World persistence** — your edits, inventory, position, and time of day auto-save to `localStorage`
- **Juice** — block-break particles, procedural sound effects, ambient-occlusion shading, held-item viewmodel, damage vignette

**Getting started:** punch a tree (hold left-click on the trunk) for logs → press **E** → craft planks (2×2 grid) → craft a crafting table → place it and right-click it → craft sticks and a wooden pickaxe (3×3 grid) → mine stone → stone tools → iron → diamond. The recipe list below the grid auto-fills patterns for you.

## Controls

| Input | Action |
| --- | --- |
| **W A S D** | Move |
| **Mouse** | Look |
| **Space** | Jump / swim up |
| **Shift** | Sneak — slower, lower camera, won't fall off edges (descend while flying) |
| **Double-tap W** | Sprint (no modifier key — Ctrl/Cmd+W would fight the browser) |
| **⛶ Fullscreen button** | Fullscreen + keyboard lock — captures most browser shortcuts while playing |
| **Hold left click** | Mine block / attack mob |
| **Right click** | Place block / eat food / use crafting table |
| **E** | Open inventory & 2×2 crafting |
| **Q / Ctrl+Q** | Drop one / whole stack (held or hovered item) |
| **Middle click** | Pick targeted block |

In the inventory (Minecraft-style): **left-click** picks up / places / swaps stacks, **right-click** picks up half / places one, **drag** distributes a stack across slots (right-drag places one per slot), **shift-click** quick-moves between hotbar and inventory, **double-click** collects all matching items, **hover + 1–9** swaps with a hotbar slot, and clicking outside the panel throws the held stack. The game pauses while the inventory is open.
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
| `js/mobs.js` | Mob models, wander/chase AI, spawning, drop tables |
| `js/items.js` | Item/tool definitions, mining rules (hardness, tool tiers, drops), recipes, pixel-art icons |
| `js/inventory.js` | Item counts + hotbar slot assignment |
| `js/drops.js` | Dropped-item entities with magnet pickup |
| `js/sound.js` | Procedural WebAudio sound effects |
| `js/main.js` | Renderer, input, timed mining, inventory/crafting UI, HUD, day/night cycle, save/load |

The world is generated in 16×16×80 chunks. Each chunk is meshed into a single geometry containing only the exposed block faces, with per-vertex ambient occlusion, and re-meshed on edit. Block edits are stored as per-chunk diffs so worlds regenerate deterministically from the seed plus your changes.
