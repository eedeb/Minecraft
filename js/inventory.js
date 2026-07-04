// Player inventory: global item counts + 9 hotbar slots that point at item ids.

export class Inventory {
  constructor() {
    this.counts = new Map(); // itemId -> count
    this.hotbar = new Array(9).fill(null);
    this.onChange = null;
  }

  _changed() { if (this.onChange) this.onChange(); }

  count(id) { return this.counts.get(id) || 0; }

  add(id, n = 1) {
    if (n <= 0) return;
    this.counts.set(id, this.count(id) + n);
    // auto-assign new item types to a free hotbar slot
    if (!this.hotbar.includes(id)) {
      const free = this.hotbar.indexOf(null);
      if (free !== -1) this.hotbar[free] = id;
    }
    this._changed();
  }

  remove(id, n = 1) {
    const c = this.count(id) - n;
    if (c > 0) {
      this.counts.set(id, c);
    } else {
      this.counts.delete(id);
      this.hotbar = this.hotbar.map(s => (s === id ? null : s));
    }
    this._changed();
  }

  assignToHotbar(id, slot = -1) {
    if (!this.counts.has(id)) return;
    const existing = this.hotbar.indexOf(id);
    if (existing !== -1) this.hotbar[existing] = null;
    if (slot === -1) slot = this.hotbar.indexOf(null);
    if (slot === -1) slot = existing !== -1 ? existing : 8;
    this.hotbar[slot] = id;
    this._changed();
  }

  clearSlot(slot) {
    this.hotbar[slot] = null;
    this._changed();
  }

  canCraft(recipe) {
    return recipe.in.every(([id, n]) => this.count(id) >= n);
  }

  craft(recipe) {
    if (!this.canCraft(recipe)) return false;
    for (const [id, n] of recipe.in) this.remove(id, n);
    this.add(recipe.out, recipe.n);
    return true;
  }

  serialize() {
    return { counts: [...this.counts], hotbar: this.hotbar };
  }

  static from(data) {
    const inv = new Inventory();
    if (data) {
      for (const [id, n] of data.counts || []) inv.counts.set(+id, n);
      if (Array.isArray(data.hotbar)) inv.hotbar = data.hotbar.map(s => (s == null ? null : +s)).slice(0, 9);
      while (inv.hotbar.length < 9) inv.hotbar.push(null);
    }
    return inv;
  }
}
