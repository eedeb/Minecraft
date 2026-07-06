// Mobs: passive animals (pig, sheep, cow) that wander, and zombies that
// spawn at night, chase the player, and burn in daylight.

import * as THREE from 'three';
import { moveEntity, isWaterAt, isLavaAt, rayVsEntity } from './physics.js';
import { B, isSolid } from './blocks.js';
import { I } from './items.js';

// [itemId, min, max] rolls per mob type
const DROP_TABLE = {
  pig: [[I.PORKCHOP, 1, 2]],
  sheep: [[B.WOOL, 1, 2], [I.MUTTON, 1, 1]],
  cow: [[I.BEEF, 1, 2]],
  zombie: [[I.FLESH, 0, 2]],
  blaze: [[I.BLAZE_ROD, 0, 1]],
};

const GRAVITY = 26;

const TYPES = {
  pig: { hp: 10, speed: 1.7, half: 0.35, height: 0.85, color: 0xf0a2a0 },
  sheep: { hp: 8, speed: 1.5, half: 0.4, height: 1.0, color: 0xe8e8e8 },
  cow: { hp: 10, speed: 1.5, half: 0.4, height: 1.25, color: 0x6e4a2f },
  zombie: { hp: 20, speed: 2.7, half: 0.3, height: 1.8, color: 0x5da357 },
  blaze: { hp: 20, speed: 1.6, half: 0.35, height: 1.6, color: 0xe8a428 },
};

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  return m;
}

// leg with pivot at the hip so it can swing
function leg(w, h, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.add(box(w, h, w, color, 0, -h / 2, 0));
  return pivot;
}

function eyes(head, hw, hz, color = 0x1a1a1a) {
  // hw: head half width, hz: front face z offset (local to head)
  head.add(box(0.07, 0.07, 0.02, color, -hw * 0.45, 0.05, hz));
  head.add(box(0.07, 0.07, 0.02, color, hw * 0.45, 0.05, hz));
}

// Models face -z (matches yaw math). Group origin at the feet.
const MODELS = {
  pig(g) {
    const c = 0xf0a2a0;
    g.add(box(0.65, 0.45, 1.0, c, 0, 0.5, 0.05));
    const head = box(0.45, 0.42, 0.4, c, 0, 0.62, -0.62);
    eyes(head, 0.22, -0.21);
    head.add(box(0.18, 0.14, 0.06, 0xd9827e, 0, -0.08, -0.22));
    g.add(head);
    const legs = [
      leg(0.16, 0.3, c, -0.2, 0.3, -0.3), leg(0.16, 0.3, c, 0.2, 0.3, -0.3),
      leg(0.16, 0.3, c, -0.2, 0.3, 0.35), leg(0.16, 0.3, c, 0.2, 0.3, 0.35),
    ];
    legs.forEach(l => g.add(l));
    return { legs, head };
  },
  sheep(g) {
    const wool = 0xe8e8e8, skin = 0xd9c2a7;
    g.add(box(0.75, 0.55, 1.1, wool, 0, 0.72, 0.05));
    const head = box(0.32, 0.32, 0.35, skin, 0, 0.95, -0.68);
    eyes(head, 0.16, -0.18);
    g.add(head);
    const legs = [
      leg(0.14, 0.45, skin, -0.2, 0.45, -0.32), leg(0.14, 0.45, skin, 0.2, 0.45, -0.32),
      leg(0.14, 0.45, skin, -0.2, 0.45, 0.38), leg(0.14, 0.45, skin, 0.2, 0.45, 0.38),
    ];
    legs.forEach(l => g.add(l));
    return { legs, head };
  },
  cow(g) {
    const body = 0x5d3f28, face = 0xcfc5b8;
    g.add(box(0.75, 0.55, 1.15, body, 0, 0.85, 0.05));
    const head = box(0.4, 0.38, 0.35, body, 0, 1.08, -0.72);
    eyes(head, 0.2, -0.18);
    head.add(box(0.26, 0.16, 0.05, face, 0, -0.12, -0.19));
    g.add(head);
    const legs = [
      leg(0.16, 0.58, body, -0.22, 0.58, -0.35), leg(0.16, 0.58, body, 0.22, 0.58, -0.35),
      leg(0.16, 0.58, body, -0.22, 0.58, 0.4), leg(0.16, 0.58, body, 0.22, 0.58, 0.4),
    ];
    legs.forEach(l => g.add(l));
    return { legs, head };
  },
  blaze(g) {
    const gold = 0xe8a428, dark = 0xb87818;
    const head = box(0.45, 0.45, 0.45, gold, 0, 1.25, 0);
    eyes(head, 0.22, -0.23, 0x2a1400);
    g.add(head);
    const rods = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      rods.add(box(0.12, 0.55, 0.12, dark, Math.cos(a) * 0.35, 0.6, Math.sin(a) * 0.35));
    }
    g.add(rods);
    return { legs: [], head, rods };
  },
  zombie(g) {
    const skin = 0x5da357, shirt = 0x2f7ba6, pants = 0x35506e;
    const legs = [
      leg(0.2, 0.75, pants, -0.13, 0.75, 0), leg(0.2, 0.75, pants, 0.13, 0.75, 0),
    ];
    legs.forEach(l => g.add(l));
    g.add(box(0.5, 0.6, 0.26, shirt, 0, 1.05, 0));
    // arms stretched forward
    g.add(box(0.16, 0.16, 0.65, skin, -0.33, 1.28, -0.3));
    g.add(box(0.16, 0.16, 0.65, skin, 0.33, 1.28, -0.3));
    const head = box(0.45, 0.45, 0.45, skin, 0, 1.6, 0);
    eyes(head, 0.22, -0.23, 0x330000);
    g.add(head);
    return { legs, head };
  },
};

