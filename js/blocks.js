// Block definitions + procedurally generated 16px texture atlas (no image assets needed).

import { mulberry32, hash2 } from './noise.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANK: 5, LOG: 6, LEAVES: 7,
  SAND: 8, GLASS: 9, WATER: 10, SNOW: 11, BEDROCK: 12, COAL_ORE: 13, IRON_ORE: 14, DIAMOND_ORE: 15,
  WOOL: 16, CRAFTING_TABLE: 17, STONE_BRICK: 18, IRON_BLOCK: 19, DIAMOND_BLOCK: 20,
  ICE: 21, FURNACE: 22, LAVA: 23, OBSIDIAN: 24, PORTAL: 25, NETHERRACK: 26,
  END_FRAME: 27, END_FRAME_FILLED: 28, END_PORTAL: 29, END_STONE: 30, DRAGON_EGG: 31,
  CHEST: 32, BED: 33,
  // building blocks
  BRICKS: 34, SANDSTONE: 35, SMOOTH_STONE: 36, MOSSY_COBBLE: 37, GRAVEL: 38, CLAY: 39,
  BOOKSHELF: 40, GLOWSTONE: 41, QUARTZ_BLOCK: 42, NETHER_BRICK: 43,
  GOLD_ORE: 44, REDSTONE_ORE: 45, LAPIS_ORE: 46, EMERALD_ORE: 47, QUARTZ_ORE: 48,
  GOLD_BLOCK: 49, REDSTONE_BLOCK: 50, LAPIS_BLOCK: 51, EMERALD_BLOCK: 52,
  BIRCH_LOG: 53, BIRCH_PLANK: 54, SPRUCE_LOG: 55, SPRUCE_PLANK: 56,
  PUMPKIN: 57, MELON: 58, HAY: 59, SNOW_BLOCK: 60, TNT: 61, CACTUS: 62,
  TORCH: 63, FENCE: 64, GLASS_PANE: 65, POPPY: 66, DANDELION: 67,
  OAK_SLAB: 68, COBBLE_SLAB: 69, STONE_SLAB: 70, STONE_BRICK_SLAB: 71, BRICK_SLAB: 72, SANDSTONE_SLAB: 73,
  // stairs occupy 4 ids each (one per horizontal facing); the first is the item
  OAK_STAIRS: 74, COBBLE_STAIRS: 78, STONE_BRICK_STAIRS: 82, BRICK_STAIRS: 86,
  // colored wool: 90..104 (see WOOL_COLORS)
};

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANK: 5, LOG_SIDE: 6, LOG_TOP: 7,
  LEAVES: 8, SAND: 9, GLASS: 10, WATER: 11, SNOW: 12, SNOW_SIDE: 13, BEDROCK: 14,
  COAL: 15, IRON: 16, DIAMOND: 17, WOOL: 18,
  CRAFTING_TOP: 19, CRAFTING_SIDE: 20, STONE_BRICK: 21, IRON_BLOCK: 22, DIAMOND_BLOCK: 23,
  ICE: 24, FURNACE_FRONT: 25, FURNACE_TOP: 26, LAVA: 27,
  OBSIDIAN: 28, PORTAL: 29, NETHERRACK: 30,
  END_FRAME: 31, END_FRAME_FILLED: 32, END_PORTAL: 33, END_STONE: 34, DRAGON_EGG: 35,
  CHEST: 36, BED_TOP: 37, BED_SIDE: 38,
  BRICKS: 39, SANDSTONE_TOP: 40, SANDSTONE_SIDE: 41, SMOOTH_STONE: 42, MOSSY_COBBLE: 43, GRAVEL: 44, CLAY: 45,
  BOOKSHELF: 46, GLOWSTONE: 47, QUARTZ: 48, NETHER_BRICK: 49,
  GOLD_ORE: 50, REDSTONE_ORE: 51, LAPIS_ORE: 52, EMERALD_ORE: 53, QUARTZ_ORE: 54,
  GOLD_BLOCK: 55, REDSTONE_BLOCK: 56, LAPIS_BLOCK: 57, EMERALD_BLOCK: 58,
  BIRCH_LOG: 59, BIRCH_PLANK: 60, SPRUCE_LOG: 61, SPRUCE_PLANK: 62,
  PUMPKIN_TOP: 63, PUMPKIN_SIDE: 64, MELON_SIDE: 65, MELON_TOP: 66, HAY_SIDE: 67, HAY_TOP: 68,
  TNT_SIDE: 69, TNT_TOP: 70, CACTUS_SIDE: 71, CACTUS_TOP: 72,
  TORCH: 73, POPPY: 74, DANDELION: 75,
  WOOL0: 76, // 15 colored wool tiles: 76..90
  ICON_FENCE: 91,
  ICON_SLAB_OAK: 92, ICON_SLAB_COBBLE: 93, ICON_SLAB_STONE: 94,
  ICON_SLAB_STONE_BRICK: 95, ICON_SLAB_BRICK: 96, ICON_SLAB_SANDSTONE: 97,
  ICON_STAIR_OAK: 98, ICON_STAIR_COBBLE: 99, ICON_STAIR_STONE_BRICK: 100, ICON_STAIR_BRICK: 101,
};

export const WOOL_COLORS = [
  ['Orange', [235, 126, 40]], ['Magenta', [190, 74, 200]], ['Light Blue', [58, 175, 220]],
  ['Yellow', [248, 198, 40]], ['Lime', [112, 190, 32]], ['Pink', [238, 140, 172]],
  ['Gray', [62, 68, 72]], ['Light Gray', [142, 142, 135]], ['Cyan', [22, 138, 145]],
  ['Purple', [122, 42, 172]], ['Blue', [52, 58, 158]], ['Brown', [114, 72, 40]],
  ['Green', [85, 110, 28]], ['Red', [162, 40, 34]], ['Black', [22, 23, 26]],
];
const WOOL_ID0 = 90;

