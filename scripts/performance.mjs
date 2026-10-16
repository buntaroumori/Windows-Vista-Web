import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import lighthouse from 'lighthouse';
import { launch as launchChrome } from 'chrome-launcher';
import { chromium } from '@playwright/test';

const url = process.env.VISTA_URL || 'http://127.0.0.1:4173/';
const runCount = Math.max(1, Math.min(5, Number(process.env.PERF_RUNS) || 3));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value) => Math.round(value * 100) / 100;
await mkdir('docs', { recursive: true });

async function audit(profile, index) {
  const chrome = await launchChrome({
    chromePath: chromium.executablePath(),
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
    ],
  });
  try {
    const mobile = profile === 'constrained';
    const result = await lighthouse(url, {
      port: chrome.port,
      logLevel: 'error',
      output: ['html', 'json'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: mobile ? 'mobile' : 'desktop',
      screenEmulation: {
        mobile,
        width: mobile ? 390 : 1440,
        height: mobile ? 844 : 900,
        deviceScaleFactor: 1,
        disabled: false,
      },
      throttlingMethod: 'simulate',
      throttling: {
        rttMs: mobile ? 150 : 40,
        throughputKbps: mobile ? 1600 : 10240,
        cpuSlowdownMultiplier: mobile ? 4 : 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
    });
    assert.ok(result?.lhr && !result.lhr.runtimeError, JSON.stringify(result?.lhr?.runtimeError));
    const { lhr } = result;
    await writeFile(`docs/lighthouse-${profile}-${index}.json`, JSON.stringify(lhr, null, 2));
    if (index === 1) await writeFile(`docs/lighthouse-${profile}.html`, result.report[0]);
    const record = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
      fcpMs: round(lhr.audits['first-contentful-paint'].numericValue),
      lcpMs: round(lhr.audits['largest-contentful-paint'].numericValue),
      tbtMs: round(lhr.audits['total-blocking-time'].numericValue),
      cls: round(lhr.audits['cumulative-layout-shift'].numericValue),
      speedIndexMs: round(lhr.audits['speed-index'].numericValue),
      totalTransferBytes: lhr.audits['total-byte-weight'].numericValue,
      javascriptBootMs: round(lhr.audits['bootup-time'].numericValue),
      lighthouseVersion: lhr.lighthouseVersion,
    };
    console.log(`${profile} run ${index}`, record);
    return record;
  } finally {
    await chrome.kill();
  }
}

