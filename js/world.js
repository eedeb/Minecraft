// Chunked voxel world: terrain generation (biomes, caves, ores, trees),
// block get/set with edit tracking, and chunk meshing with baked ambient occlusion.

import * as THREE from 'three';
import { Perlin, fbm2, hash2, hash3 } from './noise.js';
import { B, BLOCKS, isOpaque, tileUV } from './blocks.js';

export const CHUNK = 16;
export const HEIGHT = 80;
export const SEA = 30;

const AO_VALS = [1.0, 0.8, 0.64, 0.5];

// Face table: dir, 4 corners [x,y,z,u,v] (CCW from outside), base shade.
const FACES = [
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 0, 1, 0, 0], [1, 0, 0, 1, 0], [1, 1, 0, 1, 1], [1, 1, 1, 0, 1]] },
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 1, 1, 1, 1], [0, 1, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1, 0, 0], [1, 1, 1, 1, 0], [1, 1, 0, 1, 1], [0, 1, 0, 0, 1]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[0, 0, 0, 0, 0], [1, 0, 0, 1, 0], [1, 0, 1, 1, 1], [0, 0, 1, 0, 1]] },
  { dir: [0, 0, 1], shade: 0.72, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [1, 1, 1, 1, 1], [0, 1, 1, 0, 1]] },
  { dir: [0, 0, -1], shade: 0.72, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [0, 1, 0, 1, 1], [1, 1, 0, 0, 1]] },
];

const key = (cx, cz) => cx + ',' + cz;

export class World {
  constructor(seed, scene, materials, renderDist = 4) {
    this.seed = seed | 0;
    this.scene = scene;
    this.materials = materials; // {opaque, water}
    this.renderDist = renderDist;
    this.chunks = new Map();    // key -> {cx, cz, data, meshO, meshW, hasMesh}
    this.edits = new Map();     // chunkKey -> Map("lx,y,lz" -> id)
    this.dirty = new Set();
    this.pNoise = new Perlin(this.seed);
    this.pNoise2 = new Perlin(this.seed + 101);
    this.pCave1 = new Perlin(this.seed + 202);
    this.pCave2 = new Perlin(this.seed + 303);
    this._frame = 0;
  }

  // --- terrain shape -------------------------------------------------------

  columnInfo(x, z) {
    const p = this.pNoise, q = this.pNoise2;
    const hills = fbm2(p, x * 0.02, z * 0.02, 4);
    const continent = fbm2(p, x * 0.006 + 500, z * 0.006 + 500, 4);
    let h = 34 + hills * 7 + continent * 30;
    const mountain = fbm2(q, x * 0.0035 + 300, z * 0.0035 - 300, 3);
    if (mountain > 0.12) h += (mountain - 0.12) * 130;
    h = Math.round(Math.max(4, Math.min(HEIGHT - 8, h)));

    const desert = fbm2(q, x * 0.0045 + 1000, z * 0.0045 - 1000, 2) > 0.28 && h > SEA && h < 52;
    const cold = !desert && fbm2(q, x * 0.0028 + 2000, z * 0.0028 - 2000, 2) > 0.42;
    const snowy = h >= 62 || (cold && h > SEA);
    let treeDensity = 0;
    if (!desert && !snowy && h > SEA + 1 && h < 58) {
      const forest = fbm2(p, x * 0.008 - 800, z * 0.008 + 800, 2);
      treeDensity = forest > 0.15 ? 0.035 : 0.005;
    }
    return { h, desert, snowy, cold, treeDensity };
  }

  caveAt(x, y, z) {
    const n1 = this.pCave1.noise3(x * 0.045, y * 0.07, z * 0.045);
    const n2 = this.pCave2.noise3(x * 0.045, y * 0.07, z * 0.045);
    return n1 * n1 + n2 * n2 < 0.012;
  }

