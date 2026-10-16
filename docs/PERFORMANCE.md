# Pruebas de rendimiento

**Resultado: PASS** · 2026-10-16T17:04:07.350Z

Mediciones sobre la compilación de producción, no sobre el servidor de desarrollo.

## Lighthouse

| Métrica | Escritorio (mediana de 3) | Perfil limitado |
|---|---:|---:|
| Rendimiento | 100/100 | 98/100 |
| FCP | 333.95 ms | 1240.46 ms |
| LCP | 455.85 ms | 1980.46 ms |
| TBT | 11.5 ms | 122.5 ms |
| CLS | 0 | 0 |
| Transferencia inicial | 311 KiB | 311 KiB |
| Accesibilidad | 100/100 | 96/100 |
| Buenas prácticas | 100/100 | 100/100 |

- Escritorio: 1440×900, simulated 40 ms RTT / 10 Mbit/s / CPU 1×.
- Limitado: 390×844, simulated 150 ms RTT / 1.6 Mbit/s / CPU 4×.
- Lighthouse 13.5.0; Chromium 156.0.8078.4.

## Interacción y ciclo de vida

- Arrastre Aero real con captura de puntero: **59.46 FPS medios**, p95 16.8 ms, 110 fotogramas.
- Tareas de más de 50 ms durante la muestra: 0.
- Apertura de Bloc de notas: mediana 8.4 ms; peor muestra 16.4 ms. Incluye espera al siguiente fotograma, 5 muestras.
- Estrés: 24 ventanas abiertas y cerradas; quedan 1, la inicial.
- Diferencia de heap tras GC: 43 KiB. Es una prueba acotada de regresión, no una demostración de ausencia total de fugas.
- Errores en consola: 0. Solicitudes a orígenes externos: 0.

## Presupuestos

Se comprueban automáticamente puntuación, FCP, LCP, TBT, CLS, transferencia, fluidez, tiempo de apertura y memoria retenida. Los límites y cada resultado están en [performance-results.json](performance-results.json). La compilación comprueba además JS gzip ≤55 kB, CSS gzip ≤25 kB y sitio completo ≤3,5 MB.

## Reproducir

```bash
npm ci
npx playwright install --with-deps chromium firefox
npm run build
npm run preview
# En otra terminal:
npm run test:performance
```

Los informes Lighthouse completos se incluyen como HTML y JSON. Las mediciones son sintéticas y se han tomado en un sandbox Linux compartido. No equivalen a Core Web Vitals de usuarios reales, a una auditoría WCAG ni a una garantía de 60 FPS en cualquier dispositivo. El arrastre se mide sin limitación artificial de CPU y con una ventana Aero visible.