// def: {name, top, bottom, side (tile ids), solid (collision), opaque (face culling), breakable}
// extras: shape ('slab'|'stairs'|'cross'|'fence'|'pane'|'cactus'), colHeight (partial
// collision height), glow (renders unlit), needSupport (must sit on a solid block),
// facing/facings/item + hidden (stair orientation variants), icon (palette tile override)
export const BLOCKS = [];
const def = (id, name, top, bottom, side, opts = {}) => {
  BLOCKS[id] = { name, top, bottom, side, solid: true, opaque: true, breakable: true, ...opts };
};
BLOCKS[B.AIR] = { name: 'Air', solid: false, opaque: false, breakable: false };
def(B.GRASS, 'Grass', TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE);
def(B.DIRT, 'Dirt', TILE.DIRT, TILE.DIRT, TILE.DIRT);
def(B.STONE, 'Stone', TILE.STONE, TILE.STONE, TILE.STONE);
def(B.COBBLE, 'Cobblestone', TILE.COBBLE, TILE.COBBLE, TILE.COBBLE);
def(B.PLANK, 'Oak Planks', TILE.PLANK, TILE.PLANK, TILE.PLANK);
def(B.LOG, 'Oak Log', TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE);
def(B.LEAVES, 'Leaves', TILE.LEAVES, TILE.LEAVES, TILE.LEAVES);
def(B.SAND, 'Sand', TILE.SAND, TILE.SAND, TILE.SAND);
def(B.GLASS, 'Glass', TILE.GLASS, TILE.GLASS, TILE.GLASS, { opaque: false });
def(B.WATER, 'Water', TILE.WATER, TILE.WATER, TILE.WATER, { solid: false, opaque: false, breakable: false });
def(B.SNOW, 'Snow', TILE.SNOW, TILE.DIRT, TILE.SNOW_SIDE);
def(B.BEDROCK, 'Bedrock', TILE.BEDROCK, TILE.BEDROCK, TILE.BEDROCK, { breakable: false });
def(B.COAL_ORE, 'Coal Ore', TILE.COAL, TILE.COAL, TILE.COAL);
def(B.IRON_ORE, 'Iron Ore', TILE.IRON, TILE.IRON, TILE.IRON);
def(B.DIAMOND_ORE, 'Diamond Ore', TILE.DIAMOND, TILE.DIAMOND, TILE.DIAMOND);
def(B.WOOL, 'Wool', TILE.WOOL, TILE.WOOL, TILE.WOOL);
def(B.CRAFTING_TABLE, 'Crafting Table', TILE.CRAFTING_TOP, TILE.PLANK, TILE.CRAFTING_SIDE);
def(B.STONE_BRICK, 'Stone Bricks', TILE.STONE_BRICK, TILE.STONE_BRICK, TILE.STONE_BRICK);
def(B.IRON_BLOCK, 'Iron Block', TILE.IRON_BLOCK, TILE.IRON_BLOCK, TILE.IRON_BLOCK);
def(B.DIAMOND_BLOCK, 'Diamond Block', TILE.DIAMOND_BLOCK, TILE.DIAMOND_BLOCK, TILE.DIAMOND_BLOCK);
def(B.ICE, 'Ice', TILE.ICE, TILE.ICE, TILE.ICE, { slip: 0.98 });
def(B.FURNACE, 'Furnace', TILE.FURNACE_TOP, TILE.FURNACE_TOP, TILE.FURNACE_FRONT);
def(B.LAVA, 'Lava', TILE.LAVA, TILE.LAVA, TILE.LAVA, { solid: false, opaque: false, breakable: false });
def(B.OBSIDIAN, 'Obsidian', TILE.OBSIDIAN, TILE.OBSIDIAN, TILE.OBSIDIAN);
def(B.PORTAL, 'Nether Portal', TILE.PORTAL, TILE.PORTAL, TILE.PORTAL, { solid: false, opaque: false, breakable: false });
def(B.NETHERRACK, 'Netherrack', TILE.NETHERRACK, TILE.NETHERRACK, TILE.NETHERRACK);
def(B.END_FRAME, 'End Portal Frame', TILE.END_FRAME, TILE.END_FRAME, TILE.END_FRAME);
def(B.END_FRAME_FILLED, 'Filled Portal Frame', TILE.END_FRAME_FILLED, TILE.END_FRAME_FILLED, TILE.END_FRAME_FILLED);
def(B.END_PORTAL, 'End Portal', TILE.END_PORTAL, TILE.END_PORTAL, TILE.END_PORTAL, { solid: false, opaque: false, breakable: false });
def(B.END_STONE, 'End Stone', TILE.END_STONE, TILE.END_STONE, TILE.END_STONE);
def(B.DRAGON_EGG, 'Dragon Egg', TILE.DRAGON_EGG, TILE.DRAGON_EGG, TILE.DRAGON_EGG);
def(B.CHEST, 'Chest', TILE.PLANK, TILE.PLANK, TILE.CHEST);
def(B.BED, 'Bed', TILE.BED_TOP, TILE.PLANK, TILE.BED_SIDE);