let nextId = 1;

export class Mob {
  constructor(type, x, y, z) {
    const t = TYPES[type];
    this.id = nextId++;
    this.type = type;
    this.hostile = type === 'zombie' || type === 'blaze';
    this.flying = type === 'blaze';
    this.shootCd = 2 + Math.random() * 2;
    this.hp = t.hp;
    this.speed = t.speed;
    this.half = t.half;
    this.height = t.height;
    this.color = t.color;
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.moveT = 0;      // >0 while walking
    this.idleT = Math.random() * 2;
    this.walkPhase = 0;
    this.jumpCd = 0;
    this.attackCd = 0;
    this.flashT = 0;
    this.burnT = 0;
    this.dead = false;

    this.group = new THREE.Group();
    this.parts = MODELS[type](this.group);
    this.group.position.set(x, y, z);
    // per-mob materials so hurt-flash doesn't affect the whole species
    this.mats = [];
    this.group.traverse(o => {
      if (o.isMesh) {
        o.material = o.material.clone();
        this.mats.push({ m: o.material, c: o.material.color.getHex() });
      }
    });
  }

  update(dt, ctx) {
    const { world, player, daylight, time } = ctx;
    if (!world.hasDataAt(this.pos.x, this.pos.z)) return; // chunk unloaded: freeze

    this.jumpCd -= dt;
    this.attackCd -= dt;

    // --- AI ---
    let wantSpeed = 0;
    if (this.flying) {
      // blaze: hover near the player, lob fireballs
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      this.shootCd -= dt;
      if (!player.dead && dist < 24) {
        this.targetYaw = Math.atan2(-dx, -dz);
        if (dist > 9) wantSpeed = this.speed;
        else if (dist < 5) wantSpeed = -this.speed * 0.5;
        if (this.shootCd <= 0 && dist < 16) {
          this.shootCd = 2.5 + Math.random() * 1.5;
          if (ctx.shoot) ctx.shoot(this);
        }
        if (dist < 1.4 && this.attackCd <= 0) {
          this.attackCd = 1.2;
          player.damage(2, time, 'fire');
          player.burnT = Math.max(player.burnT, 1.5);
          if (ctx.sfx) ctx.sfx.hurt();
        }
      } else {
        wantSpeed = this.wander(dt) * 0.5;
      }
    } else if (this.hostile) {
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      // burn in daylight
      if (daylight > 0.5) {
        this.burnT += dt;
        if (this.burnT > 0.4) {
          this.hp -= 3 * dt;
          this.flashT = 0.1;
          if (this.hp <= 0) this.dead = true;
        }
      }
      if (!player.dead && dist < 24) {
        this.targetYaw = Math.atan2(-dx, -dz);
        wantSpeed = this.speed;
        const dy = Math.abs((player.pos.y) - this.pos.y);
        if (dist < 1.6 && dy < 2 && this.attackCd <= 0) {
          this.attackCd = 1.1;
          player.damage(3, time, 'attack');
          // knock the player back
          const kx = dx / (dist || 1), kz = dz / (dist || 1);
          player.vel.x += kx * 7;
          player.vel.z += kz * 7;
          player.vel.y += 3.5;
          if (ctx.sfx) ctx.sfx.hurt();
        }
      } else {
        wantSpeed = this.wander(dt);
      }
    } else {
      wantSpeed = this.wander(dt);
    }

    // smooth turn
    let dyaw = this.targetYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, 8 * dt);

