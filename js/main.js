// WebCraft — a Minecraft clone for the browser.
// Entry point: rendering, input, interaction, HUD, day/night, save/load.

import * as THREE from 'three';
import { B, BLOCKS, PALETTE, buildAtlas, tileUV, computeAvgColors, isSolid } from './blocks.js';
import { World, CHUNK, HEIGHT, SEA } from './world.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { blockOverlapsEntity } from './physics.js';
import { initAudio, sfx } from './sound.js';

const SAVE_KEY = 'webcraft_save_v1';
const DAY_LEN = 300; // seconds per full day/night cycle
const REACH = 6;

// ---------------------------------------------------------------------------
// Save / load

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted save */ }
  return null;
}

const params = new URLSearchParams(location.search);
const saved = params.has('seed') ? null : loadSave();
const seed = params.has('seed') ? (parseInt(params.get('seed'), 10) | 0)
  : saved ? saved.seed
    : (Math.random() * 0xffffffff) | 0;
const renderDist = Math.min(8, Math.max(2, parseInt(params.get('rd') || '4', 10) || 4));

// ---------------------------------------------------------------------------
// Renderer / scene

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.colorSpace = THREE.SRGBColorSpace;

const materials = {
  opaque: new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 }),
  water: new THREE.MeshLambertMaterial({ map: atlasTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
};
const avgColors = computeAvgColors(atlasCanvas);

// ---------------------------------------------------------------------------
// World / player / mobs

const world = new World(seed, scene, materials, renderDist);
if (saved && saved.edits) {
  for (const [ck, entries] of saved.edits) world.edits.set(ck, new Map(entries));
}

const spawnPoint = world.findSpawn();
const player = new Player(world, spawnPoint);
if (saved && saved.player) {
  player.pos = { ...saved.player.pos };
  player.yaw = saved.player.yaw || 0;
  player.pitch = saved.player.pitch || 0;
  player.hp = saved.player.hp ?? 20;
}
let timeOfDay = saved?.timeOfDay ?? 0.28; // start just before noon
let selected = saved?.player?.sel ?? 0;

// build ground under the player synchronously so we don't fall through
{
  const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) world.ensureData(pcx + dx, pcz + dz);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) world.buildMesh(pcx + dx, pcz + dz);
}

const mobs = new MobManager(scene, world);

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
// Block highlight + held block viewmodel

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111 })
);
highlight.visible = false;
scene.add(highlight);

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

const heldGroup = new THREE.Group();
camera.add(heldGroup);
scene.add(camera);
let heldMesh = null;
let swingT = 10;
function updateHeldBlock() {
  if (heldMesh) { heldGroup.remove(heldMesh); heldMesh.geometry.dispose(); }
  heldMesh = new THREE.Mesh(makeBlockGeometry(PALETTE[selected]), materials.opaque);
  heldMesh.scale.setScalar(0.22);
  heldGroup.add(heldMesh);
  heldGroup.position.set(0.55, -0.48, -0.85);
  heldGroup.rotation.set(0.12, Math.PI / 5, 0);
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
document.getElementById('seedLabel').textContent = 'seed: ' + (seed >>> 0);

let blockNameT = 0;
function showBlockName() {
  blockNameEl.textContent = BLOCKS[PALETTE[selected]].name;
  blockNameEl.style.opacity = 1;
  blockNameT = 1.6;
}

const slotCanvases = [];
function buildHotbar() {
  hotbarEl.innerHTML = '';
  PALETTE.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selected ? ' sel' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tile = BLOCKS[id].side;
    const col = tile % 8, row = (tile / 8) | 0;
    ctx.drawImage(atlasCanvas, col * 16, row * 16, 16, 16, 2, 2, 36, 36);
    slot.appendChild(c);
    const num = document.createElement('span');
    num.textContent = i + 1;
    slot.appendChild(num);
    hotbarEl.appendChild(slot);
    slotCanvases.push(slot);
  });
}
function setSelected(i) {
  selected = ((i % PALETTE.length) + PALETTE.length) % PALETTE.length;
  document.querySelectorAll('#hotbar .slot').forEach((s, j) => s.classList.toggle('sel', j === selected));
  updateHeldBlock();
  showBlockName();
}

let lastHp = -1;
function updateHearts() {
  if (player.hp === lastHp) return;
  lastHp = player.hp;
  let html = '';
  for (let i = 0; i < 10; i++) {
    const full = player.hp >= (i + 1) * 2;
    const half = !full && player.hp >= i * 2 + 1;
    html += `<span class="${full ? 'full' : half ? 'half' : 'empty'}">♥</span>`;
  }
  heartsEl.innerHTML = html;
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
  document.exitPointerLock();
  deathScreen.classList.add('show');
};

document.getElementById('respawnBtn').addEventListener('click', () => {
  player.respawn();
  deathScreen.classList.remove('show');
  canvas.requestPointerLock();
});

// ---------------------------------------------------------------------------
// Input

const keys = new Set();
let locked = false;
let started = false;

function isLocked() { return locked || forceStarted; }
let forceStarted = false; // for automated testing without pointer lock

document.getElementById('playBtn').addEventListener('click', () => {
  initAudio();
  canvas.requestPointerLock();
});
document.getElementById('newWorldBtn').addEventListener('click', () => {
  if (!confirm('Delete this world and generate a new one?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  location.href = location.pathname;
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) {
    started = true;
    overlay.classList.add('hidden');
    overlayTitle.textContent = 'PAUSED';
    document.getElementById('playBtn').textContent = '▶ Resume';
  } else {
    keys.clear();
    breakingHeld = placingHeld = false;
    if (!player.dead) overlay.classList.remove('hidden');
  }
});

document.addEventListener('mousemove', (e) => {
  if (locked) player.look(e.movementX, e.movementY);
});

document.addEventListener('keydown', (e) => {
  if (!isLocked()) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'F3'].includes(e.code) || e.code === 'F3') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyF') player.fly = !player.fly;
  if (e.code === 'F3') debugEl.classList.toggle('show');
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= PALETTE.length) setSelected(n - 1);
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); breakingHeld = placingHeld = false; });