// --- building blocks --------------------------------------------------------
def(B.BRICKS, 'Bricks', TILE.BRICKS, TILE.BRICKS, TILE.BRICKS);
def(B.SANDSTONE, 'Sandstone', TILE.SANDSTONE_TOP, TILE.SANDSTONE_TOP, TILE.SANDSTONE_SIDE);
def(B.SMOOTH_STONE, 'Smooth Stone', TILE.SMOOTH_STONE, TILE.SMOOTH_STONE, TILE.SMOOTH_STONE);
def(B.MOSSY_COBBLE, 'Mossy Cobblestone', TILE.MOSSY_COBBLE, TILE.MOSSY_COBBLE, TILE.MOSSY_COBBLE);
def(B.GRAVEL, 'Gravel', TILE.GRAVEL, TILE.GRAVEL, TILE.GRAVEL);
def(B.CLAY, 'Clay', TILE.CLAY, TILE.CLAY, TILE.CLAY);
def(B.BOOKSHELF, 'Bookshelf', TILE.PLANK, TILE.PLANK, TILE.BOOKSHELF);
def(B.GLOWSTONE, 'Glowstone', TILE.GLOWSTONE, TILE.GLOWSTONE, TILE.GLOWSTONE, { glow: true });
def(B.QUARTZ_BLOCK, 'Quartz Block', TILE.QUARTZ, TILE.QUARTZ, TILE.QUARTZ);
def(B.NETHER_BRICK, 'Nether Bricks', TILE.NETHER_BRICK, TILE.NETHER_BRICK, TILE.NETHER_BRICK);
def(B.GOLD_ORE, 'Gold Ore', TILE.GOLD_ORE, TILE.GOLD_ORE, TILE.GOLD_ORE);
def(B.REDSTONE_ORE, 'Redstone Ore', TILE.REDSTONE_ORE, TILE.REDSTONE_ORE, TILE.REDSTONE_ORE);
def(B.LAPIS_ORE, 'Lapis Lazuli Ore', TILE.LAPIS_ORE, TILE.LAPIS_ORE, TILE.LAPIS_ORE);
def(B.EMERALD_ORE, 'Emerald Ore', TILE.EMERALD_ORE, TILE.EMERALD_ORE, TILE.EMERALD_ORE);
def(B.QUARTZ_ORE, 'Nether Quartz Ore', TILE.QUARTZ_ORE, TILE.QUARTZ_ORE, TILE.QUARTZ_ORE);
def(B.GOLD_BLOCK, 'Gold Block', TILE.GOLD_BLOCK, TILE.GOLD_BLOCK, TILE.GOLD_BLOCK);
def(B.REDSTONE_BLOCK, 'Redstone Block', TILE.REDSTONE_BLOCK, TILE.REDSTONE_BLOCK, TILE.REDSTONE_BLOCK);
def(B.LAPIS_BLOCK, 'Lapis Lazuli Block', TILE.LAPIS_BLOCK, TILE.LAPIS_BLOCK, TILE.LAPIS_BLOCK);
def(B.EMERALD_BLOCK, 'Emerald Block', TILE.EMERALD_BLOCK, TILE.EMERALD_BLOCK, TILE.EMERALD_BLOCK);
def(B.BIRCH_LOG, 'Birch Log', TILE.LOG_TOP, TILE.LOG_TOP, TILE.BIRCH_LOG);
def(B.BIRCH_PLANK, 'Birch Planks', TILE.BIRCH_PLANK, TILE.BIRCH_PLANK, TILE.BIRCH_PLANK);
def(B.SPRUCE_LOG, 'Spruce Log', TILE.LOG_TOP, TILE.LOG_TOP, TILE.SPRUCE_LOG);
def(B.SPRUCE_PLANK, 'Spruce Planks', TILE.SPRUCE_PLANK, TILE.SPRUCE_PLANK, TILE.SPRUCE_PLANK);
def(B.PUMPKIN, 'Pumpkin', TILE.PUMPKIN_TOP, TILE.PUMPKIN_TOP, TILE.PUMPKIN_SIDE);
def(B.MELON, 'Melon', TILE.MELON_TOP, TILE.MELON_TOP, TILE.MELON_SIDE);
def(B.HAY, 'Hay Bale', TILE.HAY_TOP, TILE.HAY_TOP, TILE.HAY_SIDE);
def(B.SNOW_BLOCK, 'Snow Block', TILE.SNOW, TILE.SNOW, TILE.SNOW);
def(B.TNT, 'TNT', TILE.TNT_TOP, TILE.TNT_TOP, TILE.TNT_SIDE);
def(B.CACTUS, 'Cactus', TILE.CACTUS_TOP, TILE.CACTUS_TOP, TILE.CACTUS_SIDE,
  { shape: 'cactus', opaque: false, needSupport: true });
def(B.TORCH, 'Torch', TILE.TORCH, TILE.TORCH, TILE.TORCH,
  { shape: 'cross', glow: true, solid: false, opaque: false, needSupport: true });
def(B.FENCE, 'Oak Fence', TILE.PLANK, TILE.PLANK, TILE.PLANK,
  { shape: 'fence', opaque: false, icon: TILE.ICON_FENCE });
def(B.GLASS_PANE, 'Glass Pane', TILE.GLASS, TILE.GLASS, TILE.GLASS, { shape: 'pane', opaque: false });
def(B.POPPY, 'Poppy', TILE.POPPY, TILE.POPPY, TILE.POPPY,
  { shape: 'cross', solid: false, opaque: false, needSupport: true });
def(B.DANDELION, 'Dandelion', TILE.DANDELION, TILE.DANDELION, TILE.DANDELION,
  { shape: 'cross', solid: false, opaque: false, needSupport: true });

const defSlab = (id, name, top, bottom, side, icon) =>
  def(id, name, top, bottom, side, { shape: 'slab', opaque: false, colHeight: 0.5, icon });
defSlab(B.OAK_SLAB, 'Oak Slab', TILE.PLANK, TILE.PLANK, TILE.PLANK, TILE.ICON_SLAB_OAK);
defSlab(B.COBBLE_SLAB, 'Cobblestone Slab', TILE.COBBLE, TILE.COBBLE, TILE.COBBLE, TILE.ICON_SLAB_COBBLE);
defSlab(B.STONE_SLAB, 'Stone Slab', TILE.SMOOTH_STONE, TILE.SMOOTH_STONE, TILE.SMOOTH_STONE, TILE.ICON_SLAB_STONE);
defSlab(B.STONE_BRICK_SLAB, 'Stone Brick Slab', TILE.STONE_BRICK, TILE.STONE_BRICK, TILE.STONE_BRICK, TILE.ICON_SLAB_STONE_BRICK);
defSlab(B.BRICK_SLAB, 'Brick Slab', TILE.BRICKS, TILE.BRICKS, TILE.BRICKS, TILE.ICON_SLAB_BRICK);
defSlab(B.SANDSTONE_SLAB, 'Sandstone Slab', TILE.SANDSTONE_TOP, TILE.SANDSTONE_TOP, TILE.SANDSTONE_SIDE, TILE.ICON_SLAB_SANDSTONE);

