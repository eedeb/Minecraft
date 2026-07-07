// WebCraft — a Minecraft clone for the browser.
// Entry point: rendering, input, mining/building, inventory & crafting,
// HUD, day/night, save/load.

import * as THREE from 'three';
import { B, BLOCKS, buildAtlas, tileUV, computeAvgColors } from './blocks.js';
import { World, CHUNK, HEIGHT, SEA } from './world.js';
import { Player } from './player.js';
import { MobManager, Dragon } from './mobs.js';
import { blockOverlapsEntity } from './physics.js';
import { initAudio, sfx } from './sound.js';
import { mulberry32 } from './noise.js';
import { I, ITEMS, breakInfo, RECIPES, matchGrid, itemIcon, initItemIcons, itemDamage, maxStack, TIER_NAMES, SMELT_TIME } from './items.js';
import { Inventory } from './inventory.js';
import { DropManager } from './drops.js';
import { Furnaces, Chests } from './furnace.js';

const SAVE_KEY = 'webcraft_save_v1';
const PREFS_KEY = 'webcraft_prefs_v1';
const DAY_LEN = 300; // seconds per full day/night cycle
const REACH = 4.5;   // Minecraft block reach
const MOB_REACH = 3; // Minecraft entity reach

// ---------------------------------------------------------------------------
// Save / load

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted save */ }
  return null;
}

// user preferences (sensitivity, view bobbing)
let prefs = { sens: 100, bob: true };
try {
  const raw = localStorage.getItem(PREFS_KEY);
  if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
} catch (e) { }
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { }
}

const params = new URLSearchParams(location.search);
const saved = params.has('seed') ? null : loadSave();
const seed = params.has('seed') ? (parseInt(params.get('seed'), 10) | 0)
  : saved ? saved.seed
    : (Math.random() * 0xffffffff) | 0;
const renderDist = Math.min(8, Math.max(2, parseInt(params.get('rd') || '4', 10) || 4));

// drop ?seed from the URL after boot: the world saves under this seed, so
// plain refreshes should load the save rather than force-regenerate
if (params.has('seed')) {
  try {
    const q = new URLSearchParams(params);
    q.delete('seed');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
  } catch (e) { }
}

// ---------------------------------------------------------------------------
// Renderer / scene

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
scene.add(sun);
scene.add(sun.target);

scene.fog = new THREE.Fog(0x87ceeb, renderDist * CHUNK * 0.55, renderDist * CHUNK * 0.95);

// sky objects
const sunMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false })
);
const moonMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(11, 11),
  new THREE.MeshBasicMaterial({ color: 0xdfe4f2, fog: false })
);
scene.add(sunMesh, moonMesh);

const starGeo = new THREE.BufferGeometry();
{
  const n = 350, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(400);
    if (v.y < 20) v.y = 20 + Math.random() * 300;
    pos.set([v.x, v.y, v.z], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ---------------------------------------------------------------------------
// Materials from generated atlas

const atlasCanvas = buildAtlas();
initItemIcons(atlasCanvas);
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

const materials = {
  opaque: new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 }),
  water: new THREE.MeshLambertMaterial({ map: atlasTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  lava: new THREE.MeshBasicMaterial({ map: atlasTex }), // unlit: glows in the dark
};
const avgColors = computeAvgColors(atlasCanvas);

const itemTexCache = new Map();
function itemTexture(id) {
  if (!itemTexCache.has(id)) {
    const tex = new THREE.CanvasTexture(itemIcon(id));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    itemTexCache.set(id, tex);
  }
  return itemTexCache.get(id);
}

// ---------------------------------------------------------------------------
// World / player / inventory

let dim = ['nether', 'end'].includes(saved?.dim) ? saved.dim : 'overworld';
const worldOver = new World(seed, scene, materials, renderDist, 'overworld');
const worldNether = new World((seed ^ 0x5a17c3) | 0, scene, materials, renderDist, 'nether');
const worldEnd = new World((seed ^ 0x33cc99) | 0, scene, materials, renderDist, 'end');
if (saved && saved.edits) {
  for (const [ck, entries] of saved.edits) worldOver.edits.set(ck, new Map(entries));
}
if (saved && saved.editsN) {
  for (const [ck, entries] of saved.editsN) worldNether.edits.set(ck, new Map(entries));
}
if (saved && saved.editsE) {
  for (const [ck, entries] of saved.editsE) worldEnd.edits.set(ck, new Map(entries));
}
const dims = {
  overworld: { world: worldOver, portals: saved?.portals?.overworld || [] },
  nether: { world: worldNether, portals: saved?.portals?.nether || [] },
  end: { world: worldEnd, portals: [] },
};
let world = dims[dim].world;
let dragonDefeated = !!saved?.dragonDefeated;
let dragon = null;

const spawnPoint = worldOver.findSpawn();
const player = new Player(world, spawnPoint);
player.gameMode = saved?.gameMode === 'creative' ? 'creative' : 'survival';
const isCreative = () => player.gameMode === 'creative';
if (saved && saved.player) {
  player.pos = { ...saved.player.pos };
  player.prevPos = { ...saved.player.pos };
  player.yaw = saved.player.yaw || 0;
  player.pitch = saved.player.pitch || 0;
  player.hp = saved.player.hp ?? 20;
}
let timeOfDay = saved?.timeOfDay ?? 0.28;
let selected = saved?.player?.sel ?? 0;

// Minecraft sensitivity curve: f = sens*0.6+0.2; rotation = delta * f^3 * 8 * 0.15deg
// (scaled down 0.35x — browser movementX reports far more units per cm than
// Minecraft's raw mouse input, so unscaled 100% is unplayably fast)
function applySensitivity() {
  const f = (prefs.sens / 100) * 0.6 + 0.2;
  player.lookFactor = f * f * f * 8 * 0.15 * (Math.PI / 180) * 0.35;
}
applySensitivity();

const inventory = Inventory.from(saved?.inventory);
const isNewPlayer = !saved?.inventory;

const furnaces = new Furnaces();
if (saved?.furnaces) furnaces.load(saved.furnaces);
const chests = new Chests();
if (saved?.chests) chests.load(saved.chests);
if (saved?.player?.spawn) player.spawn = { ...saved.player.spawn };
if (saved?.player) {
  player.hunger = saved.player.hunger ?? 20;
  player.saturation = saved.player.saturation ?? 5;
}

// build ground under the player synchronously so we don't fall through
{
  const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) world.ensureData(pcx + dx, pcz + dz);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) world.buildMesh(pcx + dx, pcz + dz);
}

const mobsByDim = {
  overworld: new MobManager(scene, worldOver),
  nether: new MobManager(scene, worldNether),
  end: new MobManager(scene, worldEnd),
};
let mobs = mobsByDim[dim];

// ---------------------------------------------------------------------------
// Particles

class Particles {
  constructor(scene, cap = 600) {
    this.cap = cap;
    this.list = [];
    this.geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(cap * 3);
    this.colArr = new Float32Array(cap * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3));
    this.geo.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  burst(x, y, z, rgb, n = 12, spread = 3.5) {
    for (let i = 0; i < n && this.list.length < this.cap; i++) {
      this.list.push({
        x, y, z,
        vx: (Math.random() - 0.5) * spread,
        vy: Math.random() * spread * 0.9 + 1,
        vz: (Math.random() - 0.5) * spread,
        ttl: 0.4 + Math.random() * 0.5,
        r: rgb[0] * (0.75 + Math.random() * 0.35),
        g: rgb[1] * (0.75 + Math.random() * 0.35),
        b: rgb[2] * (0.75 + Math.random() * 0.35),
      });
    }
  }
  update(dt) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.ttl -= dt;
      if (p.ttl <= 0) { this.list.splice(i, 1); continue; }
      p.vy -= 16 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of this.list) {
      this.posArr[n * 3] = p.x; this.posArr[n * 3 + 1] = p.y; this.posArr[n * 3 + 2] = p.z;
      this.colArr[n * 3] = p.r; this.colArr[n * 3 + 1] = p.g; this.colArr[n * 3 + 2] = p.b;
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
const particles = new Particles(scene);

// ---------------------------------------------------------------------------
// Block geometry helper (held viewmodel + dropped block items)

function makeBlockGeometry(id) {
  const blk = BLOCKS[id];
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const FACES = [
    { dir: [1, 0, 0], shade: 0.8, corners: [[1, 0, 1, 0, 0], [1, 0, 0, 1, 0], [1, 1, 0, 1, 1], [1, 1, 1, 0, 1]] },
    { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 1, 1, 1, 1], [0, 1, 0, 0, 1]] },
    { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1, 0, 0], [1, 1, 1, 1, 0], [1, 1, 0, 1, 1], [0, 1, 0, 0, 1]] },
    { dir: [0, -1, 0], shade: 0.55, corners: [[0, 0, 0, 0, 0], [1, 0, 0, 1, 0], [1, 0, 1, 1, 1], [0, 0, 1, 0, 1]] },
    { dir: [0, 0, 1], shade: 0.72, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [1, 1, 1, 1, 1], [0, 1, 1, 0, 1]] },
    { dir: [0, 0, -1], shade: 0.72, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [0, 1, 0, 1, 1], [1, 1, 0, 0, 1]] },
  ];
  for (const f of FACES) {
    const tile = f.dir[1] === 1 ? blk.top : f.dir[1] === -1 ? blk.bottom : blk.side;
    const r = tileUV(tile);
    const base = pos.length / 3;
    for (const c of f.corners) {
      pos.push(c[0] - 0.5, c[1] - 0.5, c[2] - 0.5);
      nor.push(...f.dir);
      uv.push(c[3] ? r.u1 : r.u0, c[4] ? r.v1 : r.v0);
      col.push(f.shade, f.shade, f.shade);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  return g;
}

const blockGeoCache = new Map();
function cachedBlockGeometry(id) {
  if (!blockGeoCache.has(id)) blockGeoCache.set(id, makeBlockGeometry(id));
  return blockGeoCache.get(id);
}

const dropResources = {
  blockGeometry: cachedBlockGeometry,
  blockMaterial: materials.opaque,
  itemTexture,
};
const dropsByDim = {
  overworld: new DropManager(scene, worldOver, dropResources),
  nether: new DropManager(scene, worldNether, dropResources),
  end: new DropManager(scene, worldEnd, dropResources),
};
let drops = dropsByDim[dim];

// ---------------------------------------------------------------------------
// Dimensions & nether portals

const DIRS6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const dimPrefix = () => (dim === 'nether' ? 'N:' : '');
let portalT = 0, portalCd = 0, inPortalNow = false;

// water + lava contact turns the lava to obsidian
function liquidContact(x, y, z) {
  const cells = [[x, y, z], ...DIRS6.map(d => [x + d[0], y + d[1], z + d[2]])];
  for (const [ax, ay, az] of cells) {
    if (world.getBlock(ax, ay, az) !== B.LAVA) continue;
    for (const d of DIRS6) {
      if (world.getBlock(ax + d[0], ay + d[1], az + d[2]) === B.WATER) {
        world.setBlock(ax, ay, az, B.OBSIDIAN);
        particles.burst(ax + 0.5, ay + 0.5, az + 0.5, [0.35, 0.25, 0.5], 10, 2.5);
        sfx.splash();
        break;
      }
    }
  }
}

// flood-fill the air inside an obsidian frame; must form a small rectangle
function floodPortalPlane(sx, sy, sz, axis) {
  const cells = [];
  const seen = new Set([sx + ',' + sy + ',' + sz]);
  const stack = [[sx, sy, sz]];
  const dirs = axis === 'x'
    ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]
    : [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
  while (stack.length) {
    if (cells.length > 40) return null;
    const [ax, ay, az] = stack.pop();
    const b = world.getBlock(ax, ay, az);
    if (b === B.AIR) {
      cells.push([ax, ay, az]);
      for (const d of dirs) {
        const k = (ax + d[0]) + ',' + (ay + d[1]) + ',' + (az + d[2]);
        if (!seen.has(k)) { seen.add(k); stack.push([ax + d[0], ay + d[1], az + d[2]]); }
      }
    } else if (b !== B.OBSIDIAN) {
      return null; // frame is not sealed
    }
  }
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [ax, ay, az] of cells) {
    minX = Math.min(minX, ax); maxX = Math.max(maxX, ax);
    minY = Math.min(minY, ay); maxY = Math.max(maxY, ay);
    minZ = Math.min(minZ, az); maxZ = Math.max(maxZ, az);
  }
  const w = axis === 'x' ? maxX - minX + 1 : maxZ - minZ + 1;
  const h = maxY - minY + 1;
  if (w < 2 || w > 8 || h < 3 || h > 8) return null;
  if (cells.length !== w * h) return null;
  return { cells, minX, minY, minZ };
}

