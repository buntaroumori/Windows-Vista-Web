import { execFileSync, spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw new Error('Run this command through npm: npm run check');
const npm = (args, options = {}) =>
  execFileSync(process.execPath, [npmCLI, ...args], { stdio: 'inherit', ...options });
npm(['run', 'format:check']);
const audit = npm(['audit', '--audit-level=moderate', '--json'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await writeFile('docs/npm-audit.json', audit);
npm(['run', 'test:report']);
npm(['run', 'build']);
npm(['run', 'test:e2e']);

const url = process.env.VISTA_URL || 'http://127.0.0.1:4173/';
let server;
async function ready() {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}
try {
  if (!(await ready())) {
    if (process.env.VISTA_URL)
      throw new Error('The custom VISTA_URL server must already be running.');
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '0.0.0.0',
        '--port',
        '4173',
        '--strictPort',
      ],
      { stdio: 'inherit' },
    );
    const deadline = Date.now() + 25_000;
    while (!(await ready())) {
      if (server.exitCode !== null || Date.now() > deadline)
        throw new Error('The production preview could not be started.');
      await setTimeout(250);
    }
  }
  npm(['run', 'test:performance']);
  await import('./quality.mjs');
} finally {
  server?.kill('SIGTERM');
}