// stairs: the high step faces STAIR_DIRS[facing]; variants 1-3 are hidden placement states
export const STAIR_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const defStairs = (baseId, name, top, bottom, side, icon) => {
  const facings = [baseId, baseId + 1, baseId + 2, baseId + 3];
  for (let i = 0; i < 4; i++) {
    def(facings[i], name, top, bottom, side, {
      shape: 'stairs', opaque: false, colHeight: 0.5, icon,
      facing: i, facings, item: baseId, hidden: i > 0,
    });
  }
};
defStairs(B.OAK_STAIRS, 'Oak Stairs', TILE.PLANK, TILE.PLANK, TILE.PLANK, TILE.ICON_STAIR_OAK);
defStairs(B.COBBLE_STAIRS, 'Cobblestone Stairs', TILE.COBBLE, TILE.COBBLE, TILE.COBBLE, TILE.ICON_STAIR_COBBLE);
defStairs(B.STONE_BRICK_STAIRS, 'Stone Brick Stairs', TILE.STONE_BRICK, TILE.STONE_BRICK, TILE.STONE_BRICK, TILE.ICON_STAIR_STONE_BRICK);
defStairs(B.BRICK_STAIRS, 'Brick Stairs', TILE.BRICKS, TILE.BRICKS, TILE.BRICKS, TILE.ICON_STAIR_BRICK);

export const WOOL_IDS = [B.WOOL];
WOOL_COLORS.forEach(([wname], i) => {
  def(WOOL_ID0 + i, wname + ' Wool', TILE.WOOL0 + i, TILE.WOOL0 + i, TILE.WOOL0 + i);
  WOOL_IDS.push(WOOL_ID0 + i);
});

export const isSolid = (id) => !!(BLOCKS[id] && BLOCKS[id].solid);
export const isOpaque = (id) => !!(BLOCKS[id] && BLOCKS[id].opaque);

// ---------------------------------------------------------------------------
// Sub-box geometry for non-cube shapes (shared by the chunk mesher and the
// held-item / dropped-item meshes).

const BOX_FACES = [
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1], shade: 0.72, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], shade: 0.72, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

// Boxes for a shaped block, in cell-local 0..1 coords. conn = {px,nx,pz,nz}
// connectivity for fences/panes (null = unconnected, used for item meshes).
export function blockBoxes(id, conn = null) {
  const blk = BLOCKS[id];
  const t = { top: blk.top, bottom: blk.bottom, side: blk.side };
  const bx = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1, ...t });
  switch (blk.shape) {
    case 'slab': return [bx(0, 0, 0, 1, 0.5, 1)];
    case 'stairs': {
      const [dx, dz] = STAIR_DIRS[blk.facing];
      return [
        bx(0, 0, 0, 1, 0.5, 1),
        bx(dx > 0 ? 0.5 : 0, 0.5, dz > 0 ? 0.5 : 0, dx < 0 ? 0.5 : 1, 1, dz < 0 ? 0.5 : 1),
      ];
    }
    case 'cactus': return [bx(1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16)];
    case 'fence': {
      const c = conn || {};
      const boxes = [bx(6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16)];
      for (const [y0, y1] of [[6 / 16, 9 / 16], [12 / 16, 15 / 16]]) {
        if (c.nx) boxes.push(bx(0, y0, 7 / 16, 6 / 16, y1, 9 / 16));
        if (c.px) boxes.push(bx(10 / 16, y0, 7 / 16, 1, y1, 9 / 16));
        if (c.nz) boxes.push(bx(7 / 16, y0, 0, 9 / 16, y1, 6 / 16));
        if (c.pz) boxes.push(bx(7 / 16, y0, 10 / 16, 9 / 16, y1, 1));
      }
      return boxes;
    }
    case 'pane': {
      const c = conn || {};
      const xConn = c.nx || c.px, zConn = c.nz || c.pz;
      const boxes = [];
      if (xConn || !zConn) boxes.push(bx(c.nx ? 0 : 7 / 16, 0, 7 / 16, c.px ? 1 : 9 / 16, 1, 9 / 16));
      if (zConn || (!xConn && !zConn)) boxes.push(bx(7 / 16, 0, c.nz ? 0 : 7 / 16, 9 / 16, 1, c.pz ? 1 : 9 / 16));
      return boxes;
    }
  }
  return [bx(0, 0, 0, 1, 1, 1)];
}