function tryLightPortal(x, y, z) {
  if (world.getBlock(x, y, z) !== B.AIR) return false;
  for (const axis of ['x', 'z']) {
    const region = floodPortalPlane(x, y, z, axis);
    if (region) {
      for (const [ax, ay, az] of region.cells) world.setBlock(ax, ay, az, B.PORTAL);
      dims[dim].portals.push({ x: region.minX, y: region.minY, z: region.minZ });
      return true;
    }
  }
  return false;
}

function ensureAround(px, pz) {
  const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) world.ensureData(pcx + dx, pcz + dz);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) world.buildMesh(pcx + dx, pcz + dz);
}

function findNetherSpot(x, z) {
  for (let y = 28; y < 50; y++) {
    if (world.getBlock(x, y, z) === B.AIR && world.getBlock(x, y + 1, z) === B.AIR
      && world.getBlock(x, y - 1, z) !== B.AIR && world.getBlock(x, y - 1, z) !== B.LAVA) {
      return { x, y, z };
    }
  }
  // carve a safe pocket
  for (let ay = 32; ay <= 36; ay++)
    for (let az = z - 2; az <= z + 2; az++)
      for (let ax = x - 2; ax <= x + 2; ax++) world.setBlock(ax, ay, az, B.AIR);
  for (let az = z - 2; az <= z + 2; az++)
    for (let ax = x - 2; ax <= x + 2; ax++) world.setBlock(ax, 31, az, B.NETHERRACK);
  return { x, y: 32, z };
}

// build a lit 4x5 portal (2x3 interior) with a small platform
function buildPortalFrame(x, y, z) {
  for (let fy = -1; fy <= 3; fy++) {
    for (let fx = -1; fx <= 2; fx++) {
      const interior = fx >= 0 && fx <= 1 && fy >= 0 && fy <= 2;
      world.setBlock(x + fx, y + fy, z, interior ? B.PORTAL : B.OBSIDIAN);
    }
  }
  for (let fx = -1; fx <= 2; fx++) {
    for (let fz = -1; fz <= 1; fz++) {
      const below = world.getBlock(x + fx, y - 1, z + fz);
      if (!BLOCKS[below].solid) world.setBlock(x + fx, y - 1, z + fz, B.OBSIDIAN);
    }
  }
  // breathing room in front of the portal
  for (let fy = 0; fy <= 2; fy++)
    for (let fx = 0; fx <= 1; fx++)
      for (const dz of [-1, 1]) {
        const b = world.getBlock(x + fx, y + fy, z + dz);
        if (b !== B.AIR && b !== B.PORTAL) world.setBlock(x + fx, y + fy, z + dz, B.AIR);
      }
}

function findOrBuildPortal(tx, tz) {
  const reg = dims[dim].portals;
  ensureAround(tx, tz);
  for (const p of reg) {
    if (Math.hypot(p.x - tx, p.z - tz) < 24 && world.getBlock(p.x, p.y, p.z) === B.PORTAL) return p;
  }
  let spot;
  if (dim === 'nether') {
    spot = findNetherSpot(tx, tz);
  } else {
    const s = world.getSurface(tx, tz);
    spot = { x: tx, y: s ? s.y + 1 : 40, z: tz };
  }
  buildPortalFrame(spot.x, spot.y, spot.z);
  reg.push(spot);
  return spot;
}

function setDimension(target) {
  if (target === dim) return;
  if (dim === 'end' && dragon) dragon.group.visible = false;
  world.unloadAll();
  mobs.setActive(false);
  drops.setActive(false);
  dim = target;
  world = dims[dim].world;
  mobs = mobsByDim[dim];
  drops = dropsByDim[dim];
  mobs.setActive(true);
  drops.setActive(true);
  player.world = world;
  if (window.__game) {
    window.__game.world = world;
    window.__game.mobs = mobs;
    window.__game.drops = drops;
  }
}

function resetPlayerAt(x, y, z) {
  player.pos = { x, y, z };
  player.prevPos = { ...player.pos };
  player.vel = { x: 0, y: 0, z: 0 };
  player.fallDist = 0;
  player.burnT = 0;
  portalCd = 3;
  portalT = 0;
}

function switchDimension(target) {
  const scale = target === 'nether' ? 1 / 8 : 8;
  const tx = Math.round(player.pos.x * scale), tz = Math.round(player.pos.z * scale);
  setDimension(target);
  const arrive = findOrBuildPortal(tx, tz);
  resetPlayerAt(arrive.x + 0.5, arrive.y + 0.02, arrive.z + 0.5);
  ensureAround(player.pos.x, player.pos.z);
  sfx.portal();
  toast(target === 'nether' ? 'Entering the Nether…' : 'Returning to the Overworld…', 2.5);
  save();
}

// --- The End ---------------------------------------------------------------

function enterEnd() {
  setDimension('end');
  // obsidian arrival platform off the island's western rim
  ensureAround(-54, 0);
  for (let x = -56; x <= -52; x++) {
    for (let z = -2; z <= 2; z++) {
      world.setBlock(x, 40, z, B.OBSIDIAN);
      for (let y = 41; y <= 43; y++) world.setBlock(x, y, z, B.AIR);
    }
  }
  resetPlayerAt(-53.5, 41.02, 0.5);
  ensureAround(player.pos.x, player.pos.z);
  if (!dragonDefeated && !dragon) {
    dragon = new Dragon(scene);
    dragon.onDeath = onDragonDeath;
    toast('The Ender Dragon circles above…', 3);
  } else {
    toast('Entering the End…', 2.5);
  }
  if (dragon) dragon.group.visible = true;
  sfx.portal();
  save();
}

function leaveEnd() {
  setDimension('overworld');
  if (dragon) dragon.group.visible = false;
  resetPlayerAt(player.spawn.x, player.spawn.y, player.spawn.z);
  ensureAround(player.pos.x, player.pos.z);
  sfx.portal();
  toast('Returning home…', 2.5);
  save();
}

function onDragonDeath() {
  dragonDefeated = true;
  toast('THE ENDER DRAGON HAS BEEN DEFEATED!', 6);
  const dp = dragon.pos;
  for (let i = 0; i < 8; i++) {
    setTimeout(() => particles.burst(
      dp.x + (Math.random() - 0.5) * 4, dp.y + (Math.random() - 0.5) * 3, dp.z + (Math.random() - 0.5) * 4,
      [0.75, 0.3, 0.9], 20, 6), i * 180);
  }
  sfx.portal();
  setTimeout(() => { if (dragon) { dragon.dispose(); dragon = null; } }, 1600);
  // exit portal + the dragon egg trophy at the island's heart
  ensureAround(0, 0);
  const s = world.getSurface(0, 0);
  const py = (s ? s.y : 38) + 1;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) world.setBlock(i, py, j, B.END_PORTAL);
    world.setBlock(i, py, -2, B.BEDROCK); world.setBlock(i, py, 2, B.BEDROCK);
    world.setBlock(-2, py, i, B.BEDROCK); world.setBlock(2, py, i, B.BEDROCK);
  }
  world.setBlock(2, py + 1, 2, B.BEDROCK);
  world.setBlock(2, py + 2, 2, B.DRAGON_EGG);
  save();
}

// filling the 12th frame opens the 3x3 floor portal
function checkEndPortalComplete(fx, y, fz) {
  for (let ox = fx - 3; ox <= fx + 1; ox++) {
    for (let oz = fz - 3; oz <= fz + 1; oz++) {
      const ring = [];
      for (let i = 0; i < 3; i++) {
        ring.push([ox - 1, oz + i], [ox + 3, oz + i], [ox + i, oz - 1], [ox + i, oz + 3]);
      }
      if (!ring.every(([rx, rz]) => world.getBlock(rx, y, rz) === B.END_FRAME_FILLED)) continue;
      let clear = true;
      for (let i = 0; i < 3 && clear; i++)
        for (let j = 0; j < 3 && clear; j++) {
          const b = world.getBlock(ox + i, y, oz + j);
          if (b !== B.AIR && b !== B.END_PORTAL) clear = false;
        }
      if (!clear) continue;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) world.setBlock(ox + i, y, oz + j, B.END_PORTAL);
      sfx.portal();
      toast('The End portal opens beneath you…', 3);
      return true;
    }
  }
  return false;
}

// --- thrown ender pearls -----------------------------------------------------

const pearls = [];
function throwPearl() {
  const eye = player.eye();
  const dir = player.forwardDir();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.35),
    new THREE.MeshBasicMaterial({ map: itemTexture(I.ENDER_PEARL), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
  );
  mesh.position.set(eye.x, eye.y, eye.z);
  scene.add(mesh);
  pearls.push({
    pos: { x: eye.x + dir.x * 0.4, y: eye.y + dir.y * 0.4, z: eye.z + dir.z * 0.4 },
    vel: { x: dir.x * 20, y: dir.y * 20 + 3, z: dir.z * 20 },
    ttl: 6, mesh,
  });
  sfx.pop();
}

