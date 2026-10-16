import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { filesIn } from './artifact.mjs';

const icons = JSON.parse(await readFile('docs/icon-sources.json', 'utf8'));
const wallpapers = { aurora: 59, leaf: 25, lake: 6, night: 49, landscape: 3, mountain: 60 };
const windows = 'https://raw.githubusercontent.com/bartekl1/WindowsResources/main/';
function provenance(name) {
  if (name.startsWith('icons/') && name.endsWith('.png')) {
    const key = name
      .slice(6)
      .replace(/-(16|24|32|48|128)\.png$/, '')
      .replace(/\.png$/, '');
    const original = icons[key];
    if (!original) throw new Error(`Missing provenance for ${name}`);
    const special = { 'notepad.ico': 'notepad_2.ico', 'paint.ico': 'mspaint_2.ico' }[original];
    const upstream = special
      ? `https://raw.githubusercontent.com/visnalize/resources/main/icons/win7/Default%20Programs/${special}`
      : windows +
        `Icons/Windows%20Vista/ico/${original.split('-')[0]}.dll/${original.slice(original.indexOf('-') + 1)}`;
    return {
      upstream,
      rights:
        'Microsoft / original rights holders; not MIT. Redistribution permission not established.',
      transformation: 'Highest-depth ICO frame, resized where required and encoded as PNG.',
    };
  }
  if (name.startsWith('wallpapers/') || name.startsWith('thumbnails/')) {
    const key = name.split('/')[1].replace('.webp', '');
    return {
      upstream: `https://frutigeraeroarchive.org/images/wallpapers/windows_vista/windows_vista_${wallpapers[key]}.jpg`,
      rights:
        'Microsoft / original photographers and rights holders; not MIT. Redistribution permission not established.',
      transformation: name.startsWith('thumbnails/')
        ? 'WebP thumbnail, maximum 320×210.'
        : 'WebP conversion.',
    };
  }
  if (name.startsWith('cursors/'))
    return {
      upstream: windows + `Cursors/Windows%20Vista/${name.slice(8)}`,
      rights:
        'Microsoft / original rights holders; not MIT. Redistribution permission not established.',
    };
  if (name.startsWith('fonts/'))
    return {
      upstream: 'https://github.com/microsoft/Selawik/releases/tag/1.01',
      rights: 'SIL Open Font License 1.1. See assets/fonts/OFL.txt.',
    };
  return {
    upstream: 'Original project source',
    rights: 'MIT for original SVG source. No trademark rights granted.',
  };
}
const assets = [];
for (const name of await filesIn('public/assets')) {
  const data = await readFile(`public/assets/${name}`);
  assets.push({
    path: `assets/${name}`,
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    ...provenance(name),
  });
}
await writeFile(
  'docs/assets-manifest.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: 'Provenance and integrity inventory, not a grant or verification of redistribution rights.',
      assets,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Asset provenance recorded: ${assets.length} files.`);
