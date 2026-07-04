// Items, tools, mining rules (hardness / tool gating / drops), recipes,
// and procedural pixel-art item icons.

import { B, BLOCKS } from './blocks.js';

// Non-block item ids start at 100 (block items reuse their block id).
export const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, DIAMOND: 103,
  APPLE: 104, PORKCHOP: 105, BEEF: 106, MUTTON: 107, FLESH: 108,
  WOOD_PICK: 110, STONE_PICK: 111, IRON_PICK: 112, DIAMOND_PICK: 113,
  WOOD_AXE: 114, STONE_AXE: 115, IRON_AXE: 116, DIAMOND_AXE: 117,
  WOOD_SHOVEL: 118, STONE_SHOVEL: 119, IRON_SHOVEL: 120, DIAMOND_SHOVEL: 121,
  WOOD_SWORD: 122, STONE_SWORD: 123, IRON_SWORD: 124, DIAMOND_SWORD: 125,
};

export const TIER_NAMES = ['', 'wooden', 'stone', 'iron', 'diamond'];

// id -> {name, kind:'block'|'tool'|'food'|'material', toolType?, tier?, mult?, damage?, heal?}
export const ITEMS = {};

// every real block is also an inventory item
for (let id = 1; id < BLOCKS.length; id++) {
  if (!BLOCKS[id] || id === B.WATER || id === B.BEDROCK) continue;
  ITEMS[id] = { name: BLOCKS[id].name, kind: 'block' };
}

const mat = (name, kind, extra = {}) => ({ name, kind, ...extra });
ITEMS[I.STICK] = mat('Stick', 'material');
ITEMS[I.COAL] = mat('Coal', 'material');
ITEMS[I.IRON_INGOT] = mat('Iron Ingot', 'material');
ITEMS[I.DIAMOND] = mat('Diamond', 'material');
ITEMS[I.APPLE] = mat('Apple', 'food', { heal: 4 });
ITEMS[I.PORKCHOP] = mat('Porkchop', 'food', { heal: 8 });
ITEMS[I.BEEF] = mat('Beef', 'food', { heal: 8 });
ITEMS[I.MUTTON] = mat('Mutton', 'food', { heal: 6 });
ITEMS[I.FLESH] = mat('Rotten Flesh', 'food', { heal: 2 });

const MATS = {
  wood: { tier: 1, mult: 4, damage: 4, m: '#9e7145', d: '#77542f' },
  stone: { tier: 2, mult: 8, damage: 5, m: '#8f8f8f', d: '#6a6a6a' },
  iron: { tier: 3, mult: 12, damage: 6, m: '#dcdcdc', d: '#a8a8a8' },
  diamond: { tier: 4, mult: 16, damage: 7, m: '#4adfd9', d: '#2fb3ae' },
};
const TOOL_IDS = {
  pickaxe: [I.WOOD_PICK, I.STONE_PICK, I.IRON_PICK, I.DIAMOND_PICK],
  axe: [I.WOOD_AXE, I.STONE_AXE, I.IRON_AXE, I.DIAMOND_AXE],
  shovel: [I.WOOD_SHOVEL, I.STONE_SHOVEL, I.IRON_SHOVEL, I.DIAMOND_SHOVEL],
  sword: [I.WOOD_SWORD, I.STONE_SWORD, I.IRON_SWORD, I.DIAMOND_SWORD],
};
{
  const matNames = ['wood', 'stone', 'iron', 'diamond'];
  const label = { wood: 'Wooden', stone: 'Stone', iron: 'Iron', diamond: 'Diamond' };
  const toolLabel = { pickaxe: 'Pickaxe', axe: 'Axe', shovel: 'Shovel', sword: 'Sword' };
  for (const [tool, ids] of Object.entries(TOOL_IDS)) {
    matNames.forEach((mn, i) => {
      const m = MATS[mn];
      ITEMS[ids[i]] = {
        name: `${label[mn]} ${toolLabel[tool]}`, kind: 'tool', toolType: tool,
        tier: m.tier, mult: m.mult, damage: tool === 'sword' ? m.damage : 3, matKey: mn,
      };
    });
  }
}

