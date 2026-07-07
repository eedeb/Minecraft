// Block definitions + procedurally generated 16px texture atlas (no image assets needed).

import { mulberry32, hash2 } from './noise.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANK: 5, LOG: 6, LEAVES: 7,
  SAND: 8, GLASS: 9, WATER: 10, SNOW: 11, BEDROCK: 12, COAL_ORE: 13, IRON_ORE: 14, DIAMOND_ORE: 15,
  WOOL: 16, CRAFTING_TABLE: 17, STONE_BRICK: 18, IRON_BLOCK: 19, DIAMOND_BLOCK: 20,
  ICE: 21, FURNACE: 22, LAVA: 23, OBSIDIAN: 24, PORTAL: 25, NETHERRACK: 26,
  END_FRAME: 27, END_FRAME_FILLED: 28, END_PORTAL: 29, END_STONE: 30, DRAGON_EGG: 31,
  CHEST: 32, BED: 33,
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
};

// def: {name, top, bottom, side (tile ids), solid (collision), opaque (face culling), breakable}
export const BLOCKS = [];
const def = (id, name, top, bottom, side, opts = {}) => {
  BLOCKS[id] = { name, top, bottom, side, solid: true, opaque: true, breakable: true, ...opts };
};
BLOCKS[B.AIR] = { name: 'Air', solid: false, opaque: false, breakable: false };
def(B.GRASS, 'Grass', TILE.GRASS_TOP, TILE.DIRT, TILE.GRASS_SIDE);
def(B.DIRT, 'Dirt', TILE.DIRT, TILE.DIRT, TILE.DIRT);
def(B.STONE, 'Stone', TILE.STONE, TILE.STONE, TILE.STONE);
def(B.COBBLE, 'Cobblestone', TILE.COBBLE, TILE.COBBLE, TILE.COBBLE);
def(B.PLANK, 'Planks', TILE.PLANK, TILE.PLANK, TILE.PLANK);
def(B.LOG, 'Log', TILE.LOG_TOP, TILE.LOG_TOP, TILE.LOG_SIDE);
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

export const isSolid = (id) => !!(BLOCKS[id] && BLOCKS[id].solid);
export const isOpaque = (id) => !!(BLOCKS[id] && BLOCKS[id].opaque);

// ---------------------------------------------------------------------------
// Texture atlas: 8x8 grid of 16px tiles -> 128x128 canvas.
const T = 16, COLS = 8, ROWS = 8;

const ORE_SPOTS = {
  [TILE.COAL]: { color: [38, 38, 40], spots: [[4, 5], [11, 3], [7, 10], [12, 12], [3, 12]] },
  [TILE.IRON]: { color: [216, 175, 147], spots: [[5, 4], [11, 6], [4, 11], [10, 12]] },
  [TILE.DIAMOND]: { color: [92, 219, 213], spots: [[4, 4], [11, 5], [6, 11], [12, 11]] },
};

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * T; canvas.height = ROWS * T;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(1337 * 7);

  const jitter = (base, amt) => {
    const o = (rand() - 0.5) * 2 * amt;
    return [base[0] + o, base[1] + o, base[2] + o];
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
    [TILE.PLANK]: (x, y) => {
      if (y % 4 === 3) return [...jitter([106, 84, 51], 6), 255];
      if ((y < 4 && x === 3) || (y >= 4 && y < 8 && x === 11) || (y >= 8 && y < 12 && x === 6) || (y >= 12 && x === 13))
        return [...jitter([106, 84, 51], 6), 255];
      return [...jitter([158, 128, 79], 8), 255];
    },
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
    [TILE.STONE_BRICK]: (x, y) => {
      const off = (((y >> 2) % 2) * 4);
      if (y % 4 === 3 || (x + off) % 8 === 7) return [...jitter([86, 86, 88], 5), 255];
      return [...jitter([138, 138, 141], 7), 255];
    },
    [TILE.IRON_BLOCK]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([148, 148, 152], 5), 255];
      return [...jitter([219, 219, 222], 5), 255];
    },
    [TILE.DIAMOND_BLOCK]: (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [...jitter([52, 150, 145], 5), 255];
      return [...jitter([95, 216, 209], 6), 255];
    },
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
  };
  const oreP = (tile) => (x, y) => {
    const { color, spots } = ORE_SPOTS[tile];
    for (const [sx, sy] of spots) {
      if ((x - sx) * (x - sx) + (y - sy) * (y - sy) <= 2) return [...jitter(color, 8), 255];
    }
    return painters[TILE.STONE](x, y);
  };
  painters[TILE.COAL] = oreP(TILE.COAL);
  painters[TILE.IRON] = oreP(TILE.IRON);
  painters[TILE.DIAMOND] = oreP(TILE.DIAMOND);

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