document.addEventListener('wheel', (e) => {
  if (!isLocked()) return;
  setSelected(selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

document.addEventListener('contextmenu', (e) => e.preventDefault());

let breakingHeld = false, placingHeld = false;
let actionCd = 0;
canvas.addEventListener('mousedown', (e) => {
  if (!isLocked()) return;
  if (e.button === 0) { breakingHeld = true; doAction('break'); }
  if (e.button === 1) { e.preventDefault(); pickBlock(); }
  if (e.button === 2) { placingHeld = true; doAction('place'); }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) breakingHeld = false;
  if (e.button === 2) placingHeld = false;
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

function doAction(kind) {
  if (player.dead) return;
  swingT = 0;
  const eye = player.eye();
  const dir = player.forwardDir();

  if (kind === 'break') {
    // punch mobs first
    const mobHit = mobs.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 3.5);
    const blockHit = currentTarget();
    if (mobHit && (!blockHit || mobHit.t < blockHit.t)) {
      mobHit.mob.hurt(6, dir.x, dir.z, { player });
      sfx.hit();
      return;
    }
    if (blockHit && BLOCKS[blockHit.id].breakable) {
      world.setBlock(blockHit.x, blockHit.y, blockHit.z, B.AIR);
      const c = avgColors[blockHit.id] || [0.5, 0.5, 0.5];
      particles.burst(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5, c, 14, 3.2);
      sfx.break();
    }
  } else if (kind === 'place') {
    const hit = currentTarget();
    if (!hit) return;
    const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
    if (py < 0 || py >= HEIGHT) return;
    const existing = world.getBlock(px, py, pz);
    if (existing !== B.AIR && existing !== B.WATER) return;
    if (blockOverlapsEntity(px, py, pz, player)) return;
    if (mobs.anyOverlapping(px, py, pz)) return;
    if (!world.hasDataAt(px, pz)) return;
    world.setBlock(px, py, pz, PALETTE[selected]);
    sfx.place();
  }
}

function pickBlock() {
  const hit = currentTarget();
  if (!hit) return;
  const idx = PALETTE.indexOf(hit.id);
  if (idx >= 0) setSelected(idx);
}

// ---------------------------------------------------------------------------
// Day / night cycle

const skyDay = new THREE.Color(0x87ceeb);
const skyNight = new THREE.Color(0x070b1c);
const skySunset = new THREE.Color(0xe87a3f);
const skyColor = new THREE.Color();
let daylight = 1;

function updateDayNight(dt) {
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
  try {
    const edits = [];
    for (const [ck, m] of world.edits) edits.push([ck, [...m]]);
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: world.seed,
      timeOfDay,
      player: { pos: player.pos, yaw: player.yaw, pitch: player.pitch, hp: player.hp, sel: selected },
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

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  fps = 1 / Math.max(dt, 1e-4);
  fpsSmooth += (fps - fpsSmooth) * 0.05;

  world.update(player.pos.x, player.pos.z, started ? 8 : 25);
  world.flushDirty();

  if (started || forceStarted) {
    player.update(dt, isLocked() ? keys : new Set(), time);
    mobs.update(dt, { world, player, daylight, time, sfx, particles });

    // held-repeat mining / placing
    actionCd -= dt;
    if ((breakingHeld || placingHeld) && actionCd <= 0) {
      actionCd = 0.22;
      doAction(breakingHeld ? 'break' : 'place');
    } else if (!breakingHeld && !placingHeld) {
      actionCd = 0;
    }
  }

  // camera follows player eye
  const eye = player.eye();
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  // sprint FOV
  const targetFov = player.sprinting ? 82 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, 10 * dt);
    camera.updateProjectionMatrix();
  }

  // held block swing animation
  swingT += dt * 7;
  if (heldMesh) {
    const s = Math.min(swingT, Math.PI);
    heldGroup.rotation.x = 0.12 - Math.sin(s) * 0.6;
    heldGroup.position.y = -0.42 - Math.sin(s) * 0.12;
  }

  // block highlight
  const hit = isLocked() || forceStarted ? currentTarget() : null;
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  updateDayNight(started || forceStarted ? dt : 0);
  particles.update(dt);
  updateHearts();

  // underwater overlay + fog
  if (player.eyeInWater) {
    underwaterEl.style.opacity = 0.35;
    scene.fog.near = 2; scene.fog.far = 18;
  } else {
    underwaterEl.style.opacity = 0;
    scene.fog.near = renderDist * CHUNK * 0.55;
    scene.fog.far = renderDist * CHUNK * 0.95;
  }

  // block name fade
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
      `chunks ${world.chunks.size}  mobs ${mobs.mobs.length}  time ${timeOfDay.toFixed(2)}  daylight ${daylight.toFixed(2)}\n` +
      `seed ${world.seed >>> 0}  renderDist ${renderDist}  fly ${player.fly}`;
  }

  renderer.render(scene, camera);
}

buildHotbar();
updateHeldBlock();
updateHearts();
animate();

// ---------------------------------------------------------------------------
// Debug hooks (used by automated tests; harmless in production)

window.__game = {
  world, player, mobs, camera, renderer, particles, keys,
  setTime: (t) => { timeOfDay = t; },
  getTime: () => timeOfDay,
  getDaylight: () => daylight,
  forceStart: () => { forceStarted = true; started = true; overlay.classList.add('hidden'); },
  doAction, currentTarget, setSelected,
};