export const HAND_DAMAGE = 2;
export function itemDamage(id) {
  const it = ITEMS[id];
  return (it && it.kind === 'tool') ? it.damage : HAND_DAMAGE;
}

// ---------------------------------------------------------------------------
// Mining rules. hand = seconds to break bare-handed. tier = minimum tool tier
// required for the block to DROP anything. drop(rand) -> [itemId, count] | null.

export const MINING = {
  [B.GRASS]: { hand: 0.9, tool: 'shovel', tier: 0, drop: () => [B.DIRT, 1] },
  [B.DIRT]: { hand: 0.75, tool: 'shovel', tier: 0, drop: () => [B.DIRT, 1] },
  [B.SAND]: { hand: 0.75, tool: 'shovel', tier: 0, drop: () => [B.SAND, 1] },
  [B.SNOW]: { hand: 0.75, tool: 'shovel', tier: 0, drop: () => [B.SNOW, 1] },
  [B.STONE]: { hand: 7.5, tool: 'pickaxe', tier: 1, drop: () => [B.COBBLE, 1] },
  [B.COBBLE]: { hand: 10, tool: 'pickaxe', tier: 1, drop: () => [B.COBBLE, 1] },
  [B.COAL_ORE]: { hand: 15, tool: 'pickaxe', tier: 1, drop: () => [I.COAL, 1] },
  [B.IRON_ORE]: { hand: 15, tool: 'pickaxe', tier: 2, drop: () => [I.IRON_INGOT, 1] },
  [B.DIAMOND_ORE]: { hand: 15, tool: 'pickaxe', tier: 3, drop: () => [I.DIAMOND, 1] },
  [B.LOG]: { hand: 3, tool: 'axe', tier: 0, drop: () => [B.LOG, 1] },
  [B.PLANK]: { hand: 3, tool: 'axe', tier: 0, drop: () => [B.PLANK, 1] },
  [B.LEAVES]: { hand: 0.35, tool: null, tier: 0, drop: (r) => r < 0.08 ? [I.APPLE, 1] : null },
  [B.GLASS]: { hand: 0.45, tool: null, tier: 0, drop: () => null },
  [B.WOOL]: { hand: 1.1, tool: null, tier: 0, drop: () => [B.WOOL, 1] },
  [B.CRAFTING_TABLE]: { hand: 2.5, tool: 'axe', tier: 0, drop: () => [B.CRAFTING_TABLE, 1] },
  [B.ICE]: { hand: 1.0, tool: 'pickaxe', tier: 0, drop: () => null },
  [B.STONE_BRICK]: { hand: 7.5, tool: 'pickaxe', tier: 1, drop: () => [B.STONE_BRICK, 1] },
  [B.IRON_BLOCK]: { hand: 15, tool: 'pickaxe', tier: 2, drop: () => [B.IRON_BLOCK, 1] },
  [B.DIAMOND_BLOCK]: { hand: 15, tool: 'pickaxe', tier: 3, drop: () => [B.DIAMOND_BLOCK, 1] },
};

// What happens if `heldId` mines `blockId`. null = unbreakable.
export function breakInfo(blockId, heldId) {
  const m = MINING[blockId];
  if (!m) return null;
  const it = ITEMS[heldId];
  let time = m.hand;
  let canHarvest = m.tier === 0;
  if (it && it.kind === 'tool' && it.toolType === m.tool) {
    time = m.hand / it.mult;
    if (it.tier >= m.tier) canHarvest = true;
  }
  return { time: Math.max(0.05, time), canHarvest, drop: m.drop, needTool: m.tool, needTier: m.tier };
}

// ---------------------------------------------------------------------------
// Recipes (Minecraft-style grid crafting)
// Shaped recipes have a pattern laid out in the grid; shapeless just need the
// items anywhere. Recipes taller/wider than 2 need a crafting table (3x3).

function shaped(out, n, shape, key) {
  const pattern = shape.map(row => [...row].map(ch => (ch === '.' ? null : key[ch])));
  const counts = new Map();
  for (const row of pattern) for (const c of row) if (c != null) counts.set(c, (counts.get(c) || 0) + 1);
  const h = pattern.length, w = pattern[0].length;
  return { out, n, pattern, in: [...counts], needsTable: h > 2 || w > 2 };
}

