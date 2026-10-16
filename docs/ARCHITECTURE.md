# Arquitectura

## Aplicación estática

La aplicación se compila con Vite y se ejecuta con módulos JavaScript nativos. No se utiliza React, una API remota, un proveedor de iconos ni una librería de ventanas. Las únicas dependencias npm son herramientas de desarrollo. El resultado es una carpeta estática con rutas relativas.

`main.js` compone servicios compartidos y construye el contexto de las aplicaciones:

```js
{
  (wm, ui, settings, fs, storage, launch, openFile, apps, shell, sidebar, audio);
}
```

No se expone una API de depuración global. Los tests interactúan con el DOM, el ratón, el teclado y las descargas reales; las pruebas unitarias importan únicamente modelos puros.

## Separación de responsabilidades

- `window-manager.js` administra geometría, foco, orden, estado y ciclo de vida; no conoce la lógica de cada aplicación.
- `app-registry.js` decide qué constructor ejecutar, restaura aplicaciones singleton y evita abrir varias instancias del mismo documento guardado.
- `shell.js` implementa escritorio, Inicio, accesos rápidos, barra de tareas, previsualizaciones, bandeja y estados de sesión.
- `sidebar.js` administra gadgets y suscripciones al reloj compartido.
- `ui.js` centraliza menús y submenús con teclado, diálogos, confirmaciones, prompts, notificaciones e importación.
- `store.js` encapsula fallos de almacenamiento y sanea preferencias; `filesystem.js` implementa transacciones sobre el árbol virtual.
- `calculator-model.js` y `minesweeper-model.js` separan la lógica comprobable de la interfaz.
- `apps/` contiene las nueve aplicaciones, sin dependencias mutuas de implementación.
- `theme.css`, `shell.css` y `apps.css` separan fundamentos, escritorio y aplicaciones.

## Ventanas y rendimiento

Cada ventana mantiene un rectángulo numérico, un estado normal o maximizado y un indicador de minimización independiente. Restaurar no reconstruye la aplicación: conserva su DOM y su estado. El sistema controla el foco explícitamente y normaliza el z-index para evitar crecimiento ilimitado.

Mover o redimensionar utiliza Pointer Events con captura de puntero. Los cambios de geometría se agrupan con `requestAnimationFrame`; al terminar el gesto se confirma el último rectángulo. No se usan listeners de movimiento permanentes para cada ventana. Las ocho zonas de borde respetan el tamaño mínimo y los límites de la zona útil, descontando la barra de tareas.

El desenfoque Aero se aplica a cuatro superficies pequeñas del marco —título y bordes— y no a la gran superficie opaca de la aplicación. Esto reduce significativamente el coste de composición, especialmente en Firefox con renderizado por software. Los efectos tienen reserva visual si el navegador no soporta el desenfoque. Se respetan las preferencias de movimiento reducido.

Las imágenes del escritorio y de las carpetas se sirven en tamaños adecuados; el selector de fondos utiliza miniaturas. Los fondos completos se mantienen locales y se convierten a WebP. La tipografía de reserva se incluye como WOFF2. Los efectos de hover no descargan recursos de terceros.

## Persistencia

`SafeStorage` emplea el prefijo `vista.` y evita que `localStorage` bloqueado o JSON corrupto rompan el arranque. `Settings` valida tipos, rangos y listas de valores admitidos.

El sistema de archivos tiene un esquema versionado con nodos de carpeta, texto e imagen. Los nombres se comparan sin distinguir mayúsculas, pero conservando acentos; las búsquedas sí ignoran acentos. Las operaciones mutan dentro de una transacción con copia previa, validan límites y persisten. Si la cuota falla, restauran tanto el árbol activo como la copia de reserva en memoria. No se anuncia como guardado un cambio que no pudo persistirse.

La Papelera marca la raíz eliminada y oculta sus descendientes sin destruirlos. Restaurar resuelve colisiones de nombres; vaciar la Papelera elimina también descendientes. Los directorios de sistema están protegidos.

El Bloc de notas mantiene borradores con debounce, confirmación de cierre y recuperación al arrancar. La descarga usa Blob y URL temporal revocada. Los datos de usuario no se interpolan como HTML sin escapar.

## Limpieza y recursos

Cada ventana dispone de una colección `cleanup`. Al cerrar se cancelan suscripciones, temporizadores, observadores y operaciones de teclado pertinentes antes de retirar el DOM. Los gadgets comparten el reloj y retiran sus listeners al desaparecer. Las URL de objeto se revocan después de usarse. El estrés automatizado de 24 ventanas comprueba el número de ventanas restantes y el heap tras GC.

La captura de puntero, las listas de menús y los estados de bloqueo tienen ciclos de vida explícitos. El bloqueo vuelve inertes el escritorio y la barra de tareas, mantiene el foco en el botón de desbloqueo y no pretende ser un mecanismo de autenticación.

## Navegación y aislamiento

El navegador simulado usa páginas internas `vista://`. Solo los enlaces y botones de su documento activan sus acciones: las búsquedas delegadas están acotadas para no confundir `data-app` del contenedor de la ventana con el de un botón.

Se rechazan esquemas externos distintos de HTTP y HTTPS. Las páginas externas se presentan primero como una salida explícita del entorno local y se abren con `noopener,noreferrer`. No se utiliza un proxy, no se incrustan credenciales y no se intenta saltar CORS ni restricciones de marcos.

La CSP de producción permite scripts y fuentes del propio origen, imágenes locales/data/blob y estilos necesarios para la geometría dinámica. No permite plugins ni formularios hacia otros sitios. WebSocket solo se permite en el HTML fuente para HMR; la compilación lo retira de `connect-src`.

## Validación y entrega

- Los modelos se prueban con el test runner nativo de Node.
- Playwright ejecuta Chromium y Firefox sobre la compilación de producción.
- Lighthouse se ejecuta tres veces para escritorio y una vez con CPU/red limitadas.
- Las pruebas de interacción usan movimiento real de puntero y fotogramas de la página, no una estimación basada en el tamaño del bundle.
- `quality.mjs` genera el resumen y la huella SHA-256 del árbol compilado solo a partir de resultados reales.
- `package.mjs` vuelve a compilar y exige que esa huella coincida con la validada antes de copiar `site/` y crear ZIPs sin herramientas externas.

El workflow de Pages reproduce los controles y publica únicamente si pasan. Los JSON, HTML y XML de la entrega permiten revisar las evidencias; el inventario de recursos documenta procedencia, no concede derechos de redistribución.