function updatePearls(dt) {
  for (let i = pearls.length - 1; i >= 0; i--) {
    const pe = pearls[i];
    pe.ttl -= dt;
    pe.vel.y -= 22 * dt;
    const nx = pe.pos.x + pe.vel.x * dt, ny = pe.pos.y + pe.vel.y * dt, nz = pe.pos.z + pe.vel.z * dt;
    const hitSolid = BLOCKS[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))].solid;
    if (hitSolid || pe.ttl <= 0) {
      if (hitSolid && !player.dead) {
        // teleport to the last clear spot before impact, MC-style landing damage
        player.pos = { x: pe.pos.x, y: Math.max(1, Math.floor(pe.pos.y)) + 0.02, z: pe.pos.z };
        player.prevPos = { ...player.pos };
        player.vel = { x: 0, y: 0, z: 0 };
        player.fallDist = 0;
        player.damage(2, simTime, 'fall');
        particles.burst(player.pos.x, player.pos.y + 1, player.pos.z, [0.7, 0.25, 0.85], 16, 3.5);
        sfx.portal();
      }
      scene.remove(pe.mesh);
      pe.mesh.geometry.dispose();
      pearls.splice(i, 1);
      continue;
    }
    pe.pos.x = nx; pe.pos.y = ny; pe.pos.z = nz;
    pe.mesh.position.set(nx, ny, nz);
    pe.mesh.rotation.y += dt * 6;
  }
}

// ---------------------------------------------------------------------------
// Block highlight + crack overlay + held viewmodel

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111 })
);
highlight.visible = false;
scene.add(highlight);

function buildCrackTextures() {
  const texs = [];
  const rand = mulberry32(4242);
  for (let s = 0; s < 5; s++) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(15,15,15,0.85)';
    const cracks = (s + 1) * 3;
    for (let i = 0; i < cracks; i++) {
      let x = (rand() * 16) | 0, y = (rand() * 16) | 0;
      const len = 3 + ((rand() * 5) | 0);
      for (let j = 0; j < len; j++) {
        ctx.fillRect(x, y, 1, 1);
        x = Math.max(0, Math.min(15, x + ((rand() * 3) | 0) - 1));
        y = Math.max(0, Math.min(15, y + ((rand() * 3) | 0) - 1));
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    texs.push(tex);
  }
  return texs;
}
const crackTextures = buildCrackTextures();
const crackMat = new THREE.MeshBasicMaterial({
  map: crackTextures[0], transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.003, 1.003, 1.003), crackMat);
crackMesh.visible = false;
scene.add(crackMesh);

const heldGroup = new THREE.Group();
camera.add(heldGroup);
scene.add(camera);
let heldMesh = null;
let swingT = 10;

function heldId() { const s = inventory.slots[selected]; return s ? s.id : null; }

function updateHeldItem() {
  if (heldMesh) {
    heldGroup.remove(heldMesh);
    if (heldMesh.userData.ownGeo) heldMesh.geometry.dispose();
    heldMesh = null;
  }
  const id = heldId();
  const it = ITEMS[id];
  if (!it) return;
  if (it.kind === 'block') {
    heldMesh = new THREE.Mesh(cachedBlockGeometry(id), materials.opaque);
    heldMesh.scale.setScalar(0.22);
    heldGroup.position.set(0.55, -0.48, -0.85);
    heldGroup.rotation.set(0.12, Math.PI / 5, 0);
  } else {
    heldMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: itemTexture(id), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
    );
    heldMesh.userData.ownGeo = true;
    heldGroup.position.set(0.5, -0.45, -0.8);
    heldGroup.rotation.set(0.1, -0.35, 0.25);
  }
  heldGroup.add(heldMesh);
}

// ---------------------------------------------------------------------------
// HUD / UI

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const deathScreen = document.getElementById('deathScreen');
const heartsEl = document.getElementById('hearts');
const hotbarEl = document.getElementById('hotbar');
const debugEl = document.getElementById('debug');
const blockNameEl = document.getElementById('blockname');
const damageEl = document.getElementById('vignette-damage');
const underwaterEl = document.getElementById('underwater');
const invScreen = document.getElementById('invScreen');
const invMainEl = document.getElementById('invMain');
const invHotbarRowEl = document.getElementById('invHotbarRow');
const craftList = document.getElementById('craftList');
const craftGridEl = document.getElementById('craftGrid');
const craftOutEl = document.getElementById('craftOut');
const craftTitleEl = document.getElementById('craftTitle');
const cursorStackEl = document.getElementById('cursorStack');
const tooltipEl = document.getElementById('invTooltip');
const hungerEl = document.getElementById('hunger');
const armorbarEl = document.getElementById('armorbar');
const fireOverlayEl = document.getElementById('fireOverlay');
const portalOverlayEl = document.getElementById('portalOverlay');
const bossbarEl = document.getElementById('bossbar');
const bossFillEl = document.getElementById('bossFill');
const armorRowEl = document.getElementById('armorRow');
const craftAreaEl = document.getElementById('craftArea');
const furnacePanelEl = document.getElementById('furnacePanel');
const chestPanelEl = document.getElementById('chestPanel');
const furnInEl = document.getElementById('furnIn');
const furnFuelEl = document.getElementById('furnFuel');
const furnOutEl = document.getElementById('furnOut');
const flameFillEl = document.getElementById('flameFill');
const progFillEl = document.getElementById('progFill');
const recipesColEl = document.querySelector('.inv-col.recipes');
const recipesTitleEl = document.querySelector('.inv-col.recipes h2');
document.getElementById('seedLabel').textContent = 'seed: ' + (seed >>> 0);

let blockNameT = 0;
function toast(text, secs = 1.6) {
  blockNameEl.textContent = text;
  blockNameEl.style.opacity = 1;
  blockNameT = secs;
}

function iconCanvasFor(id, size = 36) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(itemIcon(id), 0, 0, 16, 16, 0, 0, size, size);
  return c;
}

function renderHotbar() {
  hotbarEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selected ? ' sel' : '');
    const s = inventory.slots[i];
    if (s) {
      slot.appendChild(iconCanvasFor(s.id, 36));
      if (s.n > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'cnt';
        cnt.textContent = s.n;
        slot.appendChild(cnt);
      }
    }
    const num = document.createElement('span');
    num.textContent = i + 1;
    slot.appendChild(num);
    hotbarEl.appendChild(slot);
  }
}

function setSelected(i) {
  selected = ((i % 9) + 9) % 9;
  document.querySelectorAll('#hotbar .slot').forEach((s, j) => s.classList.toggle('sel', j === selected));
  updateHeldItem();
  const id = heldId();
  if (id != null) toast(ITEMS[id].name);
}

let lastHp = -1, lastHunger = -1, lastArmor = -1;
function updateHearts() {
  if (player.hp !== lastHp) {
    lastHp = player.hp;
    let html = '';
    for (let i = 0; i < 10; i++) {
      const full = player.hp >= (i + 1) * 2;
      const half = !full && player.hp >= i * 2 + 1;
      html += `<span class="${full ? 'full' : half ? 'half' : 'empty'}">♥</span>`;
    }
    heartsEl.innerHTML = html;
  }
  const hungerNow = Math.ceil(player.hunger);
  if (hungerNow !== lastHunger) {
    lastHunger = hungerNow;
    let html = '';
    for (let i = 9; i >= 0; i--) { // drumsticks deplete right-to-left like MC
      const full = player.hunger >= (i + 1) * 2;
      const half = !full && player.hunger >= i * 2 + 1;
      html += `<span class="${full ? 'full' : half ? 'half' : 'empty'}">🍗</span>`;
    }
    hungerEl.innerHTML = html;
  }
  if (player.armorPoints !== lastArmor) {
    lastArmor = player.armorPoints;
    if (player.armorPoints <= 0) {
      armorbarEl.innerHTML = '';
    } else {
      let html = '';
      for (let i = 0; i < 10; i++) {
        html += `<span class="${player.armorPoints >= (i + 1) * 2 ? 'full' : 'empty'}">🛡</span>`;
      }
      armorbarEl.innerHTML = html;
    }
  }
}

function updateFurnaceBars() {
  const c = inventory.container;
  if (!c) return;
  flameFillEl.style.height = (c.burnMax > 0 ? Math.max(0, c.burn / c.burnMax) * 100 : 0) + '%';
  progFillEl.style.width = (c.progress / SMELT_TIME) * 100 + '%';
}

player.onDamage = () => {
  damageEl.style.transition = 'none';
  damageEl.style.opacity = 0.55;
  requestAnimationFrame(() => {
    damageEl.style.transition = 'opacity 0.6s';
    damageEl.style.opacity = 0;
  });
  sfx.hurt();
};
player.onDeath = () => {
  closeInventory(false);
  document.exitPointerLock();
  deathScreen.classList.add('show');
};

document.getElementById('respawnBtn').addEventListener('click', () => {
  if (dim !== 'overworld') setDimension('overworld'); // you wake up back home
  player.respawn();
  ensureAround(player.pos.x, player.pos.z);
  deathScreen.classList.remove('show');
  canvas.requestPointerLock();
});

// ---------------------------------------------------------------------------
// Game mode (survival / creative)

const modeBtn = document.getElementById('modeBtn');

function applyGameMode(mode, opts = {}) {
  if (mode !== 'creative' && mode !== 'survival') return;
  player.gameMode = mode;
  const creative = mode === 'creative';
  if (!creative) player.fly = false; // no flying in survival
  else player.burnT = 0;
  // creative hides the survival bars, like Minecraft
  heartsEl.style.display = creative ? 'none' : '';
  hungerEl.style.display = creative ? 'none' : '';
  armorbarEl.style.display = creative ? 'none' : '';
  modeBtn.textContent = creative ? '⚒ Mode: Creative' : '⚒ Mode: Survival';
  if (invOpen) renderInvScreen(); // swap recipes <-> block palette
  if (!opts.silent) {
    toast(creative ? 'Creative mode — F to fly, E for all blocks' : 'Survival mode', 3);
    save();
  }
}

modeBtn.addEventListener('click', () => {
  applyGameMode(isCreative() ? 'survival' : 'creative');
});

// ---------------------------------------------------------------------------
// Inventory & crafting screen (Minecraft Java-style slot interactions)

