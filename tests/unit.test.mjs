import test from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../src/calculator-model.js';
import { FileSystem, validFileName } from '../src/filesystem.js';
import { SafeStorage, Settings } from '../src/store.js';
import { Minesweeper } from '../src/minesweeper-model.js';
import { escapeHTML, normalize, clamp } from '../src/utils.js';

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(k) {
    return this.data.get(k) ?? null;
  }
  setItem(k, v) {
    this.data.set(k, v);
  }
  removeItem(k) {
    this.data.delete(k);
  }
}
const setupFS = () => {
  const backing = new MemoryStorage(),
    storage = new SafeStorage(backing);
  return { fs: new FileSystem(storage), storage, backing };
};
const calc = (sequence) => {
  const c = new Calculator();
  sequence.forEach((key) => c.press(key));
  return c;
};

test('calculator: decimal arithmetic is rounded without binary artifacts', () =>
  assert.equal(calc(['0', '.', '1', '+', '0', '.', '2', '=']).display, '0,3'));
test('calculator: chained operations follow the classic immediate model', () =>
  assert.equal(calc(['2', '+', '3', '*', '4', '=']).number, 20));
test('calculator: repeated equals repeats the last operation', () =>
  assert.equal(calc(['5', '+', '2', '=', '=', '=']).number, 11));
test('calculator: replacing an operator does not apply it twice', () =>
  assert.equal(calc(['2', '+', '*', '3', '=']).number, 6));
test('calculator: addition percent is relative to accumulator', () =>
  assert.equal(calc(['2', '0', '0', '+', '1', '0', '%', '=']).number, 220));
test('calculator: multiplication percent uses a fraction', () =>
  assert.equal(calc(['2', '0', '0', '*', '1', '0', '%', '=']).number, 20));
test('calculator: division by zero reports and recovers', () => {
  const c = calc(['9', '/', '0', '=']);
  assert.equal(c.error, true);
  c.press('7');
  assert.equal(c.number, 7);
  assert.equal(c.error, false);
});
test('calculator: CE preserves a pending operation', () =>
  assert.equal(calc(['8', '+', '9', 'CE', '2', '=']).number, 10));
test('calculator: memory store, add, recall, clear', () => {
  const c = calc(['8', 'MS', '2', 'M+', 'C', 'MR']);
  assert.equal(c.number, 10);
  c.press('MC');
  assert.equal(c.memory, 0);
});
test('calculator: sqrt and inverse', () => {
  assert.equal(calc(['8', '1', 'sqrt']).number, 9);
  assert.equal(calc(['4', 'inv']).number, 0.25);
});
test('calculator: negative square root is an error', () =>
  assert.equal(calc(['9', 'sign', 'sqrt']).error, true));
test('calculator: scientific angles are in degrees', () =>
  assert.equal(calc(['3', '0', 'sin']).number, 0.5));
test('calculator: exponentiation', () =>
  assert.equal(calc(['2', '^', '1', '0', '=']).number, 1024));
test('calculator: only one decimal separator and input length is bounded', () => {
  const c = calc(['.', '.', '5']);
  assert.equal(c.display, '0,5');
  for (let i = 0; i < 30; i++) c.press('1');
  assert.ok(c.input.length <= 17);
});
test('calculator: backspace never leaves a lone minus', () =>
  assert.equal(calc(['1', 'sign', 'Backspace']).number, 0));
test('calculator: large non-finite results are contained', () =>
  assert.equal(calc(['9', '^', '9', '9', '9', '=']).error, true));

