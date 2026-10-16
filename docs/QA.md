# Validación de la entrega

**Resultado global: PASS** · 2026-10-16T17:04:07.427Z

Estas son ejecuciones reales sobre la compilación incluida, no objetivos pendientes ni estimaciones.

| Control | Resultado | Evidencia |
|---|---:|---|
| Pruebas unitarias | 55/55 aprobadas | [unit-results.xml](unit-results.xml) |
| Integración Chromium + Firefox | 66 aprobadas; 0 fallidas; 0 omitidas; 0 inestables | [e2e-results.json](e2e-results.json) |
| Presupuestos de rendimiento | 17/17 | [performance-results.json](performance-results.json) |
| Lighthouse escritorio, mediana de 3 | 100/100 | [Informe HTML](lighthouse-desktop.html) |
| Lighthouse CPU 4× / 1,6 Mbit/s | 98/100 | [Informe HTML](lighthouse-constrained.html) |
| JS gzip / CSS gzip | 50092 / 17924 bytes | [bundle-budget.json](bundle-budget.json) |
| Sitio completo | 2725412 bytes | [bundle-budget.json](bundle-budget.json) |
| npm audit, incluidas dependencias de desarrollo | 0 vulnerabilidades conocidas | [npm-audit.json](npm-audit.json) |

## Cobertura de integración

La batería comprueba arranque sin errores de consola o recursos fallidos; selección y arrastre de iconos; geometría, bordes, límites y ciclo de vida de ventanas; agrupación, previsualización y desagrupación; Inicio y búsquedas; edición Unicode, guardado, descarga, recuperación y cierre cancelable; archivos, carpetas y Papelera; calculadora; navegación, pestañas y salida externa explícita; galería; personalización persistente; reloj, gadgets y bandeja; menús; dibujo y exportación PNG; Buscaminas; foco, mostrar escritorio, bloqueo; viewports y almacenamiento bloqueado. También sirve la compilación en una subruta equivalente a un repositorio Pages.

Se comprueban regresiones específicas de coincidencia de nombres con acentos, rollback de una cuota fallida, repetición de igual de la calculadora, delegación de enlaces del navegador, guardado con Enter y cancelación de un cierre desde el administrador.

## Huella de la compilación probada

SHA-256 del árbol compilado, con rutas y contenidos en orden:

`29d16fb8c72d6c1838df771a4ea62192842eaa98a31bd462d6b9f99768a45617`

El empaquetador exige esta huella antes de copiar la compilación a `site/` y crear los ZIP. Para reproducir todos los controles, instale los navegadores y ejecute `npm run check`. El comando reutiliza un preview disponible o inicia uno temporal y lo cierra al acabar.

## Entorno y límites de las conclusiones

Node v22.22.0; Vite 8.3.4; Playwright 1.64.1; Lighthouse 13.5.0. Chromium 156.0.8078.4; proyectos Playwright: chromium, firefox. Sandbox Linux compartido, zona horaria de tests Europe/Madrid.

Los datos son de laboratorio. No son métricas de campo ni una garantía en todos los dispositivos. No se han probado manualmente todas las combinaciones de acciones, Safari o todos los sistemas operativos; tampoco certifican identidad píxel a píxel con Vista, conformidad WCAG completa, ausencia absoluta de fugas ni permisos de propiedad intelectual. Consulte [LIMITATIONS.md](LIMITATIONS.md) y [PERFORMANCE.md](PERFORMANCE.md).