let invOpen = false;
let invMode = 'inv';          // 'inv' (2x2) | 'table' (3x3) | 'furnace'
let craftSize = 2;            // 2 = inventory grid, 3 = crafting table
let hoveredSlot = null;       // {area:'inv'|'craft'|'armor'|'furn', idx}
let paint = null;             // drag-paint session {btn, locs:[{area,idx}], keys:Set}
let lastPickup = { key: null, t: 0 }; // double-click tracking
const slotEls = new Map();    // slotKey -> element (for paint highlights)

const slotKey = (area, idx) => area + ':' + idx;

function dropStacks(stacks) {
  if (!stacks || !stacks.length) return;
  const eye = player.eye();
  const dir = player.forwardDir();
  for (const s of stacks) {
    if (s && s.n > 0) drops.spawn(s.id, s.n, eye.x + dir.x * 0.4, eye.y - 0.3, eye.z + dir.z * 0.4, { stack: true, throwDir: dir });
  }
}

function throwFromSlot(area, idx, all) {
  const s = inventory.get(area, idx);
  if (!s) return;
  const take = inventory.takeFrom(area, idx, all ? s.n : 1);
  if (take) { dropStacks([take]); sfx.pop(); }
}

// basic loot for untouched village chests, seeded by position
function fillChestLoot(state, key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  const rand = mulberry32(h ^ world.seed);
  const table = [
    [I.APPLE, 1, 3, 1], [I.COAL, 2, 5, 1], [I.IRON_INGOT, 1, 3, 0.7],
    [I.STICK, 2, 6, 1], [B.PLANK, 2, 8, 1], [B.WOOL, 1, 3, 0.8],
    [I.PORKCHOP, 1, 2, 0.6], [I.ENDER_PEARL, 1, 1, 0.15],
    [I.IRON_PICK, 1, 1, 0.12], [I.IRON_SWORD, 1, 1, 0.12],
  ];
  const stacks = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < stacks; i++) {
    const [id, min, max, chance] = table[Math.floor(rand() * table.length)];
    if (rand() > chance) continue;
    const slot = Math.floor(rand() * 27);
    if (!state.slots[slot]) state.slots[slot] = { id, n: min + Math.floor(rand() * (max - min + 1)) };
  }
}

function openInventory(mode = 'inv', contKey = null, contPos = null) {
  if (player.dead) return;
  if (mode === true) mode = 'table'; // legacy callers
  invOpen = true;
  invMode = mode;
  craftSize = mode === 'table' ? 3 : 2;
  inventory.container = null;
  if (mode === 'furnace') {
    inventory.container = furnaces.get(contKey, true);
  } else if (mode === 'chest') {
    const [state, isNew] = chests.get(contKey, true);
    // worldgen chests (not placed by the player) start with loot
    if (isNew && contPos && !world.hasEdit(contPos.x, contPos.y, contPos.z)) {
      fillChestLoot(state, contKey);
    }
    inventory.container = state;
  }
  invScreen.classList.add('show');
  renderInvScreen();
  if (locked) document.exitPointerLock();
}

function closeInventory(relock = true) {
  if (!invOpen) return;
  // crafting grid + cursor go back to the inventory; drop what doesn't fit
  dropStacks(inventory.returnAll());
  inventory.container = null;
  invOpen = false;
  paint = null;
  hoveredSlot = null;
  invScreen.classList.remove('show');
  if (relock && started && !player.dead) canvas.requestPointerLock();
}

document.getElementById('invClose').addEventListener('click', () => closeInventory());

// --- crafting result -------------------------------------------------------

function currentRecipe() {
  return matchGrid(inventory.craft.map(c => (c ? c.id : null)), 3);
}

function consumeGridOnce() {
  for (let i = 0; i < 9; i++) {
    const s = inventory.craft[i];
    if (s) { s.n--; if (!s.n) inventory.craft[i] = null; }
  }
}

// Take the crafting result. shift = craft as many as possible into inventory.
function takeResult(shift) {
  let r = currentRecipe();
  if (!r) return false;
  if (shift) {
    let safety = 0;
    while (r && safety++ < 64) {
      const left = inventory.add(r.out, r.n);
      consumeGridOnce();
      if (left > 0) { dropStacks([{ id: r.out, n: left }]); break; }
      r = currentRecipe();
    }
  } else {
    const c = inventory.cursor;
    if (!c) inventory.cursor = { id: r.out, n: r.n };
    else if (c.id === r.out && c.n + r.n <= maxStack(r.out)) c.n += r.n;
    else return false;
    consumeGridOnce();
  }
  sfx.craft();
  inventory._c();
  return true;
}

// Recipe helper list: move real ingredients from the inventory into the grid.
function autofillRecipe(r) {
  if (r.needsTable && craftSize < 3) {
    toast('Needs a crafting table (craft one, place it, right-click it)', 2.5);
    return;
  }
  for (const [id, n] of r.in) {
    if (inventory.count(id) < n) { toast('Not enough materials', 1.2); return; }
  }
  dropStacks(inventory.returnAll()); // clear the grid first
  if (r.pattern) {
    for (let rr = 0; rr < r.pattern.length; rr++) {
      for (let cc = 0; cc < r.pattern[rr].length; cc++) {
        const id = r.pattern[rr][cc];
        if (id != null && inventory.consume(id, 1)) inventory.craft[rr * 3 + cc] = { id, n: 1 };
      }
    }
  } else {
    r.shapeless.forEach((id, i) => {
      if (inventory.consume(id, 1))
        inventory.craft[Math.floor(i / craftSize) * 3 + (i % craftSize)] = { id, n: 1 };
    });
  }
  inventory._c();
}

// --- slot mouse interactions -------------------------------------------------

function canPaintInto(area, idx) {
  const c = inventory.cursor;
  if (!c) return false;
  const s = inventory.get(area, idx);
  return !s || (s.id === c.id && s.n < maxStack(s.id));
}

function paintRightPlace(area, idx) {
  const key = slotKey(area, idx);
  if (!paint || paint.keys.has(key) || !canPaintInto(area, idx)) return;
  paint.keys.add(key);
  inventory.rightClick(area, idx); // places exactly one
  if (!inventory.cursor) paint = null;
}

function onSlotMouseDown(e, area, idx) {
  e.preventDefault();
  if (e.button === 0) {
    if (e.shiftKey) { inventory.quickMove(area, idx); return; }
    const key = slotKey(area, idx);
    const now = performance.now();
    if (inventory.cursor && lastPickup.key === key && now - lastPickup.t < 300) {
      inventory.collectAll(); // double-click: gather all matching
      lastPickup.key = null;
      return;
    }
    if (!inventory.cursor) {
      inventory.leftClick(area, idx); // pick up the stack
      lastPickup = { key, t: now };
    } else {
      // holding a stack: start a paint/drag session, finalized on mouseup
      paint = { btn: 0, locs: [], keys: new Set() };
      addPaintSlot(area, idx);
    }
  } else if (e.button === 2) {
    if (!inventory.cursor) {
      inventory.rightClick(area, idx); // pick up half
    } else {
      paint = { btn: 2, locs: [], keys: new Set() };
      paintRightPlace(area, idx); // place one per slot crossed
    }
  }
}

function addPaintSlot(area, idx) {
  const key = slotKey(area, idx);
  if (!paint || paint.keys.has(key) || !canPaintInto(area, idx)) return;
  paint.keys.add(key);
  paint.locs.push({ area, idx });
  const el = slotEls.get(key);
  if (el) el.classList.add('painting');
}

function onSlotMouseEnter(area, idx) {
  hoveredSlot = { area, idx };
  updateTooltip();
  if (!paint) return;
  if (paint.btn === 2) paintRightPlace(area, idx);
  else addPaintSlot(area, idx);
}

function finalizePaint() {
  if (!paint) return;
  const p = paint;
  paint = null;
  if (p.btn !== 0 || !p.locs.length) { renderInvScreen(); return; }
  const c = inventory.cursor;
  if (!c) return;
  if (p.locs.length === 1) {
    // plain click: place all / merge / swap
    inventory.leftClick(p.locs[0].area, p.locs[0].idx);
    return;
  }
  // left-drag: distribute the stack evenly across painted slots
  const per = Math.floor(c.n / p.locs.length);
  if (per > 0) {
    for (const l of p.locs) {
      if (!c.n) break;
      const s = inventory.get(l.area, l.idx);
      const cap = s ? maxStack(c.id) - s.n : maxStack(c.id);
      const put = Math.min(per, cap, c.n);
      if (put <= 0) continue;
      if (s) s.n += put;
      else inventory.set(l.area, l.idx, { id: c.id, n: put });
      c.n -= put;
    }
    if (!c.n) inventory.cursor = null;
  }
  inventory._c();
}
document.addEventListener('mouseup', finalizePaint);

// click the dark backdrop with a held stack: drop it into the world
invScreen.addEventListener('mousedown', (e) => {
  if (e.target !== invScreen || !inventory.cursor) return;
  const c = inventory.cursor;
  if (e.button === 0) {
    inventory.cursor = null;
    dropStacks([c]);
  } else if (e.button === 2) {
    c.n--;
    dropStacks([{ id: c.id, n: 1 }]);
    if (!c.n) inventory.cursor = null;
  }
  inventory._c();
});

// cursor stack + tooltip follow the mouse
invScreen.addEventListener('mousemove', (e) => {
  cursorStackEl.style.left = (e.clientX - 20) + 'px';
  cursorStackEl.style.top = (e.clientY - 20) + 'px';
  tooltipEl.style.left = (e.clientX + 16) + 'px';
  tooltipEl.style.top = (e.clientY - 24) + 'px';
});

function updateTooltip() {
  const s = hoveredSlot ? inventory.get(hoveredSlot.area, hoveredSlot.idx) : null;
  if (s && !inventory.cursor) {
    tooltipEl.textContent = ITEMS[s.id].name;
    tooltipEl.style.display = 'block';
  } else {
    tooltipEl.style.display = 'none';
  }
}

function renderCursorStack() {
  const c = inventory.cursor;
  if (c) {
    cursorStackEl.innerHTML = '';
    cursorStackEl.appendChild(iconCanvasFor(c.id, 40));
    if (c.n > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      cnt.textContent = c.n;
      cursorStackEl.appendChild(cnt);
    }
    cursorStackEl.style.display = 'block';
  } else {
    cursorStackEl.style.display = 'none';
  }
}

// --- rendering ---------------------------------------------------------------

function makeSlotEl(area, idx) {
  const s = inventory.get(area, idx);
  const el = document.createElement('div');
  el.className = 'inv-slot';
  if (s) {
    el.appendChild(iconCanvasFor(s.id, 36));
    if (s.n > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      cnt.textContent = s.n;
      el.appendChild(cnt);
    }
  }
  el.addEventListener('mousedown', (e) => onSlotMouseDown(e, area, idx));
  el.addEventListener('mouseenter', () => onSlotMouseEnter(area, idx));
  el.addEventListener('mouseleave', () => { hoveredSlot = null; updateTooltip(); });
  slotEls.set(slotKey(area, idx), el);
  return el;
}