test('filesystem: expected folders and seed documents exist', () => {
  const { fs } = setupFS();
  assert.equal(fs.get('c').type, 'folder');
  assert.ok(fs.list('documents').some((n) => n.name.endsWith('.txt')));
  assert.equal(fs.list('pictures').length, 4);
});
test('filesystem: create, write and reconstruct from persisted state', () => {
  const { fs, storage } = setupFS();
  const file = fs.create('documents', 'Prueba.txt', 'text', 'Español ñ <script>');
  fs.write(file.id, 'Guardado ✓');
  const restored = new FileSystem(storage);
  assert.equal(restored.get(file.id).content, 'Guardado ✓');
});
test('filesystem: duplicate names are case insensitive', () => {
  const { fs } = setupFS();
  fs.create('documents', 'Uno.txt', 'text');
  assert.throws(() => fs.create('documents', 'UNO.txt', 'text'), /Ya existe/);
});
test('filesystem: search ignores accents and case', () => {
  const { fs } = setupFS();
  assert.ok(fs.search('IMAGENES').some((n) => n.id === 'pictures'));
});
test('filesystem: unique folder naming', () => {
  const { fs } = setupFS();
  fs.create('desktop', 'Nueva carpeta');
  assert.equal(fs.uniqueName('desktop'), 'Nueva carpeta (2)');
});
test('filesystem: rename and move to trash, restore', () => {
  const { fs } = setupFS();
  const n = fs.create('desktop', 'A.txt', 'text', 'a');
  fs.rename(n.id, 'B.txt');
  fs.trash(n.id);
  assert.equal(fs.list('desktop').length, 0);
  assert.equal(fs.list('recycle')[0].name, 'B.txt');
  fs.restore(n.id);
  assert.equal(fs.list('desktop')[0].name, 'B.txt');
});
test('filesystem: trash folder hides descendants without destroying them', () => {
  const { fs } = setupFS();
  const folder = fs.create('documents', 'Temporal');
  const child = fs.create(folder.id, 'nota.txt', 'text', 'hola');
  fs.trash(folder.id);
  assert.equal(fs.isTrashed(child), true);
  assert.equal(fs.search('nota.txt').length, 0);
  assert.equal(fs.list('recycle').length, 1);
  fs.restore(folder.id);
  assert.equal(fs.isTrashed(child), false);
  assert.equal(fs.get(child.id).content, 'hola');
});
test('filesystem: emptying trash removes descendants permanently', () => {
  const { fs } = setupFS();
  const folder = fs.create('desktop', 'Temp');
  const child = fs.create(folder.id, 'x.txt', 'text');
  fs.trash(folder.id);
  fs.emptyTrash();
  assert.equal(fs.get(folder.id), undefined);
  assert.equal(fs.get(child.id), undefined);
});
test('filesystem: restore resolves a name collision', () => {
  const { fs } = setupFS();
  const a = fs.create('desktop', 'Nota.txt', 'text');
  fs.trash(a.id);
  fs.create('desktop', 'Nota.txt', 'text');
  fs.restore(a.id);
  assert.equal(fs.get(a.id).name, 'Nota.txt (2)');
});
test('filesystem: system folders are protected', () => {
  const { fs } = setupFS();
  assert.throws(() => fs.trash('documents'), /protegida/);
  assert.throws(() => fs.rename('c', 'otro'), /No se puede/);
});
test('filesystem: nonexistent destinations fail without mutating state', () => {
  const { fs } = setupFS();
  const count = fs.nodes.length;
  assert.throws(() => fs.create('no-folder', 'x.txt', 'text'));
  assert.equal(fs.nodes.length, count);
});
test('filesystem: per-document limit is enforced', () => {
  const { fs } = setupFS();
  assert.throws(() => fs.create('documents', 'huge.txt', 'text', 'x'.repeat(1_000_001)), /límite/);
});
test('filesystem: quota failures roll back the transaction', () => {
  const { fs, backing } = setupFS();
  const before = fs.nodes.length;
  backing.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.throws(() => fs.create('documents', 'No.txt', 'text'), /permite/);
  assert.equal(fs.nodes.length, before);
});
test('filesystem: corrupted persisted data falls back safely', () => {
  const storage = new SafeStorage(new MemoryStorage());
  storage.set('files.v1', { version: 1, nodes: [null] });
  assert.ok(new FileSystem(storage).get('documents'));
});
test('filesystem: cyclic ancestor data terminates', () => {
  const { fs } = setupFS();
  const a = fs.create('desktop', 'Loop');
  a.parent = a.id;
  assert.equal(fs.ancestors(a.id).length, 1);
  assert.equal(fs.isTrashed(a), false);
});
for (const name of ['../escape', 'a\\b', 'x:y', 'bad?.txt', 'NUL.txt', 'COM1', '..', 'trailing.'])
  test(`filename validation: rejects ${JSON.stringify(name)}`, () =>
    assert.throws(() => validFileName(name)));
test('filename validation: retains Spanish, ampersands and apostrophes', () =>
  assert.equal(validFileName("Diseño & Ana's.txt"), "Diseño & Ana's.txt"));

