import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function filesIn(root, ignore = () => false) {
  const result = [];
  async function walk(relative) {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const name = path.posix.join(relative, entry.name);
      if (ignore(name, entry)) continue;
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) result.push(name);
    }
  }
  await walk('');
  return result.sort();
}

export async function artifactHash(root) {
  const hash = createHash('sha256');
  for (const name of await filesIn(root))
    hash
      .update(name)
      .update('\0')
      .update(await readFile(path.join(root, name)))
      .update('\0');
  return hash.digest('hex');
}