function renderInvScreen() {
  slotEls.clear();

  const furnaceMode = invMode === 'furnace';
  const chestMode = invMode === 'chest';
  craftAreaEl.style.display = (furnaceMode || chestMode) ? 'none' : 'flex';
  furnacePanelEl.style.display = furnaceMode ? 'flex' : 'none';
  chestPanelEl.style.display = chestMode ? 'grid' : 'none';
  if (recipesColEl) recipesColEl.style.display = (furnaceMode || chestMode) ? 'none' : '';

  if (chestMode) {
    craftTitleEl.textContent = 'Chest';
    chestPanelEl.innerHTML = '';
    for (let i = 0; i < 27; i++) chestPanelEl.appendChild(makeSlotEl('furn', i));
  } else if (furnaceMode) {
    craftTitleEl.textContent = 'Furnace';
    furnInEl.innerHTML = ''; furnFuelEl.innerHTML = ''; furnOutEl.innerHTML = '';
    furnInEl.appendChild(makeSlotEl('furn', 0));
    furnFuelEl.appendChild(makeSlotEl('furn', 1));
    const outSlot = makeSlotEl('furn', 2);
    outSlot.classList.add('out');
    furnOutEl.appendChild(outSlot);
    updateFurnaceBars();
  } else {
    // crafting grid
    craftTitleEl.textContent = craftSize === 3 ? 'Crafting Table (3×3)' : 'Crafting (2×2)';
    craftGridEl.style.display = 'grid';
    craftGridEl.style.gap = '4px';
    craftGridEl.style.gridTemplateColumns = `repeat(${craftSize}, 42px)`;
    craftGridEl.innerHTML = '';
    for (let rr = 0; rr < craftSize; rr++)
      for (let cc = 0; cc < craftSize; cc++)
        craftGridEl.appendChild(makeSlotEl('craft', rr * 3 + cc));

    // result slot
    const r = currentRecipe();
    craftOutEl.innerHTML = '';
    craftOutEl.className = 'inv-slot out' + (r ? '' : ' empty');
    if (r) {
      craftOutEl.appendChild(iconCanvasFor(r.out, 44));
      if (r.n > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'cnt';
        cnt.textContent = r.n;
        craftOutEl.appendChild(cnt);
      }
      craftOutEl.title = ITEMS[r.out].name + ' — shift-click to craft all';
    }
    craftOutEl.onmousedown = (e) => {
      e.preventDefault();
      if (e.button === 0) takeResult(e.shiftKey);
    };
  }

  // armor slots
  armorRowEl.innerHTML = '';
  const armorPh = ['helm', 'chest', 'legs', 'boots'];
  for (let i = 0; i < 4; i++) {
    const el = makeSlotEl('armor', i);
    if (!inventory.armor[i]) {
      el.classList.add('armor-empty');
      el.dataset.ph = armorPh[i];
    }
    armorRowEl.appendChild(el);
  }

  // main inventory + hotbar rows
  invMainEl.innerHTML = '';
  for (let i = 9; i < 36; i++) invMainEl.appendChild(makeSlotEl('inv', i));
  invHotbarRowEl.innerHTML = '';
  for (let i = 0; i < 9; i++) invHotbarRowEl.appendChild(makeSlotEl('inv', i));

  // right column: creative block palette, or the recipe reference list
  craftList.innerHTML = '';
  craftList.classList.toggle('palette', isCreative());
  if (isCreative()) {
    recipesTitleEl.innerHTML = 'All Blocks &amp; Items <span class="tip">click = stack · right = one · shift = to inventory</span>';
    renderPalette();
  } else {
    recipesTitleEl.innerHTML = 'Recipes <span class="tip">click one to fill the grid</span>';
    for (const rec of RECIPES) {
      const ok = rec.in.every(([id, n]) => inventory.count(id) >= n);
      const row = document.createElement('div');
      row.className = 'craft-row' + (ok ? '' : ' locked');
      row.appendChild(iconCanvasFor(rec.out, 30));
      const name = document.createElement('span');
      name.className = 'c-name';
      name.innerHTML = ITEMS[rec.out].name + (rec.n > 1 ? ` ×${rec.n}` : '') +
        (rec.needsTable ? ' <span class="tag-table">table</span>' : '');
      row.appendChild(name);
      const ins = document.createElement('span');
      ins.className = 'c-in';
      ins.innerHTML = rec.in.map(([id, n]) =>
        `<span class="${inventory.count(id) >= n ? 'have' : 'miss'}">${n}× ${ITEMS[id].name}</span>`
      ).join(' + ');
      row.appendChild(ins);
      row.addEventListener('mousedown', (e) => { if (e.button === 0) autofillRecipe(rec); });
      craftList.appendChild(row);
    }
  }

  renderCursorStack();
  updateTooltip();
}

// --- creative palette: every block & item, free of charge ------------------

const PALETTE_IDS = Object.keys(ITEMS).map(Number).sort((a, b) => a - b);

function paletteTip(el, text) {
  el.addEventListener('mouseenter', () => {
    tooltipEl.textContent = text;
    tooltipEl.style.display = 'block';
  });
  el.addEventListener('mouseleave', () => updateTooltip());
}

function paletteClick(e, id) {
  e.preventDefault();
  const lim = maxStack(id);
  if (e.button === 0 && e.shiftKey) {
    const left = inventory.add(id, lim); // straight to the inventory
    if (left === lim) return; // full — nothing moved, skip the re-render
  } else if (e.button === 0) {
    inventory.cursor = { id, n: lim }; // grab a full stack
  } else if (e.button === 2) {
    if (!inventory.cursor) inventory.cursor = { id, n: 1 };
    else if (inventory.cursor.id === id) inventory.cursor.n = Math.min(lim, inventory.cursor.n + 1);
    else return;
  } else {
    return;
  }
  sfx.pop();
  inventory._c();
}

function renderPalette() {
  const trash = document.createElement('div');
  trash.className = 'inv-slot trash';
  trash.textContent = '✕';
  paletteTip(trash, 'Destroy the held stack');
  trash.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!inventory.cursor) return;
    inventory.cursor = null;
    sfx.break();
    inventory._c();
  });
  craftList.appendChild(trash);

  for (const id of PALETTE_IDS) {
    const el = document.createElement('div');
    el.className = 'inv-slot';
    el.appendChild(iconCanvasFor(id, 36));
    paletteTip(el, ITEMS[id].name);
    el.addEventListener('mousedown', (e) => paletteClick(e, id));
    craftList.appendChild(el);
  }
}

inventory.onChange = () => {
  renderHotbar();
  updateHeldItem();
  player.armorPoints = inventory.armorPoints();
  if (invOpen) renderInvScreen();
};
player.armorPoints = inventory.armorPoints();

// ---------------------------------------------------------------------------
// Input

const keys = new Set();
let locked = false;
let started = false;
let forceStarted = false; // for automated testing without pointer lock
let firstStartHint = isNewPlayer;

function isLocked() { return locked || forceStarted; }

document.getElementById('playBtn').addEventListener('click', () => {
  initAudio();
  canvas.requestPointerLock();
});

// Fullscreen + Keyboard Lock: in fullscreen the browser lets us capture
// shortcuts like Ctrl+W so sprinting can't close the tab.
const fullscreenBtn = document.getElementById('fullscreenBtn');
async function lockKeyboard() {
  try {
    if (navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock();
  } catch (e) { /* unsupported browser */ }
}
fullscreenBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (e) { }
});
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    lockKeyboard();
    fullscreenBtn.textContent = '⛶ Exit Fullscreen';
  } else {
    if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    fullscreenBtn.textContent = '⛶ Fullscreen';
  }
});
const sensSlider = document.getElementById('sensSlider');
const sensVal = document.getElementById('sensVal');
const bobToggle = document.getElementById('bobToggle');
sensSlider.value = prefs.sens;
sensVal.textContent = prefs.sens + '%';
bobToggle.checked = prefs.bob;
sensSlider.addEventListener('input', () => {
  prefs.sens = +sensSlider.value;
  sensVal.textContent = prefs.sens + '%';
  applySensitivity();
  savePrefs();
});
bobToggle.addEventListener('change', () => {
  prefs.bob = bobToggle.checked;
  savePrefs();
});

// New World: two-click confirm (confirm() dialogs are unreliable in embedded
// browsers) + suppress further saves so beforeunload can't resurrect the world.
let wipeSave = false;
let newWorldArmed = false;
let newWorldTimer = 0;
const newWorldBtn = document.getElementById('newWorldBtn');
newWorldBtn.addEventListener('click', () => {
  if (!newWorldArmed) {
    newWorldArmed = true;
    newWorldBtn.textContent = '⚠ Delete world? Click again';
    newWorldBtn.classList.add('danger');
    clearTimeout(newWorldTimer);
    newWorldTimer = setTimeout(() => {
      newWorldArmed = false;
      newWorldBtn.textContent = '✦ New World';
      newWorldBtn.classList.remove('danger');
    }, 4000);
    return;
  }
  clearTimeout(newWorldTimer);
  wipeSave = true;
  try {
    // tell every other open game tab to stop saving the old world
    localStorage.setItem('webcraft_wipe', String(Date.now()));
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { }
  // navigate with an explicit fresh seed: guarantees a new world even if a
  // stale save somehow survives or reappears
  location.href = location.pathname + '?seed=' + ((Math.random() * 0xffffffff) >>> 0);
});

// another tab hit New World: stop persisting this tab's (old) world
window.addEventListener('storage', (e) => {
  if (e.key === 'webcraft_wipe') wipeSave = true;
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) {
    started = true;
    overlay.classList.add('hidden');
    overlayTitle.textContent = 'PAUSED';
    document.getElementById('playBtn').textContent = '▶ Resume';
    if (firstStartHint) {
      firstStartHint = false;
      toast('Punch a tree trunk to gather wood — press E to craft!', 8);
    }
  } else {
    keys.clear();
    breakingHeld = placingHeld = false;
    if (!player.dead && !invOpen) overlay.classList.remove('hidden');
  }
});

document.addEventListener('mousemove', (e) => {
  if (locked) player.look(e.movementX, e.movementY);
});

