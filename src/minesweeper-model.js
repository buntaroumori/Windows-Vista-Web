export class Minesweeper {
  constructor(size = 9, mineCount = 10, random = Math.random) {
    this.size = size;
    this.mineCount = mineCount;
    this.random = random;
    this.cells = Array.from({ length: size * size }, () => ({
      mine: false,
      adjacent: 0,
      open: false,
      flag: false,
    }));
    this.state = 'ready';
    this.started = 0;
    this.finished = 0;
  }
  neighbors(index) {
    const x = index % this.size,
      y = Math.floor(index / this.size),
      result = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= this.size || y + dy < 0 || y + dy >= this.size)
          continue;
        result.push((y + dy) * this.size + x + dx);
      }
    return result;
  }
  initialize(safe) {
    const forbidden = new Set([safe, ...this.neighbors(safe)]);
    const candidates = this.cells.map((_, i) => i).filter((i) => !forbidden.has(i));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    candidates.slice(0, this.mineCount).forEach((i) => {
      this.cells[i].mine = true;
    });
    this.cells.forEach((cell, i) => {
      cell.adjacent = this.neighbors(i).filter((n) => this.cells[n].mine).length;
    });
    this.state = 'playing';
    this.started = Date.now();
  }
  reveal(index) {
    const cell = this.cells[index];
    if (!cell || cell.flag || cell.open || ['won', 'lost'].includes(this.state)) return;
    if (this.state === 'ready') this.initialize(index);
    if (cell.mine) {
      cell.open = true;
      this.state = 'lost';
      this.finished = Date.now();
      return;
    }
    const queue = [index];
    while (queue.length) {
      const i = queue.pop(),
        current = this.cells[i];
      if (current.open || current.flag || current.mine) continue;
      current.open = true;
      if (current.adjacent === 0)
        queue.push(...this.neighbors(i).filter((n) => !this.cells[n].open));
    }
    if (this.cells.filter((c) => c.open).length === this.cells.length - this.mineCount) {
      this.state = 'won';
      this.finished = Date.now();
      this.cells
        .filter((c) => c.mine)
        .forEach((c) => {
          c.flag = true;
        });
    }
  }
  flag(index) {
    const cell = this.cells[index];
    if (cell && !cell.open && ['ready', 'playing'].includes(this.state)) cell.flag = !cell.flag;
  }
  get flags() {
    return this.cells.filter((c) => c.flag).length;
  }
  get seconds() {
    return this.started
      ? Math.min(999, Math.floor(((this.finished || Date.now()) - this.started) / 1000))
      : 0;
  }
}