  genChunkData(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const PAD = 3; // extra columns so trees from neighbor chunks reach in
    const W = CHUNK + PAD * 2;
    const cols = new Array(W * W);
    const baseX = cx * CHUNK, baseZ = cz * CHUNK;
    for (let dz = -PAD; dz < CHUNK + PAD; dz++) {
      for (let dx = -PAD; dx < CHUNK + PAD; dx++) {
        cols[(dz + PAD) * W + (dx + PAD)] = this.columnInfo(baseX + dx, baseZ + dz);
      }
    }
    const colAt = (lx, lz) => cols[(lz + PAD) * W + (lx + PAD)];

    // base terrain
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = baseX + lx, wz = baseZ + lz;
        const { h, desert, snowy, cold } = colAt(lx, lz);
        const beach = h <= SEA + 1;
        for (let y = 0; y < HEIGHT; y++) {
          let id = B.AIR;
          if (y === 0 || (y === 1 && hash3(wx, y, wz, this.seed) < 0.5)) {
            id = B.BEDROCK;
          } else if (y <= h) {
            const carveOK = y > 2 && (h >= SEA + 2 ? true : y < h - 4);
            if (carveOK && this.caveAt(wx, y, wz)) {
              id = y <= 11 ? B.LAVA : B.AIR; // lava lakes in the deepest caves
            } else if (y < h - 3) {
              id = B.STONE;
              const r = hash3(wx, y, wz, this.seed ^ 0x51ab);
              if (r < 0.0025 && y < 14) id = B.DIAMOND_ORE;
              else if (r < 0.009 && y < 36) id = B.IRON_ORE;
              else if (r < 0.021 && y < 52) id = B.COAL_ORE;
            } else if (y < h) {
              id = (desert || beach) ? B.SAND : B.DIRT;
            } else { // y === h, surface
              if (desert || beach) id = B.SAND;
              else if (snowy) id = B.SNOW;
              else id = B.GRASS;
            }
          } else if (y <= SEA) {
            id = (y === SEA && cold) ? B.ICE : B.WATER; // frozen lakes in cold biomes
          }
          data[lx + lz * CHUNK + y * CHUNK * CHUNK] = id;
        }
      }
    }

    // trees (deterministic per world column; candidates include padding so
    // canopies crossing chunk borders generate consistently)
    const set = (lx, y, lz, id, onlyAir) => {
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= HEIGHT) return;
      const i = lx + lz * CHUNK + y * CHUNK * CHUNK;
      if (onlyAir && data[i] !== B.AIR) return;
      data[i] = id;
    };
    for (let dz = -PAD; dz < CHUNK + PAD; dz++) {
      for (let dx = -PAD; dx < CHUNK + PAD; dx++) {
        const info = colAt(dx, dz);
        if (info.treeDensity <= 0) continue;
        const wx = baseX + dx, wz = baseZ + dz;
        if (hash2(wx, wz, this.seed ^ 0x9e37) >= info.treeDensity) continue;
        const h = info.h;
        const th = 4 + ((hash2(wx, wz, this.seed + 7) * 3) | 0);
        set(dx, h, dz, B.DIRT, false);
        for (let dy = 1; dy <= th; dy++) set(dx, h + dy, dz, B.LOG, false);
        for (let dy = th - 2; dy <= th + 1; dy++) {
          const r = dy <= th - 1 ? 2 : 1;
          for (let ox = -r; ox <= r; ox++) {
            for (let oz = -r; oz <= r; oz++) {
              if (ox === 0 && oz === 0 && dy <= th) continue;
              if (Math.abs(ox) === r && Math.abs(oz) === r) {
                if (dy === th + 1) continue;
                if (hash3(wx + ox, h + dy, wz + oz, this.seed) < 0.5) continue;
              }
              set(dx + ox, h + dy, dz + oz, B.LEAVES, true);
            }
          }
        }
      }
    }

    // player edits
    const ce = this.edits.get(key(cx, cz));
    if (ce) {
      for (const [lkey, id] of ce) {
        const [lx, y, lz] = lkey.split(',').map(Number);
        if (lx >= 0 && lx < CHUNK && y >= 0 && y < HEIGHT && lz >= 0 && lz < CHUNK)
          data[lx + lz * CHUNK + y * CHUNK * CHUNK] = id;
      }
    }
    return data;
  }

  // --- chunk/block access --------------------------------------------------

  ensureData(cx, cz) {
    const k = key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = { cx, cz, data: this.genChunkData(cx, cz), meshO: null, meshW: null, hasMesh: false };
      this.chunks.set(k, c);
    }
    return c;
  }

  hasDataAt(wx, wz) {
    return this.chunks.has(key(Math.floor(wx / CHUNK), Math.floor(wz / CHUNK)));
  }

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= HEIGHT) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return B.AIR;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    return c.data[lx + lz * CHUNK + y * CHUNK * CHUNK];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return false;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return false;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    c.data[lx + lz * CHUNK + y * CHUNK * CHUNK] = id;

    const k = key(cx, cz);
    let ce = this.edits.get(k);
    if (!ce) { ce = new Map(); this.edits.set(k, ce); }
    ce.set(lx + ',' + y + ',' + lz, id);

    // mark dirty: this chunk + neighbors (incl. diagonals) when on a border,
    // since face culling and AO reach one block across.
    const dxs = lx === 0 ? [-1, 0] : lx === CHUNK - 1 ? [0, 1] : [0];
    const dzs = lz === 0 ? [-1, 0] : lz === CHUNK - 1 ? [0, 1] : [0];
    for (const dx of dxs) for (const dz of dzs) this.dirty.add(key(cx + dx, cz + dz));
    return true;
  }

  // Highest non-air block; returns {y, id} or null.
  getSurface(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== B.AIR) return { y, id: b };
    }
    return null;
  }

  // --- meshing ---------------------------------------------------------------

  buildChunkGeometry(c) {
    const { cx, cz, data } = c;
    const baseX = cx * CHUNK, baseZ = cz * CHUNK;
    const opq = { pos: [], nor: [], uv: [], col: [], idx: [] };
    const wat = { pos: [], nor: [], uv: [], idx: [] };
    const lav = { pos: [], nor: [], uv: [], idx: [] };

    const get = (lx, y, lz) => {
      if (y < 0) return B.BEDROCK;
      if (y >= HEIGHT) return B.AIR;
      if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK)
        return data[lx + lz * CHUNK + y * CHUNK * CHUNK];
      return this.getBlock(baseX + lx, y, baseZ + lz);
    };
    const occ = (lx, y, lz) => isOpaque(get(lx, y, lz)) ? 1 : 0;

    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const id = data[lx + lz * CHUNK + y * CHUNK * CHUNK];
          if (id === B.AIR) continue;
          const blk = BLOCKS[id];
          const water = id === B.WATER;
          const lava = id === B.LAVA;

          for (const f of FACES) {
            const nb = get(lx + f.dir[0], y + f.dir[1], lz + f.dir[2]);
            if (isOpaque(nb)) continue;
            if (nb === id && (water || lava || id === B.GLASS)) continue;

            const tile = f.dir[1] === 1 ? blk.top : f.dir[1] === -1 ? blk.bottom : blk.side;
            const r = tileUV(tile);
            const buf = water ? wat : lava ? lav : opq;
            const base = buf.pos.length / 3;

            // AO axes
            const a = f.dir[0] !== 0 ? 0 : f.dir[1] !== 0 ? 1 : 2;
            const t1 = a === 0 ? 1 : 0, t2 = a === 2 ? 1 : 2;
            const front = [lx, y, lz];
            front[a] += f.dir[a];

            const ao = [0, 0, 0, 0];
            for (let ci = 0; ci < 4; ci++) {
              const corner = f.corners[ci];
              buf.pos.push(lx + corner[0], y + corner[1], lz + corner[2]);
              buf.nor.push(f.dir[0], f.dir[1], f.dir[2]);
              buf.uv.push(corner[3] ? r.u1 : r.u0, corner[4] ? r.v1 : r.v0);
              if (!water && !lava) {
                const s1o = [...front], s2o = [...front], co = [...front];
                const sg1 = corner[t1] ? 1 : -1, sg2 = corner[t2] ? 1 : -1;
                s1o[t1] += sg1; s2o[t2] += sg2; co[t1] += sg1; co[t2] += sg2;
                const s1 = occ(s1o[0], s1o[1], s1o[2]);
                const s2 = occ(s2o[0], s2o[1], s2o[2]);
                const cc = occ(co[0], co[1], co[2]);
                const lvl = (s1 && s2) ? 3 : s1 + s2 + cc;
                ao[ci] = lvl;
                const l = f.shade * AO_VALS[lvl];
                opq.col.push(l, l, l);
              }
            }
            if (water || lava) {
              buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            } else if (ao[0] + ao[2] > ao[1] + ao[3]) {
              buf.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            } else {
              buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        }
      }
    }

    const makeGeo = (b, withColor) => {
      if (b.idx.length === 0) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b.nor), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b.uv), 2));
      if (withColor) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(b.col), 3));
      g.setIndex(b.idx);
      g.computeBoundingSphere();
      return g;
    };
    return { opaque: makeGeo(opq, true), water: makeGeo(wat, false), lava: makeGeo(lav, false) };
  }

  buildMesh(cx, cz) {
    const c = this.ensureData(cx, cz);
    this.disposeMeshes(c);
    const { opaque, water, lava } = this.buildChunkGeometry(c);
    if (opaque) {
      c.meshO = new THREE.Mesh(opaque, this.materials.opaque);
      c.meshO.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.scene.add(c.meshO);
    }
    if (water) {
      c.meshW = new THREE.Mesh(water, this.materials.water);
      c.meshW.position.set(cx * CHUNK, 0, cz * CHUNK);
      c.meshW.renderOrder = 1;
      this.scene.add(c.meshW);
    }
    if (lava) {
      c.meshL = new THREE.Mesh(lava, this.materials.lava);
      c.meshL.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.scene.add(c.meshL);
    }
    c.hasMesh = true;
  }

  disposeMeshes(c) {
    if (c.meshO) { this.scene.remove(c.meshO); c.meshO.geometry.dispose(); c.meshO = null; }
    if (c.meshW) { this.scene.remove(c.meshW); c.meshW.geometry.dispose(); c.meshW = null; }
    if (c.meshL) { this.scene.remove(c.meshL); c.meshL.geometry.dispose(); c.meshL = null; }
    c.hasMesh = false;
  }

  // --- per-frame management ------------------------------------------------

  update(px, pz, budgetMs = 10) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const R = this.renderDist;
    const t0 = performance.now();

    const missing = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const c = this.chunks.get(key(pcx + dx, pcz + dz));
        if (!c || !c.hasMesh) missing.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
      }
    }
    if (missing.length) {
      missing.sort((m, n) => m[0] - n[0]);
      for (const [, cx, cz] of missing) {
        if (performance.now() - t0 > budgetMs) break;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) this.ensureData(cx + dx, cz + dz);
        this.buildMesh(cx, cz);
      }
    }

    if (++this._frame % 240 === 0) this.unloadFar(pcx, pcz);
  }

  flushDirty() {
    if (this.dirty.size === 0) return;
    for (const k of this.dirty) {
      const c = this.chunks.get(k);
      if (c && c.hasMesh) this.buildMesh(c.cx, c.cz);
    }
    this.dirty.clear();
  }

  unloadFar(pcx, pcz) {
    const R = this.renderDist;
    for (const [k, c] of this.chunks) {
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > R + 3) { this.disposeMeshes(c); this.chunks.delete(k); }
      else if (d > R && c.hasMesh) this.disposeMeshes(c);
    }
  }

  // Find a dry spawn column near origin.
  findSpawn() {
    for (let r = 0; r < 40; r++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = (r === 0 && attempt === 0) ? 8 : Math.round((hash2(r, attempt, this.seed) - 0.5) * 2 * (r * 12 + 8));
        const z = (r === 0 && attempt === 0) ? 8 : Math.round((hash2(attempt, r, this.seed + 1) - 0.5) * 2 * (r * 12 + 8));
        const info = this.columnInfo(x, z);
        if (info.h > SEA + 1 && info.h < 58) return { x: x + 0.5, y: info.h + 1, z: z + 0.5 };
      }
    }
    return { x: 8.5, y: HEIGHT - 10, z: 8.5 };
  }
}
