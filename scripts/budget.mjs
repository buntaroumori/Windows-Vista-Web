import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import assert from 'node:assert/strict';

const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    if ((await stat(p)).isDirectory()) await walk(p);
    else files.push(p);
  }
}
await walk('dist');
const result = {
  measuredAt: new Date().toISOString(),
  javascriptGzipBytes: 0,
  cssGzipBytes: 0,
  totalStaticBytes: 0,
  files: files.length,
};
for (const file of files) {
  const bytes = await readFile(file);
  result.totalStaticBytes += bytes.length;
  if (file.endsWith('.js')) result.javascriptGzipBytes += gzipSync(bytes, { level: 9 }).length;
  if (file.endsWith('.css')) result.cssGzipBytes += gzipSync(bytes, { level: 9 }).length;
}
const limits = { javascriptGzipBytes: 55_000, cssGzipBytes: 25_000, totalStaticBytes: 3_500_000 };
await mkdir('docs', { recursive: true });
await writeFile('docs/bundle-budget.json', JSON.stringify({ result, limits }, null, 2) + '\n');
for (const [key, limit] of Object.entries(limits))
  assert.ok(result[key] <= limit, `${key}: ${result[key]} > ${limit}`);
console.log('Bundle budgets PASSED', result);
