// Block definitions + procedurally generated 16px texture atlas (no image assets needed).

import { mulberry32, hash2 } from './noise.js';

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANK: 5, LOG: 6, LEAVES: 7,
  SAND: 8, GLASS: 9, WATER: 10, SNOW: 11, BEDROCK: 12, COAL_ORE: 13, IRON_ORE: 14, DIAMOND_ORE: 15,
};

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANK: 5, LOG_SIDE: 6, LOG_TOP: 7,
  LEAVES: 8, SAND: 9, GLASS: 10, WATER: 11, SNOW: 12, SNOW_SIDE: 13, BEDROCK: 14,
  COAL: 15, IRON: 16, DIAMOND: 17,
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

export const isSolid = (id) => !!(BLOCKS[id] && BLOCKS[id].solid);
export const isOpaque = (id) => !!(BLOCKS[id] && BLOCKS[id].opaque);

// Hotbar palette (creative mode: infinite blocks)
export const PALETTE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANK, B.LOG, B.LEAVES, B.SAND, B.GLASS];

// ---------------------------------------------------------------------------
// Texture atlas: 8x4 grid of 16px tiles -> 128x64 canvas.
const T = 16, COLS = 8, ROWS = 4;

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