function shapeless(out, n, items) {
  const counts = new Map();
  for (const id of items) counts.set(id, (counts.get(id) || 0) + 1);
  return { out, n, shapeless: [...items].sort((a, b) => a - b), in: [...counts], needsTable: items.length > 4 };
}

const toolRecipes = [];
{
  const heads = { wood: B.PLANK, stone: B.COBBLE, iron: I.IRON_INGOT, diamond: I.DIAMOND };
  const shapes = {
    pickaxe: ['MMM', '.S.', '.S.'],
    axe: ['MM', 'MS', '.S'],
    shovel: ['M', 'S', 'S'],
    sword: ['M', 'M', 'S'],
  };
  ['wood', 'stone', 'iron', 'diamond'].forEach((mn, i) => {
    for (const [tool, ids] of Object.entries(TOOL_IDS)) {
      toolRecipes.push(shaped(ids[i], 1, shapes[tool], { M: heads[mn], S: I.STICK }));
    }
  });
}

export const RECIPES = [
  shaped(B.PLANK, 4, ['L'], { L: B.LOG }),
  shaped(I.STICK, 4, ['P', 'P'], { P: B.PLANK }),
  shaped(B.CRAFTING_TABLE, 1, ['PP', 'PP'], { P: B.PLANK }),
  ...toolRecipes,
  shaped(B.STONE_BRICK, 4, ['CC', 'CC'], { C: B.COBBLE }),
  shapeless(B.GLASS, 1, [B.SAND, I.COAL]),
  shaped(B.IRON_BLOCK, 1, ['III', 'III', 'III'], { I: I.IRON_INGOT }),
  shapeless(I.IRON_INGOT, 9, [B.IRON_BLOCK]),
  shaped(B.DIAMOND_BLOCK, 1, ['DDD', 'DDD', 'DDD'], { D: I.DIAMOND }),
  shapeless(I.DIAMOND, 9, [B.DIAMOND_BLOCK]),
];