test('settings: sanitize corrupt values and gadget lists', () => {
  const storage = new SafeStorage(new MemoryStorage());
  storage.set('settings.v1', {
    wallpaper: '../x',
    accent: 'red',
    gadgets: ['clock', 'evil', 'clock'],
    volume: 150,
    userName: 'x'.repeat(90),
    glassOpacity: 900,
  });
  const s = new Settings(storage);
  assert.equal(s.get('wallpaper'), 'aurora');
  assert.equal(s.get('accent'), '#85b9c9');
  assert.deepEqual(s.get('gadgets'), ['clock']);
  assert.equal(s.get('volume'), 100);
  assert.equal(s.get('userName').length, 40);
  assert.equal(s.get('glassOpacity'), 95);
});
test('storage: blocked reads and writes are contained', () => {
  const storage = new SafeStorage({
    getItem() {
      throw new Error('Blocked');
    },
    setItem() {
      throw new Error('Blocked');
    },
  });
  assert.equal(storage.get('x', 42), 42);
  assert.equal(storage.set('x', 'draft'), false);
  assert.equal(storage.get('x'), 'draft');
  assert.equal(storage.available, false);
});
test('storage: malformed JSON returns fallback', () => {
  const backing = new MemoryStorage();
  backing.setItem('vista.bad', '{');
  assert.equal(new SafeStorage(backing).get('bad', 'safe'), 'safe');
});
test('settings: subscriptions unsubscribe without leaks', () => {
  const s = new Settings(new SafeStorage(new MemoryStorage()));
  let hits = 0;
  const off = s.subscribe(() => hits++);
  s.set('volume', 15);
  off();
  s.set('volume', 20);
  assert.equal(hits, 1);
});

test('minesweeper: first click and its neighbors cannot contain a mine', () => {
  const m = new Minesweeper(9, 10, () => 0.314);
  m.reveal(40);
  for (const i of [40, ...m.neighbors(40)]) assert.equal(m.cells[i].mine, false);
  assert.equal(m.cells.filter((c) => c.mine).length, 10);
});
test('minesweeper: flagging does not initialize the game', () => {
  const m = new Minesweeper();
  m.flag(0);
  m.reveal(0);
  assert.equal(m.state, 'ready');
  assert.equal(m.flags, 1);
  m.flag(0);
  assert.equal(m.flags, 0);
});
test('minesweeper: flood opening reveals blank neighbors', () => {
  const m = new Minesweeper(9, 10, () => 0.5);
  m.reveal(40);
  assert.ok(m.cells.filter((c) => c.open).length >= 9);
});
test('minesweeper: revealing a mine ends the game', () => {
  const m = new Minesweeper(9, 10, () => 0.5);
  m.reveal(40);
  const i = m.cells.findIndex((c) => c.mine);
  m.reveal(i);
  assert.equal(m.state, 'lost');
  const opened = m.cells.filter((c) => c.open).length;
  m.reveal(0);
  assert.equal(m.cells.filter((c) => c.open).length, opened);
});
test('minesweeper: all safe cells revealed is a win', () => {
  const m = new Minesweeper(9, 10, () => 0.5);
  m.reveal(40);
  m.cells.forEach((c, i) => {
    if (!c.mine) m.reveal(i);
  });
  assert.equal(m.state, 'won');
  assert.equal(m.flags, 10);
});

test('HTML escaping covers all attribute and text delimiters', () =>
  assert.equal(
    escapeHTML(`<img src="x" onerror='x'>&`),
    '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;',
  ));
test('search normalization handles Spanish diacritics', () =>
  assert.equal(normalize('  GALERÍA FOTOGRÁFICA  '), 'galeria fotografica'));
test('clamping tolerates a viewport smaller than the preferred minimum', () =>
  assert.equal(clamp(50, 100, 80), 100));

test('calculator: typing a new value resets repeat-equals state', () =>
  assert.equal(calc(['1', '+', '2', '=', '4', '=']).number, 4));
test('filesystem: accented and unaccented filenames can coexist', () => {
  const { fs } = setupFS();
  fs.create('documents', 'Diseño.txt', 'text');
  fs.create('documents', 'Diseno.txt', 'text');
  assert.equal(fs.search('diseno').length, 2);
});
test('filesystem: failed persistence does not leak a draft transaction into memory', () => {
  const { fs, storage, backing } = setupFS();
  backing.setItem = () => {
    throw new Error('Blocked');
  };
  assert.throws(() => fs.create('documents', 'No persistir.txt', 'text'));
  const reloaded = new FileSystem(storage);
  assert.equal(reloaded.search('No persistir').length, 0);
});
