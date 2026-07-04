// First-person player: movement, jumping, swimming, creative flight,
// fall damage, health/regen.

import { moveEntity, isWaterAt } from './physics.js';

const SENS = 0.0022;
const GRAVITY = 26;
const JUMP_VEL = 8.2;
const WALK = 4.3, SPRINT = 5.7, FLY = 11, SWIM = 3.0;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.spawn = { ...spawn };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = -0.1;
    this.half = 0.3;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.hp = 20;
    this.maxHp = 20;
    this.fly = false;
    this.sprinting = false;
    this.onGround = false;
    this.inWater = false;
    this.eyeInWater = false;
    this.fallDist = 0;
    this.lastDamage = -99;
    this.lastRegen = 0;
    this.dead = false;
    this.onDamage = null; // cb(amount)
    this.onDeath = null;
  }

  look(dx, dy) {
    this.yaw -= dx * SENS;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * SENS));
  }

  eye() {
    return { x: this.pos.x, y: this.pos.y + this.eyeHeight, z: this.pos.z };
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
    const world = this.world;
    // don't simulate physics until the ground beneath us exists
    if (!world.hasDataAt(this.pos.x, this.pos.z)) return;

    this.inWater = isWaterAt(world, this.pos.x, this.pos.y + 0.3, this.pos.z);
    this.eyeInWater = isWaterAt(world, this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);

    // input direction
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
    let mx = f * fwdX + s * rightX;
    let mz = f * fwdZ + s * rightZ;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 0) { mx /= mlen; mz /= mlen; }

    this.sprinting = keys.has('ShiftLeft') && f > 0 && !this.fly && !this.inWater;
    const speed = this.fly ? FLY : this.inWater ? SWIM : this.sprinting ? SPRINT : WALK;

    // horizontal velocity eases toward target (lets knockback decay naturally)
    const hResp = this.fly ? 8 : this.onGround ? 12 : 3.5;
    const blend = Math.min(1, hResp * dt);
    this.vel.x += (mx * speed - this.vel.x) * blend;
    this.vel.z += (mz * speed - this.vel.z) * blend;

    if (this.fly) {
      const vy = (keys.has('Space') ? FLY : 0) + (keys.has('ShiftLeft') ? -FLY : 0);
      this.vel.y += (vy - this.vel.y) * Math.min(1, 10 * dt);
    } else if (this.inWater) {
      this.vel.y -= 8 * dt;
      this.vel.y *= 1 - Math.min(1, 1.8 * dt);
      if (keys.has('Space')) this.vel.y = Math.min(this.vel.y + 26 * dt, 4.5);
      if (this.vel.y < -4) this.vel.y = -4;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -55) this.vel.y = -55;
      if (keys.has('Space') && this.onGround) this.vel.y = JUMP_VEL;
    }

    const fallSpeed = Math.max(0, -this.vel.y);
    const { onGround } = moveEntity(world, this, dt);
    this.onGround = onGround;

    // fall damage
    if (this.fly || this.inWater) {
      this.fallDist = 0;
    } else if (fallSpeed > 0) {
      this.fallDist += fallSpeed * dt;
    }
    if (onGround) {
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
    this.vel = { x: 0, y: 0, z: 0 };
    this.hp = this.maxHp;
    this.dead = false;
    this.fallDist = 0;
    this.fly = false;
  }
}
