import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { artifactHash } from './artifact.mjs';

const json = async (name) => JSON.parse(await readFile(name, 'utf8'));
const [e2e, perf, bundle, audit, pkg] = await Promise.all([
  json('docs/e2e-results.json'),
  json('docs/performance-results.json'),
  json('docs/bundle-budget.json'),
  json('docs/npm-audit.json'),
  json('package.json'),
]);
const xml = await readFile('docs/unit-results.xml', 'utf8');
const count = (pattern) => [...xml.matchAll(pattern)].length;
const summary = (name) =>
  Number([...xml.matchAll(/<!-- (\w+) (\d+) -->/g)].find((match) => match[1] === name)?.[2] || 0);
const unit = {
  tests: count(/<testcase\b/g),
  failures: count(/<failure\b/g),
  errors: count(/<error\b/g),
  skipped: Math.max(count(/<skipped\b/g), summary('skipped') + summary('todo')),
  cancelled: summary('cancelled'),
};
const checks = {
  unit:
    unit.tests > 0 &&
    unit.failures === 0 &&
    unit.errors === 0 &&
    unit.skipped === 0 &&
    unit.cancelled === 0,
  e2e:
    e2e.stats.expected > 0 &&
    e2e.stats.unexpected === 0 &&
    e2e.stats.skipped === 0 &&
    e2e.stats.flaky === 0,
  performance: perf.status === 'PASS' && Object.values(perf.checks).every(Boolean),
  bundle: Object.entries(bundle.limits).every(([key, limit]) => bundle.result[key] <= limit),
  audit: audit.metadata?.vulnerabilities?.total === 0,
};
const result = {
  measuredAt: new Date().toISOString(),
  status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
  checks,
  buildSha256: await artifactHash('dist'),
  unit,
  e2e: e2e.stats,
  browserProjects: e2e.config.projects.map((p) => p.name),
  performanceChecks: Object.keys(perf.checks).length,
  desktopPerformance: perf.desktopMedian.performance,
  constrainedPerformance: perf.constrained.performance,
  vulnerabilities: audit.metadata?.vulnerabilities,
  bundle: bundle.result,
  toolchain: { node: process.version, ...pkg.devDependencies },
};
await writeFile('docs/quality-results.json', JSON.stringify(result, null, 2) + '\n');
await writeFile(
  'docs/QA.md',
  `# Validación de la entrega\n\n**Resultado global: ${result.status}** · ${result.measuredAt}\n\nEstas son ejecuciones reales sobre la compilación incluida, no objetivos pendientes ni estimaciones.\n\n| Control | Resultado | Evidencia |\n|---|---:|---|\n| Pruebas unitarias | ${unit.tests - unit.failures - unit.errors}/${unit.tests} aprobadas | [unit-results.xml](unit-results.xml) |\n| Integración Chromium + Firefox | ${e2e.stats.expected} aprobadas; ${e2e.stats.unexpected} fallidas; ${e2e.stats.skipped} omitidas; ${e2e.stats.flaky} inestables | [e2e-results.json](e2e-results.json) |\n| Presupuestos de rendimiento | ${Object.values(perf.checks).filter(Boolean).length}/${Object.keys(perf.checks).length} | [performance-results.json](performance-results.json) |\n| Lighthouse escritorio, mediana de ${perf.desktopRuns.length} | ${perf.desktopMedian.performance}/100 | [Informe HTML](lighthouse-desktop.html) |\n| Lighthouse CPU 4× / 1,6 Mbit/s | ${perf.constrained.performance}/100 | [Informe HTML](lighthouse-constrained.html) |\n| JS gzip / CSS gzip | ${bundle.result.javascriptGzipBytes} / ${bundle.result.cssGzipBytes} bytes | [bundle-budget.json](bundle-budget.json) |\n| Sitio completo | ${bundle.result.totalStaticBytes} bytes | [bundle-budget.json](bundle-budget.json) |\n| npm audit, incluidas dependencias de desarrollo | ${audit.metadata.vulnerabilities.total} vulnerabilidades conocidas | [npm-audit.json](npm-audit.json) |\n\n## Cobertura de integración\n\nLa batería comprueba arranque sin errores de consola o recursos fallidos; selección y arrastre de iconos; geometría, bordes, límites y ciclo de vida de ventanas; agrupación, previsualización y desagrupación; Inicio y búsquedas; edición Unicode, guardado, descarga, recuperación y cierre cancelable; archivos, carpetas y Papelera; calculadora; navegación, pestañas y salida externa explícita; galería; personalización persistente; reloj, gadgets y bandeja; menús; dibujo y exportación PNG; Buscaminas; foco, mostrar escritorio, bloqueo; viewports y almacenamiento bloqueado. También sirve la compilación en una subruta equivalente a un repositorio Pages.\n\nSe comprueban regresiones específicas de coincidencia de nombres con acentos, rollback de una cuota fallida, repetición de igual de la calculadora, delegación de enlaces del navegador, guardado con Enter y cancelación de un cierre desde el administrador.\n\n## Huella de la compilación probada\n\nSHA-256 del árbol compilado, con rutas y contenidos en orden:\n\n\`${result.buildSha256}\`\n\nEl empaquetador exige esta huella antes de copiar la compilación a \`site/\` y crear los ZIP. Para reproducir todos los controles, instale los navegadores y ejecute \`npm run check\`. El comando reutiliza un preview disponible o inicia uno temporal y lo cierra al acabar.\n\n## Entorno y límites de las conclusiones\n\nNode ${process.version}; Vite ${pkg.devDependencies.vite}; Playwright ${pkg.devDependencies['@playwright/test']}; Lighthouse ${pkg.devDependencies.lighthouse}. Chromium ${perf.interaction.browser}; proyectos Playwright: ${result.browserProjects.join(', ')}. Sandbox Linux compartido, zona horaria de tests Europe/Madrid.\n\nLos datos son de laboratorio. No son métricas de campo ni una garantía en todos los dispositivos. No se han probado manualmente todas las combinaciones de acciones, Safari o todos los sistemas operativos; tampoco certifican identidad píxel a píxel con Vista, conformidad WCAG completa, ausencia absoluta de fugas ni permisos de propiedad intelectual. Consulte [LIMITATIONS.md](LIMITATIONS.md) y [PERFORMANCE.md](PERFORMANCE.md).\n`,
);
console.log('Quality gates:', result.status, checks, {
  unit: unit.tests,
  e2e: e2e.stats.expected,
  build: result.buildSha256,
});
assert.ok(
  Object.values(checks).every(Boolean),
  'Quality validation failed; see docs/quality-results.json.',
);
