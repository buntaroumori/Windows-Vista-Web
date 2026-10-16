import { copyFile } from 'node:fs/promises';
// Keep the static distribution's rights notices identical to the source version.
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await copyFile(name, `public/${name}`);
