// Minecraft Java Edition-style player physics.
// Fixed 20 ticks/second simulation with per-tick constants (velocity stored in
// blocks/second externally, converted to blocks/tick inside the tick).
// Rendering interpolates between the last two ticks.

import { moveEntity, isWaterAt } from './physics.js';
import { BLOCKS } from './blocks.js';

const TICK = 0.05;          // 20 ticks per second
const BPS = 1 / TICK;       // blocks/tick -> blocks/second

// per-tick constants (Java Edition)
const GRAVITY = 0.08;       // vy = (vy - 0.08) * 0.98  => terminal ~-3.92 b/t
const AIR_DRAG_Y = 0.98;
const JUMP_VEL = 0.42;      // ~1.25 block jump
const AIR_FRICTION = 0.91;
const ACCEL_GROUND = 0.1;   // => ~4.32 b/s walking on slip 0.6
const ACCEL_AIR = 0.02;     // => strong air control, ~same top speed
const SPRINT_MULT = 1.3;    // => ~5.6 b/s
const SNEAK_MULT = 0.3;     // => ~1.3 b/s
const WATER_FRICTION = 0.8;
const WATER_ACCEL = 0.022;  // => ~2.2 b/s swim
const WATER_GRAVITY = 0.02;

const EYE_STAND = 1.62;
const EYE_SNEAK = 1.27;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.prevPos = { ...this.pos };
    this.spawn = { ...spawn };
    this.vel = { x: 0, y: 0, z: 0 }; // blocks/second
    this.yaw = 0;
    this.pitch = -0.1;
    this.half = 0.3;      // 0.6 wide AABB
    this.height = 1.8;
    this.eyeH = EYE_STAND;
    this.prevEyeH = EYE_STAND;
    this.stepHeight = 0.6;
    this.hp = 20;
    this.maxHp = 20;
    this.fly = false;
    this.sneaking = false;
    this.sprinting = false;
    this.wantSprint = false;
    this.onGround = false;
    this.inWater = false;
    this.eyeInWater = false;
    this.fallDist = 0;
    this.jumpDelay = 0;
    this.lastDamage = -99;
    this.lastRegen = 0;
    this.dead = false;
    this.acc = 0;          // tick accumulator
    this.renderAlpha = 1;
    this.lookFactor = 0.6 * 0.6 * 0.6 * 8 * 0.15 * Math.PI / 180; // set by prefs
    this.onDamage = null;
    this.onDeath = null;
  }

  // Minecraft sensitivity: f = sens*0.6+0.2; radians = delta * f^3 * 8 * 0.15deg
  look(dx, dy) {
    this.yaw -= dx * this.lookFactor;
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch - dy * this.lookFactor));
  }

  // interpolated eye position for rendering / raycasts
  eye() {
    const a = this.renderAlpha;
    return {
      x: this.prevPos.x + (this.pos.x - this.prevPos.x) * a,
      y: this.prevPos.y + (this.pos.y - this.prevPos.y) * a
        + this.prevEyeH + (this.eyeH - this.prevEyeH) * a,
      z: this.prevPos.z + (this.pos.z - this.prevPos.z) * a,
    };
  }

  forwardDir() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp,
    };
  }

  update(dt, keys, time) {
    if (this.dead) return;
    this.acc += dt;
    let ticks = 0;
    while (this.acc >= TICK && ticks < 4) {
      this.acc -= TICK;
      this.tick(keys, time);
      ticks++;
    }
    if (this.acc >= TICK) this.acc = TICK - 1e-6; // drop ticks under heavy lag
    this.renderAlpha = this.acc / TICK;
  }

  slipUnder() {
    const b = this.world.getBlock(
      Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
    return (BLOCKS[b] && BLOCKS[b].slip) || 0.6;
  }

  // is there ground under the AABB if it were at (px, pz), within stepHeight below?
  hasFooting(px, pz) {
    const x0 = Math.floor(px - this.half), x1 = Math.floor(px + this.half);
    const z0 = Math.floor(pz - this.half), z1 = Math.floor(pz + this.half);
    const y0 = Math.floor(this.pos.y - this.stepHeight), y1 = Math.floor(this.pos.y - 0.001);
    for (let by = y0; by <= y1; by++)
      for (let bz = z0; bz <= z1; bz++)
        for (let bx = x0; bx <= x1; bx++) {
          const blk = BLOCKS[this.world.getBlock(bx, by, bz)];
          if (blk && blk.solid) return true;
        }
    return false;
  }

  tick(keys, time) {
    if (!this.world.hasDataAt(this.pos.x, this.pos.z)) {
      this.prevPos = { ...this.pos };
      this.prevEyeH = this.eyeH;
      return;
    }
    this.prevPos = { ...this.pos };
    this.prevEyeH = this.eyeH;
    if (this.jumpDelay > 0) this.jumpDelay--;

    this.inWater = isWaterAt(this.world, this.pos.x, this.pos.y + 0.4, this.pos.z)
      || isWaterAt(this.world, this.pos.x, this.pos.y, this.pos.z);
    this.eyeInWater = isWaterAt(this.world, this.pos.x, this.pos.y + this.eyeH, this.pos.z);

    // --- input ---
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const jump = keys.has('Space');
    const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
    this.sneaking = shift && !this.fly;
    // sprint is triggered only by double-tap W (modifier keys collide with
    // browser/OS shortcuts like Cmd+W / Ctrl+W)
    if (f <= 0 || this.sneaking) this.wantSprint = false;
    this.sprinting = this.wantSprint && !this.fly && !this.inWater;

    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
    let wx = f * fwdX + s * rightX;
    let wz = f * fwdZ + s * rightZ;
    const wlen = Math.hypot(wx, wz);
    if (wlen > 1e-6) { wx /= wlen; wz /= wlen; }

    // --- velocity in blocks/tick ---
    let vx = this.vel.x * TICK, vy = this.vel.y * TICK, vz = this.vel.z * TICK;
    const slip = this.onGround ? this.slipUnder() : 0.6;

    if (this.fly) {
      const spd = 0.5; // 10 b/s creative flight
      vx += (wx * spd - vx) * 0.5;
      vz += (wz * spd - vz) * 0.5;
      const tvy = (jump ? spd : 0) + (shift ? -spd : 0);
      vy += (tvy - vy) * 0.5;
    } else if (this.inWater) {
      vx += wx * WATER_ACCEL;
      vz += wz * WATER_ACCEL;
      if (jump) vy += 0.05;
    } else {
      const speedMult = this.sneaking ? SNEAK_MULT : this.sprinting ? SPRINT_MULT : 1;
      const accel = this.onGround
        ? ACCEL_GROUND * speedMult * Math.pow(0.6 / slip, 3)
        : ACCEL_AIR * (this.sprinting ? SPRINT_MULT : 1);
      vx += wx * accel;
      vz += wz * accel;
      if (jump && this.onGround && this.jumpDelay === 0) {
        vy = JUMP_VEL;
        this.jumpDelay = 10;
        if (this.sprinting && f > 0) { vx += fwdX * 0.2; vz += fwdZ * 0.2; } // sprint-jump boost
      }
    }

    // --- sneak edge guard: don't walk off edges while sneaking ---
    if (this.sneaking && this.onGround && !this.fly && !this.inWater) {
      let cx = vx, cz = vz;
      while (cx !== 0 && !this.hasFooting(this.pos.x + cx, this.pos.z)) {
        cx = Math.abs(cx) <= 0.05 ? 0 : cx - Math.sign(cx) * 0.05;
      }
      while (cz !== 0 && !this.hasFooting(this.pos.x + cx, this.pos.z + cz)) {
        cz = Math.abs(cz) <= 0.05 ? 0 : cz - Math.sign(cz) * 0.05;
      }
      vx = cx; vz = cz;
    }

    // --- move (collision + 0.6 step assist) ---
    this.vel.x = vx * BPS; this.vel.y = vy * BPS; this.vel.z = vz * BPS;
    this.stepAssistGround = this.onGround && !this.fly;
    const res = moveEntity(this.world, this, TICK);
    this.onGround = res.onGround;
    vx = this.vel.x * TICK; vy = this.vel.y * TICK; vz = this.vel.z * TICK;

    // hop out of water at edges
    if (this.inWater && jump && res.hitWall) vy = 0.3;

    // --- gravity & friction (post-move, MC order) ---
    if (this.fly) {
      // handled by the approach blend above
    } else if (this.inWater) {
      vx *= WATER_FRICTION;
      vz *= WATER_FRICTION;
      vy = vy * WATER_FRICTION - WATER_GRAVITY;
    } else {
      vy = (vy - GRAVITY) * AIR_DRAG_Y;
      const fr = this.onGround ? this.slipUnder() * AIR_FRICTION : AIR_FRICTION;
      vx *= fr;
      vz *= fr;
    }
    this.vel = { x: vx * BPS, y: vy * BPS, z: vz * BPS };

    // --- eye height transition (sneak) ---
    const targetEye = this.sneaking ? EYE_SNEAK : EYE_STAND;
    this.eyeH += (targetEye - this.eyeH) * 0.5;

    // --- fall damage ---
    const fell = this.prevPos.y - this.pos.y;
    if (this.fly || this.inWater) this.fallDist = 0;
    else if (fell > 0) this.fallDist += fell;
    if (this.onGround) {
      if (this.fallDist > 3.5) this.damage(Math.floor(this.fallDist - 3), time);
      this.fallDist = 0;
    }

    // fell out of the world
    if (this.pos.y < -12) this.damage(100, time);

    // slow regen out of combat (eat food to heal faster)
    if (this.hp < this.maxHp && time - this.lastDamage > 10 && time - this.lastRegen > 4) {
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.lastRegen = time;
    }
  }

  damage(n, time) {
    if (this.dead || n <= 0) return;
    if (time - this.lastDamage < 0.5) return; // brief invulnerability
    this.hp -= n;
    this.lastDamage = time;
    if (this.onDamage) this.onDamage(n);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  respawn() {
    this.pos = { ...this.spawn };
    this.prevPos = { ...this.pos };
    this.vel = { x: 0, y: 0, z: 0 };
    this.hp = this.maxHp;
    this.dead = false;
    this.fallDist = 0;
    this.fly = false;
    this.acc = 0;
    this.eyeH = EYE_STAND;
    this.prevEyeH = EYE_STAND;
  }
}