let lastWRelease = -1;
let lastSpaceDown = -1;
document.addEventListener('keydown', (e) => {
  if (invOpen) {
    if (e.code === 'KeyE' || e.code === 'Escape') {
      e.preventDefault();
      closeInventory();
    } else if (hoveredSlot && e.code.startsWith('Digit')) {
      const n = +e.code.slice(5);
      if (n >= 1 && n <= 9) {
        e.preventDefault();
        inventory.swapWithHotbar(hoveredSlot.area, hoveredSlot.idx, n - 1);
      }
    } else if (hoveredSlot && e.code === 'KeyQ') {
      e.preventDefault();
      throwFromSlot(hoveredSlot.area, hoveredSlot.idx, e.ctrlKey || e.metaKey);
    }
    return;
  }
  if (!isLocked()) return;
  e.preventDefault(); // with keyboard lock active, keep every shortcut in-game
  // with the keyboard locked (fullscreen), Esc reaches us instead of the browser
  if (e.code === 'Escape') { document.exitPointerLock(); return; }
  // double-tap W to sprint: MC-style — arm if W is pressed shortly after it
  // was RELEASED, so re-tapping while already walking also works
  if (e.code === 'KeyW' && !e.repeat) {
    const now = performance.now() / 1000;
    if (now - lastWRelease < 0.35) player.wantSprint = true;
  }
  // double-tap Space toggles creative flight, like Minecraft
  if (e.code === 'Space' && !e.repeat) {
    const now = performance.now() / 1000;
    if (isCreative() && now - lastSpaceDown < 0.3) {
      player.fly = !player.fly;
      lastSpaceDown = -1; // consume the double-tap so a third press starts fresh
    } else {
      lastSpaceDown = now;
    }
  }
  keys.add(e.code);
  if (e.code === 'KeyF') {
    if (isCreative()) player.fly = !player.fly;
    else toast('Flying is creative-only', 1.2);
  }
  if (e.code === 'F3') debugEl.classList.toggle('show');
  if (e.code === 'KeyE') openInventory();
  if (e.code === 'KeyQ') throwFromSlot('inv', selected, e.ctrlKey || e.metaKey); // drop held item
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= 9) setSelected(n - 1);
  }
});
document.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyW') lastWRelease = performance.now() / 1000;
});
window.addEventListener('blur', () => { keys.clear(); breakingHeld = placingHeld = false; });

// non-passive so we can block Ctrl+scroll / pinch browser zoom while playing
document.addEventListener('wheel', (e) => {
  if (invOpen) {
    if (e.ctrlKey) e.preventDefault(); // no zoom, but keep panel scrolling
    return;
  }
  if (!isLocked()) return;
  e.preventDefault();
  setSelected(selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });

document.addEventListener('contextmenu', (e) => e.preventDefault());

let breakingHeld = false, placingHeld = false;
let placeCd = 0;
canvas.addEventListener('mousedown', (e) => {
  if (!isLocked() || invOpen) return;
  if (e.button === 0) breakingHeld = true;
  if (e.button === 1) { e.preventDefault(); pickBlock(); }
  if (e.button === 2) { placingHeld = true; useHeld(); placeCd = 0.25; }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) breakingHeld = false;
  if (e.button === 2) placingHeld = false;
  // mouse side buttons would navigate back/forward and dump you out of the game
  if ((e.button === 3 || e.button === 4) && (isLocked() || invOpen)) e.preventDefault();
});
document.addEventListener('mousedown', (e) => {
  if ((e.button === 3 || e.button === 4) && (isLocked() || invOpen)) e.preventDefault();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Interaction: voxel raycast (Amanatides & Woo DDA)

function raycastVoxel(ox, oy, oz, dx, dy, dz, maxDist) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMX = dx !== 0 ? (dx > 0 ? (x + 1 - ox) : (ox - x)) * tDX : Infinity;
  let tMY = dy !== 0 ? (dy > 0 ? (y + 1 - oy) : (oy - y)) * tDY : Infinity;
  let tMZ = dz !== 0 ? (dz > 0 ? (z + 1 - oz) : (oz - z)) * tDZ : Infinity;
  let t = 0, fx = 0, fy = 0, fz = 0;

  while (t <= maxDist) {
    if (t > 0) {
      const b = world.getBlock(x, y, z);
      if (b !== B.AIR && b !== B.WATER) return { x, y, z, id: b, face: [fx, fy, fz], t };
    }
    if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; fx = -stepX; fy = 0; fz = 0; }
    else if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; fx = 0; fy = -stepY; fz = 0; }
    else { z += stepZ; t = tMZ; tMZ += tDZ; fx = 0; fy = 0; fz = -stepZ; }
  }
  return null;
}

function currentTarget() {
  const eye = player.eye();
  const dir = player.forwardDir();
  return raycastVoxel(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, REACH);
}

// ---------------------------------------------------------------------------
// Mining (hold to break), attacking, placing, eating

let mining = null; // {x,y,z,blockId,progress,total}
let punchCd = 0;
let miningParticleT = 0;
let creativeBreakCd = 0;

function stopMining() {
  mining = null;
  crackMesh.visible = false;
}

function finishBreak(hit, info) {
  if (info.canHarvest && !isCreative()) { // creative breaks drop nothing
    const d = info.drop(Math.random());
    if (d) drops.spawn(d[0], d[1], hit.x + 0.5, hit.y + 0.35, hit.z + 0.5);
  }
  // broken containers spill their contents
  if (hit.id === B.FURNACE) {
    for (const s of furnaces.breakAt(dimPrefix() + furnaces.key(hit.x, hit.y, hit.z))) {
      drops.spawn(s.id, s.n, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { stack: true });
    }
  }
  if (hit.id === B.CHEST) {
    const ck = dimPrefix() + chests.key(hit.x, hit.y, hit.z);
    let spill = chests.breakAt(ck);
    if (!spill.length && !world.hasEdit(hit.x, hit.y, hit.z)) {
      // never-opened village chest: roll its loot so breaking doesn't waste it
      const tmp = { slots: new Array(27).fill(null) };
      fillChestLoot(tmp, ck);
      spill = tmp.slots.filter(Boolean);
    }
    for (const s of spill) {
      drops.spawn(s.id, s.n, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { stack: true });
    }
  }
  player.exhaustion += 0.005;
  // ice melts back into water below sea level
  world.setBlock(hit.x, hit.y, hit.z, (hit.id === B.ICE && hit.y <= SEA) ? B.WATER : B.AIR);
  // breaking the frame extinguishes attached portal blocks
  if (hit.id === B.OBSIDIAN) {
    const stack = DIRS6.map(d => [hit.x + d[0], hit.y + d[1], hit.z + d[2]]);
    let guard = 0;
    while (stack.length && guard++ < 300) {
      const [ax, ay, az] = stack.pop();
      if (world.getBlock(ax, ay, az) === B.PORTAL) {
        world.setBlock(ax, ay, az, B.AIR);
        for (const d of DIRS6) stack.push([ax + d[0], ay + d[1], az + d[2]]);
      }
    }
    dims[dim].portals = dims[dim].portals.filter(p => world.getBlock(p.x, p.y, p.z) === B.PORTAL);
  }
  liquidContact(hit.x, hit.y, hit.z); // freed water/lava may now touch
  const c = avgColors[hit.id] || [0.5, 0.5, 0.5];
  particles.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, c, 14, 3.2);
  sfx.break();
  stopMining();
}

function updateMining(dt) {
  punchCd -= dt;
  creativeBreakCd -= dt;
  if (!breakingHeld || player.dead || invOpen) { stopMining(); return; }

  const eye = player.eye();
  const dir = player.forwardDir();
  const mobHit = mobs.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, MOB_REACH);
  const hit = currentTarget();

  // Minecraft critical hits: attacking while falling deals 1.5x with sparks
  const attackDamage = () => {
    const base = itemDamage(heldId());
    const crit = !player.onGround && player.vel.y < 0 && !player.inWater && !player.fly;
    return { dmg: crit ? Math.round(base * 1.5) : base, crit };
  };
  const critFx = (x, y, z) => {
    particles.burst(x, y, z, [1, 0.85, 0.25], 12, 3.5);
    sfx.crit();
  };

  // attack mobs when the crosshair is on one
  if (mobHit && (!hit || mobHit.t < hit.t)) {
    stopMining();
    if (punchCd <= 0) {
      punchCd = 0.5;
      swingT = 0;
      player.exhaustion += 0.1;
      const { dmg, crit } = attackDamage();
      mobHit.mob.hurt(dmg, dir.x, dir.z, { player, world, particles });
      if (crit) critFx(mobHit.mob.pos.x, mobHit.mob.pos.y + mobHit.mob.height * 0.8, mobHit.mob.pos.z);
      else sfx.hit();
    }
    return;
  }
  // the dragon is a huge target — check it before blocks
  if (dim === 'end' && dragon && !dragon.dead) {
    const dt2 = dragon.rayHit(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, MOB_REACH + 2);
    if (dt2 !== null && (!hit || dt2 < hit.t)) {
      stopMining();
      if (punchCd <= 0) {
        punchCd = 0.5;
        swingT = 0;
        player.exhaustion += 0.1;
        const { dmg, crit } = attackDamage();
        dragon.hurt(dmg, { particles });
        if (crit) critFx(dragon.pos.x, dragon.pos.y + 1, dragon.pos.z);
        else sfx.hit();
      }
      return;
    }
  }
  if (!hit) { stopMining(); return; }

  // creative: everything (even bedrock) breaks instantly
  if (isCreative()) {
    stopMining();
    if (creativeBreakCd <= 0) {
      creativeBreakCd = 0.22;
      swingT = 0;
      const info = breakInfo(hit.id, heldId());
      finishBreak(hit, info || { canHarvest: false, drop: () => null });
    }
    return;
  }

  const info = breakInfo(hit.id, heldId());
  if (!info) { stopMining(); return; } // bedrock etc.

  if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z || mining.blockId !== hit.id) {
    mining = { x: hit.x, y: hit.y, z: hit.z, blockId: hit.id, progress: 0, total: info.time };
  }
  mining.progress += dt;

  if (swingT > 0.45) swingT = 0; // keep swinging while mining

  if (!info.canHarvest && info.needTool) {
    toast(`Needs a ${TIER_NAMES[Math.max(1, info.needTier)]} ${info.needTool} to drop items`, 0.4);
  }

  miningParticleT -= dt;
  if (miningParticleT <= 0) {
    miningParticleT = 0.18;
    const c = avgColors[hit.id] || [0.5, 0.5, 0.5];
    particles.burst(
      hit.x + 0.5 + hit.face[0] * 0.55,
      hit.y + 0.5 + hit.face[1] * 0.55,
      hit.z + 0.5 + hit.face[2] * 0.55,
      c, 2, 1.4
    );
    sfx.mine();
  }

  if (mining.progress >= mining.total) {
    finishBreak(hit, info);
    return;
  }
  const stage = Math.min(4, (mining.progress / mining.total * 5) | 0);
  crackMat.map = crackTextures[stage];
  crackMesh.visible = true;
  crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
}