    // --- physics ---
    const inWater = isWaterAt(world, this.pos.x, this.pos.y + 0.3, this.pos.z);
    const mx = -Math.sin(this.yaw) * wantSpeed;
    const mz = -Math.cos(this.yaw) * wantSpeed;
    const blend = Math.min(1, 10 * dt);
    this.vel.x += (mx - this.vel.x) * blend;
    this.vel.z += (mz - this.vel.z) * blend;
    if (this.flying) {
      // hover: drift toward the player's eye level + a gentle bob
      const targetY = (ctx.player.pos.y + 1.5) + Math.sin(this.walkPhase + this.id) * 0.5;
      const dy = targetY - this.pos.y;
      this.vel.y += (Math.max(-2, Math.min(2, dy)) - this.vel.y) * Math.min(1, 3 * dt);
      this.walkPhase += dt * 1.5;
    } else if (inWater) {
      this.vel.y += (2.2 - this.vel.y) * Math.min(1, 3 * dt); // float up / bob
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -50) this.vel.y = -50;
    }
    const { onGround, hitWall } = moveEntity(world, this, dt);
    if (hitWall && onGround && !this.flying && wantSpeed > 0 && this.jumpCd <= 0) {
      this.vel.y = 7.5; // hop up 1-block steps
      this.jumpCd = 0.5;
    }
    if (this.pos.y < -20) this.dead = true;

    // mobs burn in lava (blazes are fireproof)
    if (!this.flying && isLavaAt(world, this.pos.x, this.pos.y + 0.2, this.pos.z)) {
      this.hp -= 4 * dt;
      this.flashT = 0.15;
      this.burnT = 1;
      if (this.hp <= 0) this.dead = true;
    }

    // --- animation ---
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (!this.flying) this.walkPhase += hspeed * dt * 3.2;
    const swing = Math.sin(this.walkPhase * Math.PI) * Math.min(1, hspeed) * 0.55;
    this.parts.legs.forEach((l, i) => { l.rotation.x = (i % 2 === 0 ? swing : -swing); });
    if (this.parts.rods) this.parts.rods.rotation.y += dt * 2.5;

    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.yaw;

    // hurt/burn flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      const red = this.burnT > 0.4 ? 0xff7722 : 0xff3333;
      this.mats.forEach(({ m }) => m.color.setHex(red));
      if (this.flashT <= 0) this.mats.forEach(({ m, c }) => m.color.setHex(c));
    }
  }

  wander(dt) {
    this.idleT -= dt;
    if (this.moveT > 0) {
      this.moveT -= dt;
      return this.speed * 0.8;
    }
    if (this.idleT <= 0) {
      if (Math.random() < 0.55) {
        this.targetYaw = Math.random() * Math.PI * 2;
        this.moveT = 1.5 + Math.random() * 3;
      }
      this.idleT = 1 + Math.random() * 3;
    }
    return 0;
  }

  hurt(dmg, kbX, kbZ, ctx) {
    this.hp -= dmg;
    this.flashT = 0.25;
    this.vel.x += kbX * 8;
    this.vel.z += kbZ * 8;
    this.vel.y = 5;
    if (this.hostile) this.targetYaw = Math.atan2(-(ctx.player.pos.x - this.pos.x), -(ctx.player.pos.z - this.pos.z));
    if (this.hp <= 0) this.dead = true;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
  }
}

const shotGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
const shotMat = new THREE.MeshBasicMaterial({ color: 0xff8c1a });