// Match the crafting grid (row-major array of itemId|null, always 3x3)
// against all recipes. Returns the recipe or null.
export function matchGrid(cells, size = 3) {
  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r * size + c] != null) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR === -1) return null;
  const h = maxR - minR + 1, w = maxC - minC + 1;

  const placed = cells.filter(c => c != null).sort((a, b) => a - b);

  for (const r of RECIPES) {
    if (r.shapeless) {
      if (placed.length === r.shapeless.length && placed.every((id, i) => id === r.shapeless[i])) return r;
      continue;
    }
    const pat = r.pattern;
    if (pat.length !== h || pat[0].length !== w) continue;
    let ok = true, okMirror = true;
    for (let rr = 0; rr < h && (ok || okMirror); rr++) {
      for (let cc = 0; cc < w; cc++) {
        const cell = cells[(minR + rr) * size + (minC + cc)];
        if (cell !== pat[rr][cc]) ok = false;
        if (cell !== pat[rr][w - 1 - cc]) okMirror = false;
      }
    }
    if (ok || okMirror) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pixel-art icons (12x12 stencils rendered onto 16x16 canvases)

const TOOL_STENCILS = {
  pickaxe: [
    '..dmmmmmd...',
    '.md.....dm..',
    'md.......dm.',
    'm.....hh..m.',
    '......hh....',
    '.....hh.....',
    '....hh......',
    '...hh.......',
    '..hh........',
    '.hh.........',
    'hh..........',
    '............',
  ],
  axe: [
    '..dmmm......',
    '.dmmmmm.....',
    '.mmd.hh.....',
    '.mm.hh......',
    '....hh......',
    '...hh.......',
    '..hh........',
    '.hh.........',
    'hh..........',
    '............',
    '............',
    '............',
  ],
  shovel: [
    '.......dmm..',
    '......dmmm..',
    '......mmmm..',
    '.....h.mm...',
    '....hh......',
    '...hh.......',
    '..hh........',
    '.hh.........',
    'hh..........',
    '............',
    '............',
    '............',
  ],
  sword: [
    '.........mm.',
    '........mmd.',
    '.......mmd..',
    '......mmd...',
    '.....mmd....',
    '.g..mmd.....',
    '..gmmd......',
    '..gg........',
    '.hhg........',
    'hh..........',
    '............',
    '............',
  ],
};

const MEAT = [
  '............',
  '....pppp....',
  '..pPPppppp..',
  '.pPPpppppp..',
  '.ppppppppp..',
  '..ppppppp...',
  '...wwpp.....',
  '...ww.......',
  '..ww........',
  '............',
  '............',
  '............',
];

const ITEM_STENCILS = {
  [I.STICK]: {
    rows: [
      '............', '.......hh...', '......hhh...', '.....hhh....',
      '....hhh.....', '...hhh......', '..hhh.......', '.hhh........',
      '.hh.........', '............', '............', '............',
    ],
    pal: { h: '#8a5d2e' },
  },
  [I.COAL]: {
    rows: [
      '............', '............', '...cccc.....', '..cccccc....',
      '.ccclcccc...', '.cccccccc...', '.ccccccdc...', '..cccccc....',
      '...cccc.....', '............', '............', '............',
    ],
    pal: { c: '#2e2e32', l: '#54545a', d: '#1a1a1e' },
  },
  [I.IRON_INGOT]: {
    rows: [
      '............', '............', '............', '...dddddd...',
      '..dmmmmmmd..', '.dmmlmmmmmd.', '.mmmmmmmmm..', '.dddddddddd.',
      '............', '............', '............', '............',
    ],
    pal: { m: '#d8d8d8', d: '#9a9a9a', l: '#f4f4f4' },
  },
  [I.DIAMOND]: {
    rows: [
      '............', '............', '....dmmd....', '...dmlmmd...',
      '..dmlmmmmd..', '...mmmmmm...', '....mmmm....', '.....mm.....',
      '............', '............', '............', '............',
    ],
    pal: { m: '#4adfd9', d: '#2fb3ae', l: '#b8fffb' },
  },
  [I.APPLE]: {
    rows: [
      '......g.....', '.....g......', '..rrr.rrr...', '.rrrrrrrrr..',
      '.rlrrrrrrr..', '.rlrrrrrrr..', '.rrrrrrrrr..', '..rrrrrrr...',
      '...rr.rr....', '............', '............', '............',
    ],
    pal: { r: '#c62828', g: '#3f7d2c', l: '#e57373' },
  },
  [I.PORKCHOP]: { rows: MEAT, pal: { p: '#f2a0a0', P: '#f8caca', w: '#efe6d6' } },
  [I.BEEF]: { rows: MEAT, pal: { p: '#9e4a3a', P: '#c96f5b', w: '#efe6d6' } },
  [I.MUTTON]: { rows: MEAT, pal: { p: '#d67e6e', P: '#eba99c', w: '#efe6d6' } },
  [I.FLESH]: { rows: MEAT, pal: { p: '#7a8a4a', P: '#9aa86a', w: '#5a6a3a' } },
};

const iconCache = new Map();
let atlasRef = null;

export function initItemIcons(atlasCanvas) { atlasRef = atlasCanvas; }

function drawStencil(ctx, rows, pal) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = pal[ch] || '#f0f';
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }
  }
}

// 16x16 icon canvas for any item id.
export function itemIcon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const it = ITEMS[id];
  if (it && it.kind === 'block' && atlasRef) {
    const tile = BLOCKS[id].side;
    const col = tile % 8, row = (tile / 8) | 0;
    ctx.drawImage(atlasRef, col * 16, row * 16, 16, 16, 0, 0, 16, 16);
  } else if (it && it.kind === 'tool') {
    const m = MATS[it.matKey];
    drawStencil(ctx, TOOL_STENCILS[it.toolType], { m: m.m, d: m.d, h: '#8a5d2e', g: '#5a5a5a' });
  } else if (ITEM_STENCILS[id]) {
    drawStencil(ctx, ITEM_STENCILS[id].rows, ITEM_STENCILS[id].pal);
  }
  iconCache.set(id, c);
  return c;
}