// consume one item from the selected hotbar slot, optionally replacing it
function consumeHeld(replacementId = null) {
  if (isCreative()) return; // creative items are infinite
  const slot = inventory.slots[selected];
  if (!slot) return;
  slot.n--;
  if (!slot.n) inventory.slots[selected] = null;
  if (replacementId != null) {
    const left = inventory.add(replacementId, 1);
    if (left > 0) dropStacks([{ id: replacementId, n: left }]);
  }
  inventory._c();
}

// DDA raycast that stops at the first liquid (for bucket scooping)
function liquidTarget() {
  const eye = player.eye();
  const d = player.forwardDir();
  let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
  const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
  const tDX = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
  const tDY = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
  const tDZ = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
  let tMX = d.x !== 0 ? (d.x > 0 ? (x + 1 - eye.x) : (eye.x - x)) * tDX : Infinity;
  let tMY = d.y !== 0 ? (d.y > 0 ? (y + 1 - eye.y) : (eye.y - y)) * tDY : Infinity;
  let tMZ = d.z !== 0 ? (d.z > 0 ? (z + 1 - eye.z) : (eye.z - z)) * tDZ : Infinity;
  let t = 0;
  while (t <= REACH) {
    const b = world.getBlock(x, y, z);
    if (t > 0) {
      if (b === B.WATER || b === B.LAVA) return { x, y, z, id: b };
      if (b !== B.AIR) return null; // solid block in the way
    }
    if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; }
    else if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; }
    else { z += stepZ; t = tMZ; tMZ += tDZ; }
  }
  return null;
}

function useHeld() {
  if (player.dead || invOpen) return;
  const hit = currentTarget();
  // interacting with a crafting table / furnace takes precedence
  if (hit && hit.t < 5) {
    if (hit.id === B.CRAFTING_TABLE) { placingHeld = false; openInventory('table'); return; }
    if (hit.id === B.FURNACE) {
      placingHeld = false;
      openInventory('furnace', dimPrefix() + furnaces.key(hit.x, hit.y, hit.z));
      return;
    }
    if (hit.id === B.CHEST) {
      placingHeld = false;
      openInventory('chest', dimPrefix() + chests.key(hit.x, hit.y, hit.z), { x: hit.x, y: hit.y, z: hit.z });
      return;
    }
    if (hit.id === B.BED) {
      placingHeld = false;
      if (dim !== 'overworld') { toast('You can only sleep in the overworld'); return; }
      player.spawn = { x: hit.x + 0.5, y: hit.y + 1.02, z: hit.z + 0.5 };
      if (daylight < 0.3) {
        timeOfDay = 0.02; // dawn
        toast('You sleep through the night… spawn point set', 2.5);
        sfx.portal();
      } else {
        toast('Spawn point set — you can sleep here at night', 2);
        sfx.place();
      }
      save();
      return;
    }
  }
  const id = heldId();
  const it = ITEMS[id];
  if (!it) return;

  if (it.kind === 'block') {
    if (!hit) return;
    const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
    if (py < 0 || py >= HEIGHT) return;
    const existing = world.getBlock(px, py, pz);
    if (existing !== B.AIR && existing !== B.WATER) return;
    // only solid blocks can't overlap entities (liquids can be placed at your feet)
    if (BLOCKS[id].solid && (blockOverlapsEntity(px, py, pz, player) || mobs.anyOverlapping(px, py, pz))) return;
    if (!world.hasDataAt(px, pz)) return;
    swingT = 0;
    world.setBlock(px, py, pz, id);
    consumeHeld();
    sfx.place();
    // creative-placed liquids still react with each other
    if (id === B.WATER || id === B.LAVA) liquidContact(px, py, pz);
  } else if (it.kind === 'food') {
    if (player.hunger >= 20) { toast('Not hungry'); return; }
    swingT = 0;
    player.eat(it);
    consumeHeld();
    sfx.eat();
  } else if (it.kind === 'bucket') {
    swingT = 0;
    if (it.liquid == null) {
      // empty bucket: scoop the liquid we're looking at
      const lt = liquidTarget();
      if (!lt) return;
      world.setBlock(lt.x, lt.y, lt.z, B.AIR);
      consumeHeld(lt.id === B.LAVA ? I.LAVA_BUCKET : I.WATER_BUCKET);
      sfx.splash();
    } else {
      // filled bucket: pour into the cell in front of the targeted face
      if (!hit) return;
      const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
      if (py < 0 || py >= HEIGHT || !world.hasDataAt(px, pz)) return;
      const existing = world.getBlock(px, py, pz);
      if (existing !== B.AIR && existing !== B.WATER && existing !== B.LAVA) return;
      world.setBlock(px, py, pz, it.liquid === 'lava' ? B.LAVA : B.WATER);
      consumeHeld(I.BUCKET);
      sfx.splash();
      liquidContact(px, py, pz); // water + lava -> obsidian
    }
  } else if (it.kind === 'lighter') {
    if (!hit) return;
    swingT = 0;
    const lx = hit.x + hit.face[0], ly = hit.y + hit.face[1], lz = hit.z + hit.face[2];
    if (tryLightPortal(lx, ly, lz)) {
      sfx.portal();
      toast('The portal roars to life!', 2.5);
    } else {
      toast('Nothing to light — needs a sealed obsidian frame (2×3 inside)', 2);
    }
  } else if (it.kind === 'pearl') {
    swingT = 0;
    throwPearl();
    consumeHeld();
  } else if (it.kind === 'eye') {
    // eyes of ender socket into End portal frames
    if (hit && hit.id === B.END_FRAME && hit.t < 5) {
      swingT = 0;
      world.setBlock(hit.x, hit.y, hit.z, B.END_FRAME_FILLED);
      consumeHeld();
      sfx.place();
      if (!checkEndPortalComplete(hit.x, hit.y, hit.z)) toast('The eye locks into the frame…', 1.4);
    } else {
      // the eye flies toward the stronghold
      if (dim !== 'overworld') { toast('The eye lies still — it seeks something in the overworld', 2); return; }
      swingT = 0;
      const sh = worldOver.stronghold;
      const dx = sh.x - player.pos.x, dz = sh.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      launchEyeFlight(dx, dz, dist);
      if (dist < 12) toast('The eye plunges downward — dig beneath you!', 2.5);
      else toast(`The eye streaks ${compassDir(dx, dz)} — about ${Math.round(dist)} blocks`, 2.5);
      sfx.pop();
    }
  }
}

function compassDir(dx, dz) {
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
  return dirs[Math.round(a / (Math.PI / 4)) % 8];
}

// visual eye-of-ender flight: drifts toward the stronghold, then pops
const eyeFlights = [];
function launchEyeFlight(dx, dz, dist) {
  const eye = player.eye();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.35),
    new THREE.MeshBasicMaterial({ map: itemTexture(I.EYE_OF_ENDER), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
  );
  mesh.position.set(eye.x, eye.y, eye.z);
  scene.add(mesh);
  const l = Math.hypot(dx, dz) || 1;
  eyeFlights.push({
    pos: { x: eye.x, y: eye.y, z: eye.z },
    vel: dist < 12
      ? { x: 0, y: -5, z: 0 }                                // points straight down when on top of it
      : { x: (dx / l) * 9, y: 2.2, z: (dz / l) * 9 },
    ttl: 1.8, mesh,
  });
}

function updateEyeFlights(dt) {
  for (let i = eyeFlights.length - 1; i >= 0; i--) {
    const e = eyeFlights[i];
    e.ttl -= dt;
    e.vel.y -= 1.2 * dt;
    e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt; e.pos.z += e.vel.z * dt;
    e.mesh.position.set(e.pos.x, e.pos.y, e.pos.z);
    e.mesh.rotation.y += dt * 5;
    if (e.ttl <= 0) {
      particles.burst(e.pos.x, e.pos.y, e.pos.z, [0.5, 0.95, 0.7], 14, 2.5);
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      eyeFlights.splice(i, 1);
    }
  }
}

function pickBlock() {
  const hit = currentTarget();
  if (!hit) return;
  const idx = inventory.slots.findIndex((s, i) => i < 9 && s && s.id === hit.id);
  if (idx >= 0) setSelected(idx);
}

// ---------------------------------------------------------------------------
// Day / night cycle

const skyDay = new THREE.Color(0x87ceeb);
const skyNight = new THREE.Color(0x070b1c);
const skySunset = new THREE.Color(0xe87a3f);
const skyColor = new THREE.Color();
let daylight = 1;

const netherSky = new THREE.Color(0x1c0808);
const endSky = new THREE.Color(0x0b0714);

function updateDayNight(dt) {
  if (world.dim === 'end') {
    scene.background = endSky;
    scene.fog.color.copy(endSky);
    ambient.intensity = 0.6;
    sun.intensity = 0.18;
    sunMesh.visible = false;
    moonMesh.visible = false;
    stars.position.set(player.pos.x, player.pos.y, player.pos.z);
    starMat.opacity = 0.55; // endless night sky
    daylight = 0.35;
    return;
  }
  if (world.dim === 'nether') {
    scene.background = netherSky;
    scene.fog.color.copy(netherSky);
    ambient.intensity = 0.55;
    sun.intensity = 0.12;
    sunMesh.visible = false;
    moonMesh.visible = false;
    starMat.opacity = 0;
    daylight = 0.4; // constant gloom; no day/night in the nether
    return;
  }
  sunMesh.visible = true;
  moonMesh.visible = true;
  timeOfDay = (timeOfDay + dt / DAY_LEN) % 1;
  const a = timeOfDay * Math.PI * 2; // 0 = dawn, PI/2 = noon
  const sinA = Math.sin(a);
  daylight = Math.max(0, Math.min(1, (sinA + 0.12) / 0.42));
  const dl = daylight * daylight * (3 - 2 * daylight); // smoothstep

  ambient.intensity = 0.35 + 0.5 * dl;
  sun.intensity = 0.15 + 1.0 * dl;

  skyColor.copy(skyNight).lerp(skyDay, dl);
  const sunsetW = Math.max(0, 1 - Math.abs(sinA) * 4.5) * dl * 0.8;
  skyColor.lerp(skySunset, sunsetW);
  scene.background = skyColor;
  scene.fog.color.copy(skyColor);

  const p = player.pos;
  const sunDir = new THREE.Vector3(Math.cos(a), sinA, 0.35).normalize();
  sun.position.set(p.x + sunDir.x * 100, p.y + sunDir.y * 100, p.z + sunDir.z * 100);
  sun.target.position.set(p.x, p.y, p.z);

  sunMesh.position.set(p.x + sunDir.x * 380, p.y + sunDir.y * 380, p.z + sunDir.z * 380);
  sunMesh.lookAt(camera.position);
  moonMesh.position.set(p.x - sunDir.x * 380, p.y - sunDir.y * 380, p.z - sunDir.z * 380);
  moonMesh.lookAt(camera.position);
  stars.position.set(p.x, p.y, p.z);
  starMat.opacity = Math.max(0, 1 - dl * 1.6) * 0.9;
}

