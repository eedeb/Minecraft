// Shared AABB-vs-voxel physics for the player and mobs.
// Entities: pos = feet center {x,y,z}, vel {x,y,z}, half (xz half-width), height.

import { B, isSolid } from './blocks.js';

const EPS = 0.001;
const AXES = ['x', 'z', 'y'];

export function moveEntity(world, e, dt) {
  let onGround = false, hitWall = false;
  const maxDisp = Math.max(Math.abs(e.vel.x), Math.abs(e.vel.y), Math.abs(e.vel.z)) * dt;
  const steps = Math.max(1, Math.ceil(maxDisp / 0.4));
  const sdt = dt / steps;

  for (let s = 0; s < steps; s++) {
    for (const a of AXES) {
      const d = e.vel[a] * sdt;
      if (d === 0) continue;
      e.pos[a] += d;

      const x0 = Math.floor(e.pos.x - e.half), x1 = Math.floor(e.pos.x + e.half);
      const y0 = Math.floor(e.pos.y), y1 = Math.floor(e.pos.y + e.height);
      const z0 = Math.floor(e.pos.z - e.half), z1 = Math.floor(e.pos.z + e.half);

      let collided = false;
      let bound = d > 0 ? Infinity : -Infinity;
      for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
          for (let bx = x0; bx <= x1; bx++) {
            if (!isSolid(world.getBlock(bx, by, bz))) continue;
            collided = true;
            const cell = a === 'x' ? bx : a === 'y' ? by : bz;
            bound = d > 0 ? Math.min(bound, cell) : Math.max(bound, cell + 1);
          }
        }
      }
      if (collided) {
        if (a === 'y') {
          if (d > 0) e.pos.y = bound - e.height - EPS;
          else { e.pos.y = bound + EPS; onGround = true; }
        } else {
          e.pos[a] = d > 0 ? bound - e.half - EPS : bound + e.half + EPS;
          hitWall = true;
        }
        e.vel[a] = 0;
      }
    }
  }
  return { onGround, hitWall };
}

export function isWaterAt(world, x, y, z) {
  return world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER;
}

// Does block cell (bx,by,bz) overlap entity's AABB?
export function blockOverlapsEntity(bx, by, bz, e) {
  return bx + 1 > e.pos.x - e.half && bx < e.pos.x + e.half &&
    by + 1 > e.pos.y && by < e.pos.y + e.height &&
    bz + 1 > e.pos.z - e.half && bz < e.pos.z + e.half;
}

// Ray vs entity AABB, returns t or null.
export function rayVsEntity(ox, oy, oz, dx, dy, dz, e, maxT) {
  const minX = e.pos.x - e.half, maxX = e.pos.x + e.half;
  const minY = e.pos.y, maxY = e.pos.y + e.height;
  const minZ = e.pos.z - e.half, maxZ = e.pos.z + e.half;
  let t0 = 0, t1 = maxT;
  const slab = (o, d, mn, mx) => {
    if (Math.abs(d) < 1e-9) return o >= mn && o <= mx;
    let ta = (mn - o) / d, tb = (mx - o) / d;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    return t0 <= t1;
  };
  if (!slab(ox, dx, minX, maxX)) return null;
  if (!slab(oy, dy, minY, maxY)) return null;
  if (!slab(oz, dz, minZ, maxZ)) return null;
  return t0;
}