const desktopRuns = [];
for (let i = 1; i <= runCount; i++) desktopRuns.push(await audit('desktop', i));
const constrained = await audit('constrained', 1);
const desktop = Object.fromEntries(
  Object.keys(desktopRuns[0])
    .filter((k) => typeof desktopRuns[0][k] === 'number')
    .map((key) => [key, median(desktopRuns.map((r) => r[key]))]),
);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let interaction;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  const errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().startsWith('http') && new URL(r.url()).origin !== new URL(url).origin)
      external.push(r.url());
  });
  await page.addInitScript(() => {
    window.__perfLongTasks = [];
    new PerformanceObserver((list) =>
      list
        .getEntries()
        .forEach((e) => window.__perfLongTasks.push({ start: e.startTime, duration: e.duration })),
    ).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  const title = await page.locator('.welcome-app .titlebar').boundingBox();
  assert.ok(title, 'Welcome Center must be enabled in a clean profile.');
  await page.mouse.move(title.x + 200, title.y + 15);
  await page.mouse.down();
  const capture = page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [],
          start = performance.now();
        let last;
        function frame(now) {
          if (last !== undefined) deltas.push(now - last);
          last = now;
          if (deltas.length < 110) requestAnimationFrame(frame);
          else resolve({ deltas, start, end: now });
        }
        requestAnimationFrame(frame);
      }),
  );
  for (let i = 0; i < 105; i++) {
    await page.mouse.move(
      title.x + 200 + Math.sin(i / 13) * 118,
      title.y + 15 + Math.sin(i / 23) * 42,
    );
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await page.mouse.up();
  const frames = await capture;
  const sorted = [...frames.deltas].sort((a, b) => a - b),
    average = frames.deltas.reduce((a, b) => a + b, 0) / frames.deltas.length;
  const longTasks = await page.evaluate(
    ({ start, end }) => window.__perfLongTasks.filter((t) => t.start >= start && t.start <= end),
    frames,
  );
  const openTimes = [];
  for (let i = 0; i < 5; i++) {
    openTimes.push(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const start = performance.now();
            document
              .querySelector('[data-desktop-id="notepad-shortcut"]')
              .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            requestAnimationFrame(() => resolve(performance.now() - start));
          }),
      ),
    );
    await page.locator('.notepad-app .caption-button.close').last().click();
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  await page.evaluate(() => {
    for (let i = 0; i < 24; i++)
      document
        .querySelector('[data-desktop-id="notepad-shortcut"]')
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll('.notepad-app').length === 24);
  await page.evaluate(() =>
    document.querySelectorAll('.notepad-app .caption-button.close').forEach((b) => b.click()),
  );
  await page.waitForFunction(() => document.querySelectorAll('.aero-window').length === 1);
  await cdp.send('HeapProfiler.collectGarbage');
  const heapAfter = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  interaction = {
    dragFrames: frames.deltas.length,
    dragAverageFps: round(1000 / average),
    dragP95FrameMs: round(sorted[Math.floor(sorted.length * 0.95)]),
    dragLongTasks: longTasks.length,
    dragLongestTaskMs: round(Math.max(0, ...longTasks.map((t) => t.duration))),
    appOpenMedianMs: round(median(openTimes)),
    appOpenWorstMs: round(Math.max(...openTimes)),
    stressWindowsOpenedAndClosed: 24,
    windowsAfterStress: await page.locator('.aero-window').count(),
    heapBeforeBytes: heapBefore,
    heapAfterBytes: heapAfter,
    retainedHeapDeltaBytes: heapAfter - heapBefore,
    consoleErrors: errors,
    externalRequests: external,
    browser: browser.version(),
  };
  console.log('Interaction and lifecycle', interaction);
  await page.screenshot({ path: 'docs/performance-desktop.png' });
} finally {
  await browser.close();
}