// ---------------------------------------------------------------------------
// Save

function save() {
  if (wipeSave) return; // world was just deleted via New World
  try {
    const edits = [];
    for (const [ck, m] of worldOver.edits) edits.push([ck, [...m]]);
    const editsN = [];
    for (const [ck, m] of worldNether.edits) editsN.push([ck, [...m]]);
    const editsE = [];
    for (const [ck, m] of worldEnd.edits) editsE.push([ck, [...m]]);
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: worldOver.seed,
      dim,
      gameMode: player.gameMode,
      editsN,
      editsE,
      dragonDefeated,
      portals: { overworld: dims.overworld.portals, nether: dims.nether.portals },
      timeOfDay,
      player: { pos: player.pos, spawn: player.spawn, yaw: player.yaw, pitch: player.pitch, hp: player.hp, hunger: player.hunger, saturation: player.saturation, sel: selected },
      inventory: inventory.serialize(),
      furnaces: furnaces.serialize(),
      chests: chests.serialize(),
      edits,
    }));
  } catch (e) { /* storage full or unavailable */ }
}
setInterval(save, 10000);
window.addEventListener('beforeunload', save);

// ---------------------------------------------------------------------------
// Main loop

const clock = new THREE.Clock();
let fps = 60, fpsSmooth = 60;
let debugT = 0;
let simTime = 0;
let bobPhase = 0, bobAmp = 0;

function animate() {
  requestAnimationFrame(animate);
  frame(Math.min(clock.getDelta(), 0.05));
}

function frame(dt) {
  simTime += dt;
  const time = simTime;
  fps = 1 / Math.max(dt, 1e-4);
  fpsSmooth += (fps - fpsSmooth) * 0.05;

  world.update(player.pos.x, player.pos.z, started ? 8 : 25);
  world.flushDirty();

  // singleplayer: the world pauses while the inventory is open —
  // except the furnace UI, which runs in real time like Minecraft containers
  const paused = invOpen && invMode !== 'furnace' && invMode !== 'chest'; // containers run in real time
  if ((started || forceStarted) && !paused) {
    player.update(dt, isLocked() ? keys : new Set(), time);
    mobs.update(dt, { world, player, daylight, time, sfx, particles, drops });
    drops.update(dt, { player, inventory, onPickup: () => sfx.pickup() });
    if (furnaces.tick(dt) && invOpen && invMode === 'furnace') renderInvScreen();
    if (dim === 'end' && dragon && !dragon.dead) dragon.update(dt, { player, time, sfx, particles });
    updatePearls(dt);
    updateEyeFlights(dt);
    updateMining(dt);

    // held-repeat placing / eating
    placeCd -= dt;
    if (placingHeld && placeCd <= 0) {
      useHeld();
      placeCd = ITEMS[heldId()]?.kind === 'food' ? 0.7 : 0.25;
    }
  }

  // camera follows player eye (interpolated between physics ticks)
  const eye = player.eye();

  // view bobbing: vertical oscillation + slight roll, paced like footsteps
  const hspd = Math.hypot(player.vel.x, player.vel.z);
  const bobTarget = (prefs.bob && player.onGround && !player.fly && hspd > 0.5) ? Math.min(1, hspd / 4.3) : 0;
  bobAmp += (bobTarget - bobAmp) * Math.min(1, 8 * dt);
  if (bobTarget > 0) bobPhase += dt * hspd * 0.45;
  const bobY = Math.abs(Math.sin(bobPhase * Math.PI)) * 0.04 * bobAmp;
  const bobRoll = Math.sin(bobPhase * Math.PI) * 0.007 * bobAmp;

  camera.position.set(eye.x, eye.y + bobY, eye.z);
  camera.rotation.set(player.pitch, player.yaw, bobRoll);

  // sprint FOV (70 base, +10% sprinting)
  const targetFov = player.sprinting ? 77 : 70;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, 10 * dt);
    camera.updateProjectionMatrix();
  }

  // held item swing animation
  swingT += dt * 7;
  if (heldMesh) {
    const s = Math.min(swingT, Math.PI);
    heldGroup.rotation.x = (ITEMS[heldId()]?.kind === 'block' ? 0.12 : 0.1) - Math.sin(s) * 0.6;
    heldGroup.position.y = -0.46 - Math.sin(s) * 0.12;
  }

  // block highlight
  const hit = (isLocked() && !invOpen) ? currentTarget() : null;
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  updateDayNight((started || forceStarted) && !paused ? dt : 0);
  particles.update(dt);
  updateHearts();

  // live furnace progress bars while its UI is open
  if (invOpen && invMode === 'furnace') updateFurnaceBars();

  // burning vignette (creative players don't burn)
  fireOverlayEl.style.opacity = (player.inLava || player.burnT > 0) && !player.dead && !isCreative() ? 0.75 : 0;

  // underwater overlay + fog (nether has its own closer fog)
  if (player.eyeInWater) {
    underwaterEl.style.opacity = 0.35;
    scene.fog.near = 2; scene.fog.far = 18;
  } else {
    underwaterEl.style.opacity = 0;
    scene.fog.near = world.dim === 'nether' ? 10 : renderDist * CHUNK * 0.55;
    scene.fog.far = renderDist * CHUNK * (world.dim === 'nether' ? 0.75 : world.dim === 'end' ? 1.15 : 0.95);
  }

  // stand in a portal to travel
  if ((started || forceStarted) && !paused && !player.dead) {
    const standIn = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.5), Math.floor(player.pos.z));
    inPortalNow = standIn === B.PORTAL || standIn === B.END_PORTAL;
    portalCd -= dt;
    if (inPortalNow && portalCd <= 0) {
      portalT += dt;
      const need = standIn === B.END_PORTAL ? 0.8 : 2;
      if (portalT >= need) {
        portalT = 0;
        if (standIn === B.END_PORTAL) {
          if (dim === 'end') leaveEnd();
          else enterEnd();
        } else {
          switchDimension(dim === 'nether' ? 'overworld' : 'nether');
        }
      }
    } else if (!inPortalNow) {
      portalT = Math.max(0, portalT - dt * 3);
    }
    portalOverlayEl.style.opacity = inPortalNow && portalCd <= 0 ? Math.min(0.85, 0.3 + (portalT / 2) * 0.55) : 0;
  } else if (player.dead) {
    portalOverlayEl.style.opacity = 0;
  }

  // boss bar
  const bossVisible = dim === 'end' && dragon && !dragon.dead;
  bossbarEl.classList.toggle('show', !!bossVisible);
  if (bossVisible) bossFillEl.style.width = (dragon.hp / dragon.maxHp * 100) + '%';

  // toast fade
  if (blockNameT > 0) {
    blockNameT -= dt;
    if (blockNameT <= 0) blockNameEl.style.opacity = 0;
  }

  // debug overlay
  debugT -= dt;
  if (debugT <= 0 && debugEl.classList.contains('show')) {
    debugT = 0.25;
    debugEl.textContent =
      `FPS ${fpsSmooth.toFixed(0)}  |  XYZ ${player.pos.x.toFixed(1)} / ${player.pos.y.toFixed(1)} / ${player.pos.z.toFixed(1)}\n` +
      `chunks ${world.chunks.size}  mobs ${mobs.mobs.length}  drops ${drops.list.length}  time ${timeOfDay.toFixed(2)}  daylight ${daylight.toFixed(2)}\n` +
      `seed ${world.seed >>> 0}  renderDist ${renderDist}  mode ${player.gameMode}  fly ${player.fly}`;
  }

  renderer.render(scene, camera);
}

// booted mid-End with the dragon still alive: bring it back
if (dim === 'end' && !dragonDefeated) {
  dragon = new Dragon(scene);
  dragon.onDeath = onDragonDeath;
}

applyGameMode(player.gameMode, { silent: true });
renderHotbar();
updateHeldItem();
updateHearts();
animate();

// ---------------------------------------------------------------------------
// Debug hooks (used by automated tests; harmless in production)

window.__game = {
  world, player, mobs, camera, renderer, particles, keys, inventory, drops, furnaces,
  setTime: (t) => { timeOfDay = t; },
  getTime: () => timeOfDay,
  getDaylight: () => daylight,
  forceStart: () => { forceStarted = true; started = true; overlay.classList.add('hidden'); },
  currentTarget, setSelected, useHeld,
  give: (id, n = 1) => inventory.add(id, n),
  breakTarget: () => {
    const hit = currentTarget();
    if (!hit) return null;
    const info = breakInfo(hit.id, heldId());
    if (!info) return null;
    finishBreak(hit, info);
    return hit;
  },
  openInventory, closeInventory, matchGrid,
  I, ITEMS, RECIPES,
  setCraftCells: (cells) => {
    inventory.craft = cells.slice(0, 9).map(id => (id == null ? null : { id, n: 1 }));
    while (inventory.craft.length < 9) inventory.craft.push(null);
    inventory._c();
  },
  getCraftState: () => ({ craftSize, craft: inventory.craft.map(s => (s ? [s.id, s.n] : null)), cursor: inventory.cursor, match: currentRecipe() }),
  craftFromGrid: () => takeResult(true),
  takeResult, dropStacks,
  slotClick: (area, idx, btn, shift) => {
    if (shift) inventory.quickMove(area, idx);
    else if (btn === 2) inventory.rightClick(area, idx);
    else inventory.leftClick(area, idx);
  },
  suppressSave: () => { wipeSave = true; },
  setGameMode: (m) => applyGameMode(m, { silent: true }),
  getGameMode: () => player.gameMode,
  getDim: () => dim,
  switchDimension, setDimension, tryLightPortal, dims,
  enterEnd, leaveEnd, checkEndPortalComplete, throwPearl,
  getDragon: () => dragon,
  chests, fillChestLoot,
  getStronghold: () => worldOver.stronghold,
  villageInfo: (gx, gz) => worldOver.villageInfo(gx, gz),
  isDragonDefeated: () => dragonDefeated,
  setDragonDefeated: (v) => { dragonDefeated = !!v; },
  respawnDragon: () => { if (!dragon) { dragon = new Dragon(scene); dragon.onDeath = onDragonDeath; dragon.group.visible = dim === 'end'; } },
  state: () => ({ breakingHeld, placingHeld, mining: mining && { ...mining }, invOpen, locked, forceStarted, punchCd }),
  setBreaking: (v) => { breakingHeld = v; },
  step: (dt = 0.05, n = 1) => { for (let i = 0; i < n; i++) frame(dt); },
};