// Emit one box into buf {pos,nor,uv,col,idx} at cell origin (x,y,z).
// cull: per-face booleans ([+x,-x,+y,-y,+z,-z]) — skip faces flush against an
// opaque neighbor. UVs sample the sub-rect of the tile so patterns line up.
export function emitBox(buf, x, y, z, box, cull = null) {
  const flush = [box.x1 === 1, box.x0 === 0, box.y1 === 1, box.y0 === 0, box.z1 === 1, box.z0 === 0];
  for (let i = 0; i < 6; i++) {
    if (cull && cull[i] && flush[i]) continue;
    const f = BOX_FACES[i];
    const tile = i === 2 ? box.top : i === 3 ? box.bottom : box.side;
    const r = tileUV(tile);
    const base = buf.pos.length / 3;
    for (const c of f.corners) {
      const px = c[0] ? box.x1 : box.x0, py = c[1] ? box.y1 : box.y0, pz = c[2] ? box.z1 : box.z0;
      let uf, vf;
      if (i === 0) { uf = 1 - pz; vf = py; }
      else if (i === 1) { uf = pz; vf = py; }
      else if (i === 2) { uf = px; vf = 1 - pz; }
      else if (i === 3) { uf = px; vf = pz; }
      else if (i === 4) { uf = px; vf = py; }
      else { uf = 1 - px; vf = py; }
      buf.pos.push(x + px, y + py, z + pz);
      buf.nor.push(f.dir[0], f.dir[1], f.dir[2]);
      buf.uv.push(r.u0 + (r.u1 - r.u0) * uf, r.v0 + (r.v1 - r.v0) * vf);
      buf.col.push(f.shade, f.shade, f.shade);
    }
    buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// Two crossed quads (flowers, torches), emitted double-sided.
export function emitCross(buf, x, y, z, tile) {
  const r = tileUV(tile);
  const a = 0.15, b = 0.85;
  const quads = [
    [[a, 0, a], [b, 0, b], [b, 1, b], [a, 1, a]],
    [[b, 0, b], [a, 0, a], [a, 1, a], [b, 1, b]],
    [[a, 0, b], [b, 0, a], [b, 1, a], [a, 1, b]],
    [[b, 0, a], [a, 0, b], [a, 1, b], [b, 1, a]],
  ];
  for (const q of quads) {
    const base = buf.pos.length / 3;
    q.forEach((p, i) => {
      buf.pos.push(x + p[0], y + p[1], z + p[2]);
      buf.nor.push(0, 1, 0);
      const uf = (i === 0 || i === 3) ? 0 : 1;
      buf.uv.push(r.u0 + (r.u1 - r.u0) * uf, r.v0 + (r.v1 - r.v0) * p[1]);
      buf.col.push(0.95, 0.95, 0.95);
    });
    buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// ---------------------------------------------------------------------------
// Texture atlas: 16x8 grid of 16px tiles -> 256x128 canvas.
const T = 16, COLS = 16, ROWS = 8;
export const ATLAS_COLS = COLS;

const ORE_SPOTS = {
  [TILE.COAL]: { color: [38, 38, 40], spots: [[4, 5], [11, 3], [7, 10], [12, 12], [3, 12]] },
  [TILE.IRON]: { color: [216, 175, 147], spots: [[5, 4], [11, 6], [4, 11], [10, 12]] },
  [TILE.DIAMOND]: { color: [92, 219, 213], spots: [[4, 4], [11, 5], [6, 11], [12, 11]] },
  [TILE.GOLD_ORE]: { color: [250, 214, 80], spots: [[4, 4], [11, 6], [7, 11], [13, 12]] },
  [TILE.REDSTONE_ORE]: { color: [220, 40, 36], spots: [[4, 5], [10, 3], [6, 10], [12, 12], [3, 13]] },
  [TILE.LAPIS_ORE]: { color: [40, 78, 182], spots: [[5, 4], [11, 5], [4, 11], [10, 11], [13, 13]] },
  [TILE.EMERALD_ORE]: { color: [62, 210, 108], spots: [[5, 5], [10, 8], [6, 12]] },
  [TILE.QUARTZ_ORE]: { color: [234, 228, 220], spots: [[4, 4], [11, 6], [6, 11], [12, 12]], base: TILE.NETHERRACK },
};

// TNT label rows (y 6..9)
const TNT_TXT = [
  '.ttt..t..t.ttt..',
  '..t...tt.t..t...',
  '..t...t.tt..t...',
  '..t...t..t..t...',
];

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * T; canvas.height = ROWS * T;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(1337 * 7);

  const jitter = (base, amt) => {
    const o = (rand() - 0.5) * 2 * amt;
    return [base[0] + o, base[1] + o, base[2] + o];
  };

  // painter factories
  const solid = (base, amt = 8) => () => [...jitter(base, amt), 255];
  const bordered = (inner, edge) => (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter(edge, 5), 255];
    return [...jitter(inner, 6), 255];
  };
  const brickP = (brick, mortar) => (x, y) => {
    const off = ((y >> 2) % 2) * 4;
    if (y % 4 === 3 || (x + off) % 8 === 7) return [...jitter(mortar, 5), 255];
    return [...jitter(brick, 8), 255];
  };
  const plankP = (main, groove) => (x, y) => {
    if (y % 4 === 3) return [...jitter(groove, 6), 255];
    if ((y < 4 && x === 3) || (y >= 4 && y < 8 && x === 11) || (y >= 8 && y < 12 && x === 6) || (y >= 12 && x === 13))
      return [...jitter(groove, 6), 255];
    return [...jitter(main, 8), 255];
  };
  const woolP = (base) => (x, y) => {
    if ((x % 4 === 3 && y % 2 === 0) || (y % 4 === 3 && x % 2 === 1))
      return [...jitter(base.map(c => c * 0.84), 6), 255];
    return [...jitter(base, 7), 255];
  };

  const painters = {
    [TILE.GRASS_TOP]: () => [...jitter([106, 170, 70], 13), 255],
    [TILE.GRASS_SIDE]: (x, y) => {
      const edge = 2 + hash2(x, 0, 42) * 2.2;
      if (y < edge) return [...jitter([106, 170, 70], 13), 255];
      return [...jitter([134, 96, 67], 12), 255];
    },
    [TILE.DIRT]: () => [...jitter([134, 96, 67], 12), 255],
    [TILE.STONE]: () => {
      const c = jitter([127, 127, 127], 9);
      if (rand() < 0.08) return [c[0] - 24, c[1] - 24, c[2] - 24, 255];
      return [...c, 255];
    },
    [TILE.COBBLE]: (x, y) => {
      const seam = x % 4 === 0 || y % 4 === 0 || (x + y) % 8 === 1;
      const base = seam ? [84, 84, 86] : [118, 118, 120];
      return [...jitter(base, 8), 255];
    },
    [TILE.PLANK]: plankP([158, 128, 79], [106, 84, 51]),
    [TILE.LOG_SIDE]: (x) => {
      if (x % 4 === 0) return [...jitter([80, 62, 37], 6), 255];
      return [...jitter([104, 82, 50], 8), 255];
    },
    [TILE.LOG_TOP]: (x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const ring = Math.floor(d) % 2 === 0;
      return [...jitter(ring ? [169, 138, 88] : [122, 96, 60], 6), 255];
    },
    [TILE.LEAVES]: () => {
      if (rand() < 0.16) return [...jitter([37, 82, 25], 8), 255];
      return [...jitter([58, 122, 40], 16), 255];
    },
    [TILE.SAND]: () => [...jitter([219, 206, 160], 10), 255],
    [TILE.GLASS]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [205, 225, 232, 255];
      const d = x - y;
      if ((d === 4 || d === 5) && rand() < 0.8) return [255, 255, 255, 150];
      return [0, 0, 0, 0];
    },
    [TILE.WATER]: () => [...jitter([50, 94, 178], 9), 178],
    [TILE.SNOW]: () => [...jitter([238, 244, 248], 6), 255],
    [TILE.SNOW_SIDE]: (x, y) => {
      if (y < 4) return [...jitter([238, 244, 248], 6), 255];
      return [...jitter([134, 96, 67], 12), 255];
    },
    [TILE.BEDROCK]: () => [...jitter([62, 62, 64], 26), 255],
    [TILE.WOOL]: (x, y) => {
      if ((x % 4 === 3 && y % 2 === 0) || (y % 4 === 3 && x % 2 === 1)) return [...jitter([205, 205, 205], 6), 255];
      return [...jitter([233, 233, 233], 7), 255];
    },
    [TILE.CRAFTING_TOP]: (x, y) => {
      if (x === 0 || x === 15 || y === 0 || y === 15) return [...jitter([96, 74, 45], 6), 255];
      if (((x === 5 || x === 10) && y > 1 && y < 14) || ((y === 5 || y === 10) && x > 1 && x < 14))
        return [...jitter([118, 93, 56], 6), 255];
      return [...jitter([158, 128, 79], 8), 255];
    },
    [TILE.CRAFTING_SIDE]: (x, y) => {
      if (y < 3) return [...jitter([158, 128, 79], 8), 255];
      if (x > 2 && x < 13 && y > 4 && y < 12) return [...jitter([139, 105, 63], 7), 255];
      return [...jitter([121, 92, 53], 7), 255];
    },
    [TILE.STONE_BRICK]: brickP([138, 138, 141], [86, 86, 88]),
    [TILE.IRON_BLOCK]: bordered([219, 219, 222], [148, 148, 152]),
    [TILE.DIAMOND_BLOCK]: bordered([95, 216, 209], [52, 150, 145]),
    [TILE.ICE]: (x, y) => {
      const d = (x - y + 32) % 7;
      if (d === 0 && rand() < 0.6) return [...jitter([225, 240, 252], 5), 255];
      return [...jitter([155, 195, 232], 8), 255];
    },
    [TILE.FURNACE_TOP]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([70, 70, 72], 6), 255];
      return [...jitter([112, 112, 115], 8), 255];
    },
    [TILE.FURNACE_FRONT]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([70, 70, 72], 6), 255];
      if (x >= 4 && x <= 11 && y >= 8 && y <= 13) {
        if (rand() < 0.3 && y >= 10) return [...jitter([235, 120, 30], 20), 255];
        return [...jitter([28, 26, 24], 8), 255];
      }
      return [...jitter([112, 112, 115], 8), 255];
    },
    [TILE.LAVA]: (x, y) => {
      if ((x * 3 + y * 5 + ((x * y) % 4)) % 11 < 3) return [...jitter([250, 190, 45], 15), 255];
      return [...jitter([228, 105, 20], 20), 255];
    },
    [TILE.OBSIDIAN]: () => {
      if (rand() < 0.09) return [...jitter([74, 44, 116], 12), 255];
      return [...jitter([24, 18, 34], 7), 255];
    },
    [TILE.PORTAL]: (x, y) => {
      if ((x * 2 + y * 3 + ((x + y) % 5)) % 9 < 2) return [...jitter([190, 100, 245], 20), 255];
      return [...jitter([98, 32, 165], 22), 255];
    },
    [TILE.NETHERRACK]: () => {
      const r = rand();
      if (r < 0.14) return [...jitter([66, 20, 20], 10), 255];
      if (r < 0.22) return [...jitter([152, 72, 60], 12), 255];
      return [...jitter([108, 40, 38], 14), 255];
    },
    [TILE.END_FRAME]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([144, 152, 116], 8), 255];
      if (x >= 4 && x <= 11 && y >= 4 && y <= 11) return [...jitter([28, 30, 26], 6), 255];
      return [...jitter([120, 128, 96], 9), 255];
    },
    [TILE.END_FRAME_FILLED]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([144, 152, 116], 8), 255];
      if (x >= 5 && x <= 10 && y >= 5 && y <= 10) return [...jitter([64, 220, 190], 18), 255]; // ender eye
      if (x >= 4 && x <= 11 && y >= 4 && y <= 11) return [...jitter([28, 30, 26], 6), 255];
      return [...jitter([120, 128, 96], 9), 255];
    },
    [TILE.END_PORTAL]: () => {
      const r = rand();
      if (r < 0.04) return [...jitter([120, 230, 200], 30), 255]; // star specks
      if (r < 0.07) return [...jitter([180, 120, 240], 30), 255];
      return [...jitter([8, 10, 16], 5), 255];
    },
    [TILE.END_STONE]: () => {
      if (rand() < 0.2) return [...jitter([200, 203, 158], 8), 255];
      return [...jitter([219, 222, 177], 9), 255];
    },
    [TILE.DRAGON_EGG]: () => {
      if (rand() < 0.12) return [...jitter([110, 40, 160], 18), 255];
      return [...jitter([18, 12, 24], 7), 255];
    },
    [TILE.CHEST]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([92, 66, 34], 6), 255];
      if (y === 7 || y === 8) {
        if (x >= 6 && x <= 9) return [...jitter([70, 70, 74], 8), 255]; // latch
        return [...jitter([96, 70, 38], 6), 255];
      }
      return [...jitter([148, 110, 62], 8), 255];
    },
    [TILE.BED_TOP]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([110, 30, 30], 8), 255];
      if (y <= 4) return [...jitter([235, 235, 235], 8), 255]; // pillow
      return [...jitter([178, 44, 44], 10), 255]; // blanket
    },
    [TILE.BED_SIDE]: (x, y) => {
      if (y < 8) return [...jitter([178, 44, 44], 10), 255];
      return [...jitter([158, 128, 79], 8), 255];
    },
    // --- building blocks ----------------------------------------------------
    [TILE.BRICKS]: brickP([168, 92, 74], [188, 180, 172]),
    [TILE.SANDSTONE_TOP]: solid([220, 207, 160], 7),
    [TILE.SANDSTONE_SIDE]: (x, y) => {
      if (y < 2 || y > 13) return [...jitter([224, 211, 164], 6), 255];
      if (hash2(x >> 1, y >> 1, 61) < 0.14) return [...jitter([186, 170, 120], 8), 255];
      return [...jitter([214, 200, 152], 8), 255];
    },
    [TILE.SMOOTH_STONE]: solid([162, 162, 164], 5),
    [TILE.MOSSY_COBBLE]: (x, y) => {
      const seam = x % 4 === 0 || y % 4 === 0 || (x + y) % 8 === 1;
      if (hash2(x >> 1, y >> 1, 515) < 0.4) return [...jitter(seam ? [64, 94, 44] : [96, 132, 60], 10), 255];
      return [...jitter(seam ? [84, 84, 86] : [118, 118, 120], 8), 255];
    },
    [TILE.GRAVEL]: () => {
      const r = rand();
      if (r < 0.25) return [...jitter([98, 88, 82], 8), 255];
      if (r < 0.5) return [...jitter([146, 138, 130], 8), 255];
      return [...jitter([122, 112, 106], 9), 255];
    },
    [TILE.CLAY]: solid([164, 168, 180], 6),
    [TILE.BOOKSHELF]: (x, y) => {
      if (y < 2 || y > 13 || y === 7 || y === 8 || x === 0 || x === 15)
        return [...jitter([158, 128, 79], 8), 255];
      const shelf = y < 7 ? 0 : 1;
      if (hash2(x, shelf, 41) < 0.1) return [40, 34, 28, 255]; // empty slot
      const spines = [[168, 50, 42], [62, 102, 160], [92, 128, 58], [150, 110, 54], [120, 70, 140], [196, 170, 90]];
      const c = spines[(hash2(x, shelf, 77) * spines.length) | 0];
      const shade = x % 3 === 0 ? 0.72 : 1;
      return [...jitter([c[0] * shade, c[1] * shade, c[2] * shade], 8), 255];
    },
    [TILE.GLOWSTONE]: (x, y) => {
      const g = hash2(x >> 1, y >> 1, 911);
      if (g < 0.22) return [...jitter([252, 232, 150], 8), 255];
      if (g < 0.52) return [...jitter([232, 192, 104], 10), 255];
      return [...jitter([146, 102, 58], 10), 255];
    },
    [TILE.QUARTZ]: bordered([240, 236, 228], [214, 206, 196]),
    [TILE.NETHER_BRICK]: brickP([48, 24, 30], [26, 12, 16]),
    [TILE.GOLD_BLOCK]: bordered([250, 218, 92], [198, 162, 50]),
    [TILE.REDSTONE_BLOCK]: bordered([190, 40, 30], [128, 22, 16]),
    [TILE.LAPIS_BLOCK]: bordered([48, 82, 184], [30, 52, 130]),
    [TILE.EMERALD_BLOCK]: bordered([74, 216, 120], [42, 158, 82]),
    [TILE.BIRCH_LOG]: (x, y) => {
      if (hash2(x >> 1, y, 133) < 0.15 && y % 3 !== 0) return [...jitter([56, 54, 48], 8), 255];
      if (x % 4 === 0) return [...jitter([196, 196, 188], 5), 255];
      return [...jitter([218, 218, 210], 6), 255];
    },
    [TILE.BIRCH_PLANK]: plankP([198, 180, 134], [156, 138, 96]),
    [TILE.SPRUCE_LOG]: (x) => {
      if (x % 4 === 0) return [...jitter([46, 34, 20], 6), 255];
      return [...jitter([70, 52, 30], 8), 255];
    },
    [TILE.SPRUCE_PLANK]: plankP([116, 86, 50], [82, 60, 34]),
    [TILE.PUMPKIN_TOP]: (x, y) => {
      if (Math.abs(x - 7.5) < 1.6 && Math.abs(y - 7.5) < 1.6) return [...jitter([94, 112, 44], 8), 255];
      if ((x + y) % 5 === 0) return [...jitter([194, 106, 24], 8), 255];
      return [...jitter([224, 130, 36], 9), 255];
    },
    [TILE.PUMPKIN_SIDE]: (x) => {
      if (x % 5 === 4) return [...jitter([190, 100, 22], 8), 255];
      return [...jitter([226, 132, 38], 10), 255];
    },
    [TILE.MELON_SIDE]: (x) =>
      (x % 4 < 2 ? [...jitter([104, 156, 48], 8), 255] : [...jitter([62, 116, 34], 8), 255]),
    [TILE.MELON_TOP]: (x, y) =>
      (((x + y) % 4) < 2 ? [...jitter([104, 156, 48], 8), 255] : [...jitter([62, 116, 34], 8), 255]),
    [TILE.HAY_SIDE]: (x, y) => {
      if (y % 4 === 3) return [...jitter([146, 110, 40], 8), 255];
      if (hash2(x, y, 3) < 0.15) return [...jitter([214, 182, 70], 8), 255];
      return [...jitter([190, 156, 54], 9), 255];
    },
    [TILE.HAY_TOP]: (x, y) => {
      if (x % 5 === 0 || y % 5 === 0) return [...jitter([140, 106, 38], 8), 255];
      return ((((x / 5) | 0) + ((y / 5) | 0)) % 2
        ? [...jitter([198, 166, 62], 8), 255] : [...jitter([172, 138, 48], 8), 255]);
    },
    [TILE.TNT_SIDE]: (x, y) => {
      if (y >= 5 && y <= 10) {
        if (y >= 6 && y <= 9 && TNT_TXT[y - 6][x] === 't') return [42, 38, 34, 255];
        return [...jitter([232, 226, 214], 5), 255];
      }
      return [...jitter([200, 54, 38], 12), 255];
    },
    [TILE.TNT_TOP]: (x, y) => {
      if (x >= 3 && x <= 12 && y >= 3 && y <= 12) {
        if (x >= 7 && x <= 8 && y >= 7 && y <= 8) return [...jitter([60, 50, 40], 6), 255];
        return [...jitter([216, 192, 150], 8), 255];
      }
      return [...jitter([200, 54, 38], 12), 255];
    },
    [TILE.CACTUS_SIDE]: (x, y) => {
      if (x === 0 || x === 15) return [...jitter([40, 96, 24], 6), 255];
      if (x % 4 === 2 && (y + x) % 5 === 0) return [230, 232, 200, 255]; // spines
      if (x % 4 === 0) return [...jitter([48, 110, 28], 6), 255];
      return [...jitter([66, 140, 42], 8), 255];
    },
    [TILE.CACTUS_TOP]: (x, y) => {
      if (x < 2 || x > 13 || y < 2 || y > 13) return [...jitter([48, 110, 28], 6), 255];
      return [...jitter([80, 152, 52], 8), 255];
    },
    [TILE.TORCH]: (x, y) => {
      if (x >= 7 && x <= 8 && y >= 6) return [...jitter(y > 13 ? [116, 88, 46] : [150, 112, 60], 6), 255];
      if (x >= 6 && x <= 9 && y >= 2 && y <= 5) {
        if (x >= 7 && x <= 8 && y >= 3 && y <= 4) return [255, 240, 150, 255];
        return [...jitter([244, 170, 46], 14), 255];
      }
      return [0, 0, 0, 0];
    },
    [TILE.POPPY]: (x, y) => {
      const fx = x - 7.5, fy = y - 4.5;
      if (fx * fx + fy * fy <= 7 && y <= 8) {
        if (x >= 7 && x <= 8 && y >= 4 && y <= 5) return [64, 16, 12, 255];
        return [...jitter([200, 34, 30], 12), 255];
      }
      if (x === 7 && y >= 8) return [...jitter([62, 118, 34], 8), 255];
      if ((x === 5 || x === 6) && y === 11) return [...jitter([70, 130, 40], 8), 255];
      if ((x === 9 || x === 10) && y === 13) return [...jitter([70, 130, 40], 8), 255];
      return [0, 0, 0, 0];
    },
    [TILE.DANDELION]: (x, y) => {
      const fx = x - 7.5, fy = y - 5;
      if (fx * fx + fy * fy <= 5) {
        if (fx * fx + fy * fy <= 1.2) return [252, 232, 130, 255];
        return [...jitter([240, 204, 40], 10), 255];
      }
      if (x === 8 && y >= 7) return [...jitter([62, 118, 34], 8), 255];
      if ((x === 5 || x === 6) && y === 12) return [...jitter([70, 130, 40], 8), 255];
      return [0, 0, 0, 0];
    },
    [TILE.ICON_FENCE]: (x, y) => {
      const post = (x >= 2 && x <= 4) || (x >= 11 && x <= 13);
      const rail = (y >= 4 && y <= 5) || (y >= 9 && y <= 10);
      if (post && y >= 1) return [...jitter([158, 128, 79], 8), 255];
      if (rail) return [...jitter([139, 108, 62], 8), 255];
      return [0, 0, 0, 0];
    },
  };
  WOOL_COLORS.forEach(([, rgb], i) => { painters[TILE.WOOL0 + i] = woolP(rgb); });

  const oreP = (tile) => (x, y) => {
    const { color, spots, base = TILE.STONE } = ORE_SPOTS[tile];
    for (const [sx, sy] of spots) {
      if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= 2) return [...jitter(color, 8), 255];
    }
    return painters[base](x, y);
  };
  for (const t of Object.keys(ORE_SPOTS)) painters[t] = oreP(+t);

  // half-block / step silhouettes of the material painters (palette icons)
  const half = (p) => (x, y) => (y >= 8 ? p(x, y) : [0, 0, 0, 0]);
  const step = (p) => (x, y) => ((y >= 8 || x >= 8) ? p(x, y) : [0, 0, 0, 0]);
  painters[TILE.ICON_SLAB_OAK] = half(painters[TILE.PLANK]);
  painters[TILE.ICON_SLAB_COBBLE] = half(painters[TILE.COBBLE]);
  painters[TILE.ICON_SLAB_STONE] = half(painters[TILE.SMOOTH_STONE]);
  painters[TILE.ICON_SLAB_STONE_BRICK] = half(painters[TILE.STONE_BRICK]);
  painters[TILE.ICON_SLAB_BRICK] = half(painters[TILE.BRICKS]);
  painters[TILE.ICON_SLAB_SANDSTONE] = half(painters[TILE.SANDSTONE_SIDE]);
  painters[TILE.ICON_STAIR_OAK] = step(painters[TILE.PLANK]);
  painters[TILE.ICON_STAIR_COBBLE] = step(painters[TILE.COBBLE]);
  painters[TILE.ICON_STAIR_STONE_BRICK] = step(painters[TILE.STONE_BRICK]);
  painters[TILE.ICON_STAIR_BRICK] = step(painters[TILE.BRICKS]);

  for (const [tileStr, painter] of Object.entries(painters)) {
    const tile = +tileStr;
    const col = tile % COLS, row = (tile / COLS) | 0;
    const img = ctx.createImageData(T, T);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const [r, g, b, a] = painter(x, y);
        const i = (y * T + x) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, col * T, row * T);
  }
  return canvas;
}

// UV rect of a tile (half-texel inset to prevent bleeding). v1 = top edge.
export function tileUV(tile) {
  const col = tile % COLS, row = (tile / COLS) | 0;
  const pu = 0.5 / (COLS * T), pv = 0.5 / (ROWS * T);
  return {
    u0: col / COLS + pu, u1: (col + 1) / COLS - pu,
    v0: 1 - (row + 1) / ROWS + pv, v1: 1 - row / ROWS - pv,
  };
}

// Average color of each block's side tile (for break particles / icons).
export function computeAvgColors(atlasCanvas) {
  const ctx = atlasCanvas.getContext('2d');
  const colors = {};
  for (let id = 1; id < BLOCKS.length; id++) {
    const blk = BLOCKS[id];
    if (!blk) continue;
    const tile = blk.side;
    const col = tile % COLS, row = (tile / COLS) | 0;
    const d = ctx.getImageData(col * T, row * T, T, T).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    n = n || 1;
    colors[id] = [r / n / 255, g / n / 255, b / n / 255];
  }
  return colors;
}