const budgets = {
  desktop: {
    minimumScore: 90,
    maximumLcpMs: 2000,
    maximumFcpMs: 1200,
    maximumTbtMs: 200,
    maximumCls: 0.02,
    maximumTransferBytes: 650_000,
  },
  constrained: { minimumScore: 85, maximumLcpMs: 3500, maximumTbtMs: 350, maximumCls: 0.05 },
  interaction: {
    minimumAverageFps: 45,
    maximumP95FrameMs: 50,
    maximumOpenMs: 150,
    maximumRetainedHeapBytes: 12_000_000,
  },
};
const checks = {
  desktopScore: desktop.performance >= budgets.desktop.minimumScore,
  desktopLcp: desktop.lcpMs <= budgets.desktop.maximumLcpMs,
  desktopFcp: desktop.fcpMs <= budgets.desktop.maximumFcpMs,
  desktopTbt: desktop.tbtMs <= budgets.desktop.maximumTbtMs,
  desktopCls: desktop.cls <= budgets.desktop.maximumCls,
  desktopTransfer: desktop.totalTransferBytes <= budgets.desktop.maximumTransferBytes,
  constrainedScore: constrained.performance >= budgets.constrained.minimumScore,
  constrainedLcp: constrained.lcpMs <= budgets.constrained.maximumLcpMs,
  constrainedTbt: constrained.tbtMs <= budgets.constrained.maximumTbtMs,
  constrainedCls: constrained.cls <= budgets.constrained.maximumCls,
  dragFps: interaction.dragAverageFps >= budgets.interaction.minimumAverageFps,
  dragP95: interaction.dragP95FrameMs <= budgets.interaction.maximumP95FrameMs,
  applicationOpen: interaction.appOpenWorstMs <= budgets.interaction.maximumOpenMs,
  retainedHeap: interaction.retainedHeapDeltaBytes <= budgets.interaction.maximumRetainedHeapBytes,
  lifecycle: interaction.windowsAfterStress === 1,
  cleanConsole: interaction.consoleErrors.length === 0,
  noExternalRequests: interaction.externalRequests.length === 0,
};
const result = {
  measuredAt: new Date().toISOString(),
  url,
  status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
  environment: {
    os: `${os.platform()} ${os.arch()}`,
    node: process.version,
    cpu: os.cpus()[0]?.model,
    cpuCountReported: os.cpus().length,
    note: 'Shared Linux sandbox. Synthetic lab measurements, not field data or a guarantee for all clients.',
  },
  profiles: {
    desktop: '1440×900, simulated 40 ms RTT / 10 Mbit/s / CPU 1×',
    constrained: '390×844, simulated 150 ms RTT / 1.6 Mbit/s / CPU 4×',
  },
  desktopRuns,
  desktopMedian: desktop,
  constrained,
  interaction,
  budgets,
  checks,
};
await writeFile('docs/performance-results.json', JSON.stringify(result, null, 2) + '\n');
await writeFile(
  'docs/PERFORMANCE.md',
  `# Pruebas de rendimiento\n\n**Resultado: ${result.status}** · ${result.measuredAt}\n\nMediciones sobre la compilación de producción, no sobre el servidor de desarrollo.\n\n## Lighthouse\n\n| Métrica | Escritorio (mediana de ${runCount}) | Perfil limitado |\n|---|---:|---:|\n| Rendimiento | ${desktop.performance}/100 | ${constrained.performance}/100 |\n| FCP | ${desktop.fcpMs} ms | ${constrained.fcpMs} ms |\n| LCP | ${desktop.lcpMs} ms | ${constrained.lcpMs} ms |\n| TBT | ${desktop.tbtMs} ms | ${constrained.tbtMs} ms |\n| CLS | ${desktop.cls} | ${constrained.cls} |\n| Transferencia inicial | ${Math.round(desktop.totalTransferBytes / 1024)} KiB | ${Math.round(constrained.totalTransferBytes / 1024)} KiB |\n| Accesibilidad | ${desktop.accessibility}/100 | ${constrained.accessibility}/100 |\n| Buenas prácticas | ${desktop.bestPractices}/100 | ${constrained.bestPractices}/100 |\n\n- Escritorio: ${result.profiles.desktop}.\n- Limitado: ${result.profiles.constrained}.\n- Lighthouse ${desktopRuns[0].lighthouseVersion}; Chromium ${interaction.browser}.\n\n## Interacción y ciclo de vida\n\n- Arrastre Aero real con captura de puntero: **${interaction.dragAverageFps} FPS medios**, p95 ${interaction.dragP95FrameMs} ms, ${interaction.dragFrames} fotogramas.\n- Tareas de más de 50 ms durante la muestra: ${interaction.dragLongTasks}.\n- Apertura de Bloc de notas: mediana ${interaction.appOpenMedianMs} ms; peor muestra ${interaction.appOpenWorstMs} ms. Incluye espera al siguiente fotograma, 5 muestras.\n- Estrés: ${interaction.stressWindowsOpenedAndClosed} ventanas abiertas y cerradas; quedan ${interaction.windowsAfterStress}, la inicial.\n- Diferencia de heap tras GC: ${Math.round(interaction.retainedHeapDeltaBytes / 1024)} KiB. Es una prueba acotada de regresión, no una demostración de ausencia total de fugas.\n- Errores en consola: ${interaction.consoleErrors.length}. Solicitudes a orígenes externos: ${interaction.externalRequests.length}.\n\n## Presupuestos\n\nSe comprueban automáticamente puntuación, FCP, LCP, TBT, CLS, transferencia, fluidez, tiempo de apertura y memoria retenida. Los límites y cada resultado están en [performance-results.json](performance-results.json). La compilación comprueba además JS gzip ≤55 kB, CSS gzip ≤25 kB y sitio completo ≤3,5 MB.\n\n## Reproducir\n\n\`\`\`bash\nnpm ci\nnpx playwright install --with-deps chromium firefox\nnpm run build\nnpm run preview\n# En otra terminal:\nnpm run test:performance\n\`\`\`\n\nLos informes Lighthouse completos se incluyen como HTML y JSON. Las mediciones son sintéticas y se han tomado en un sandbox Linux compartido. No equivalen a Core Web Vitals de usuarios reales, a una auditoría WCAG ni a una garantía de 60 FPS en cualquier dispositivo. El arrastre se mide sin limitación artificial de CPU y con una ventana Aero visible.\n`,
);
console.log(`\nPerformance gates: ${result.status}`, checks);
assert.ok(
  Object.values(checks).every(Boolean),
  'Performance budget failed; see docs/performance-results.json.',
);
