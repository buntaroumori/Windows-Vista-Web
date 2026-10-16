import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactHash, filesIn } from './artifact.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
assert.ok(process.env.npm_execpath, 'Use npm run pack.');
execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { stdio: 'inherit' });
const quality = JSON.parse(await readFile('docs/quality-results.json', 'utf8'));
assert.equal(quality.status, 'PASS', 'Run npm run check successfully before packaging.');
assert.equal(
  await artifactHash('dist'),
  quality.buildSha256,
  'The build changed since validation. Run npm run check again.',
);
await import('./asset-manifest.mjs');
await rm('site', { recursive: true, force: true });
await cp('dist', 'site', { recursive: true });

// A small self-contained ZIP writer: no archiver package, OS utility or Python needed.
// UTF-8 names, fixed DOS timestamp, ordinary DEFLATE, standard CRC32 and central directory.
const { deflateRawSync } = await import('node:zlib');
const table = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function zip(directory, names, destination, prefix = '') {
  assert.ok(names.length < 65535, 'ZIP64 is not needed for this project.');
  const chunks = [],
    central = [];
  let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(prefix + name),
      data = await readFile(path.join(directory, name));
    const compressed = deflateRawSync(data, { level: 9 }),
      crc = crc32(data);
    const date = ((2007 - 1980) << 9) | (1 << 5) | 30;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    chunks.push(local, filename, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE((3 << 8) | 20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(date, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(filename.length, 28);
    record.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    record.writeUInt32LE(offset, 42);
    central.push(record, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const centralSize = central.reduce((sum, block) => sum + block.length, 0),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  const archive = Buffer.concat([...chunks, ...central, end]);
  await writeFile(destination, archive);
  console.log(`${destination}: ${names.length} files, ${archive.length} bytes`);
  return createHash('sha256').update(archive).digest('hex');
}
const ignore = (name, entry) => {
  const first = name.split('/')[0];
  return (
    ['node_modules', 'dist', '.git', 'playwright-report', 'test-results', '.cache'].includes(
      first,
    ) ||
    name.endsWith('.zip') ||
    entry.name === '.DS_Store' ||
    entry.name.startsWith('.env')
  );
};
const inventory = await filesIn(root, ignore);
if (!inventory.includes('docs/FILES.txt')) inventory.push('docs/FILES.txt');
await writeFile(
  'docs/FILES.txt',
  inventory
    .sort()
    .map((name) => `vista-desktop/${name}`)
    .join('\n') + '\n',
);
const sourceName = path.resolve(root, '../Windows-Vista-Aero.zip'),
  staticName = path.resolve(root, '../Windows-Vista-Static.zip');
const sourceHash = await zip(root, await filesIn(root, ignore), sourceName, 'vista-desktop/');
const staticHash = await zip(path.join(root, 'site'), await filesIn('site'), staticName);
await writeFile(
  path.resolve(root, '../Vista-SHA256SUMS.txt'),
  `${sourceHash}  Windows-Vista-Aero.zip\n${staticHash}  Windows-Vista-Static.zip\n`,
);
console.log('Validated source and static archives are ready.');
