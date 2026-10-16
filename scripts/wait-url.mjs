// CI-only readiness check for the temporary preview server, with a bounded timeout.
import { setTimeout } from 'node:timers/promises';
const url = process.env.VISTA_URL || 'http://127.0.0.1:4173/';
const deadline = Date.now() + 25_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* The server may still be starting. */
  }
  await setTimeout(250);
}
if (!ready) throw new Error(`Preview did not become ready: ${url}`);
console.log(`Preview ready: ${url}`);