export class MobManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mobs = [];
    this.shots = []; // blaze fireballs
    this.spawnT = 2;
    this.passiveCap = 8;
    this.zombieCap = 6;
    this.blazeCap = 5;
  }

  // hide/show everything when the player switches dimension
  setActive(v) {
    for (const m of this.mobs) m.group.visible = v;
    for (const s of this.shots) s.mesh.visible = v;
  }

  spawnShot(mob, player) {
    const ox = mob.pos.x, oy = mob.pos.y + 1.2, oz = mob.pos.z;
    const tx = player.pos.x - ox, ty = (player.pos.y + 1.2) - oy, tz = player.pos.z - oz;
    const len = Math.hypot(tx, ty, tz) || 1;
    const mesh = new THREE.Mesh(shotGeo, shotMat);
    mesh.position.set(ox, oy, oz);
    this.scene.add(mesh);
    this.shots.push({
      pos: { x: ox, y: oy, z: oz },
      vel: { x: (tx / len) * 11, y: (ty / len) * 11, z: (tz / len) * 11 },
      ttl: 4, mesh,
    });
  }

  updateShots(dt, ctx) {
    const p = ctx.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.ttl -= dt;
      s.pos.x += s.vel.x * dt; s.pos.y += s.vel.y * dt; s.pos.z += s.vel.z * dt;
      s.mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      s.mesh.rotation.x += dt * 8; s.mesh.rotation.y += dt * 6;
      const hitPlayer = !p.dead &&
        Math.abs(s.pos.x - p.pos.x) < 0.6 && Math.abs(s.pos.z - p.pos.z) < 0.6 &&
        s.pos.y > p.pos.y - 0.2 && s.pos.y < p.pos.y + 2.0;
      const b = ctx.world.getBlock(Math.floor(s.pos.x), Math.floor(s.pos.y), Math.floor(s.pos.z));
      const hitBlock = isSolid(b);
      if (hitPlayer) {
        p.damage(4, ctx.time, 'fire');
        p.burnT = Math.max(p.burnT, 2);
        if (ctx.sfx) ctx.sfx.hurt();
      }
      if (s.ttl <= 0 || hitPlayer || hitBlock) {
        if (ctx.particles) ctx.particles.burst(s.pos.x, s.pos.y, s.pos.z, [1, 0.55, 0.1], 8, 2.5);
        this.scene.remove(s.mesh);
        this.shots.splice(i, 1);
      }
    }
  }

  update(dt, ctx) {
    ctx.shoot = (mob) => { this.spawnShot(mob, ctx.player); if (ctx.sfx) ctx.sfx.fireball(); };
    for (const m of this.mobs) m.update(dt, ctx);
    this.updateShots(dt, ctx);

    // remove dead / distant
    const p = ctx.player.pos;
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const far = Math.hypot(m.pos.x - p.x, m.pos.z - p.z) > 80;
      if (m.dead || far) {
        if (m.dead && ctx.particles) {
          const c = new THREE.Color(m.color);
          ctx.particles.burst(m.pos.x, m.pos.y + m.height / 2, m.pos.z, [c.r, c.g, c.b], 16, 3);
          if (ctx.sfx) ctx.sfx.pop();
          if (ctx.drops) {
            for (const [id, min, max] of DROP_TABLE[m.type] || []) {
              const n = min + Math.floor(Math.random() * (max - min + 1));
              if (n > 0) ctx.drops.spawn(id, n, m.pos.x, m.pos.y + 0.4, m.pos.z);
            }
          }
        }
        m.dispose(this.scene);
        this.mobs.splice(i, 1);
      }
    }

    // spawn attempts
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 2;
      this.trySpawn(ctx);
    }
  }

  trySpawn(ctx) {
    const { player, daylight } = ctx;

    const ang = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 24;
    const x = Math.floor(player.pos.x + Math.cos(ang) * dist);
    const z = Math.floor(player.pos.z + Math.sin(ang) * dist);
    if (!this.world.hasDataAt(x, z)) return;

    // the nether spawns blazes in mid-air pockets
    if (this.world.dim === 'nether') {
      const blazes = this.mobs.filter(m => m.type === 'blaze').length;
      if (blazes >= this.blazeCap) return;
      for (let y = 30; y < 52; y++) {
        if (this.world.getBlock(x, y, z) === B.AIR && this.world.getBlock(x, y + 1, z) === B.AIR) {
          const mob = new Mob('blaze', x + 0.5, y + 0.01, z + 0.5);
          this.mobs.push(mob);
          this.scene.add(mob.group);
          return;
        }
      }
      return;
    }

    const night = daylight < 0.25;
    const passives = this.mobs.filter(m => !m.hostile).length;
    const zombies = this.mobs.length - passives;

    let type = null;
    if (night && zombies < this.zombieCap && Math.random() < 0.7) {
      type = 'zombie';
    } else if (passives < this.passiveCap) {
      type = ['pig', 'sheep', 'cow'][(Math.random() * 3) | 0];
    }
    if (!type) return;

    const surf = this.world.getSurface(x, z);
    if (!surf || surf.id === B.WATER || surf.id === B.LEAVES) return;
    if (surf.y >= 70) return;
    // passive animals prefer grass
    if (!TYPES[type]) return;
    if (type !== 'zombie' && surf.id !== B.GRASS && surf.id !== B.SAND && surf.id !== B.SNOW) return;

    const mob = new Mob(type, x + 0.5, surf.y + 1.01, z + 0.5);
    this.mobs.push(mob);
    this.scene.add(mob.group);
  }

  // Ray vs all mob AABBs; returns {mob, t} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    for (const m of this.mobs) {
      const t = rayVsEntity(ox, oy, oz, dx, dy, dz, m, maxT);
      if (t !== null && (!best || t < best.t)) best = { mob: m, t };
    }
    return best;
  }

  anyOverlapping(bx, by, bz) {
    for (const m of this.mobs) {
      if (bx + 1 > m.pos.x - m.half && bx < m.pos.x + m.half &&
        by + 1 > m.pos.y && by < m.pos.y + m.height &&
        bz + 1 > m.pos.z - m.half && bz < m.pos.z + m.half) return true;
    }
    return false;
  }

  // For debugging / testing from the console.
  forceSpawn(type, x, y, z) {
    const mob = new Mob(type, x, y, z);
    this.mobs.push(mob);
    this.scene.add(mob.group);
    return mob;
  }
}
