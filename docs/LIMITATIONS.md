# Alcance y límites intencionados

## Recreación, no sistema operativo

El proyecto recrea la experiencia visual y las interacciones principales de Windows Vista en una página web. No ejecuta Windows, su kernel, binarios `.exe`, servicios, controladores, ActiveX ni programas originales. El Panel de control contiene ajustes reales de esta web e información ilustrativa; no todos los paneles del Vista auténtico están implementados.

- Equipo, unidades, capacidades, puntuación de experiencia, hardware y usuarios son representaciones, no datos del ordenador del visitante.
- Apagar, reiniciar y bloquear son estados visuales de la aplicación. No actúan sobre el ordenador, no autentican a nadie y no constituyen una protección de seguridad.
- El administrador de tareas administra solo las ventanas de esta aplicación. El volumen controla sus tonos opcionales, no el volumen del sistema.
- La red muestra `navigator.onLine`: no comprueba la conectividad efectiva a Internet ni permite configurar Wi-Fi.
- El idioma de entrada abre una explicación; no cambia el teclado del sistema operativo.
- La unidad DVD es informativa; no accede a soportes físicos.

## Fidelidad visual

Se ha elegido el escritorio Aero de Vista, no un diseño modernizado de Windows 7/10/11. Hay bordes translúcidos, un botón Inicio circular, Sidebar separada y botones de tareas con texto. No hay Aero Snap ni Superbar.

No se ofrece una certificación de coincidencia literal píxel a píxel. La composición DWM del sistema original no está disponible en CSS. Las sombras, los reflejos, la interpolación de animaciones, los textos, los gadgets, algunas pantallas y varios detalles son aproximaciones. Los iconos de Bloc de notas y Paint proceden de un archivo de Windows 7 y la fuente abierta de reserva es Selawik, no una copia redistribuida de Segoe UI. Las diferencias de fuente, escala del dispositivo y rasterización también cambian los píxeles.

El cristal se aplica únicamente a las zonas de marco no opacas de las ventanas. Evita el coste de desenfocar inútilmente toda la superficie de cada aplicación. Si no existe `backdrop-filter`, se conserva un marco translúcido de reserva, no un desenfoque idéntico.

## Navegador y seguridad

El Internet Explorer recreado tiene páginas locales y navegación funcional dentro de ellas. **No es un proxy ni un navegador capaz de incrustar arbitrariamente cualquier web.** Los sitios externos se abren mediante un clic explícito en una pestaña real del navegador, con `noopener,noreferrer`. Esto respeta CSP, CORS, restricciones de marcos y aislamiento del navegador. Algunos navegadores pueden bloquear ventanas emergentes.

El portapapeles, impresión y descargas dependen de permisos y políticas del navegador. No se intenta eludirlos. En páginas no seguras algunas operaciones de portapapeles pueden no estar disponibles; la app muestra un mensaje y puede utilizarse el atajo nativo en el área de texto.

Alt+Tab, Ctrl+Alt+Supr, la tecla Windows y Alt+F4 pueden ser interceptados por el sistema o el navegador. Se incluyen alternativas que la página sí suele recibir. La simulación de bloqueo no cifra ni protege los datos locales. No introduzca secretos ni use el sitio como un entorno seguro.

## Archivos y almacenamiento

Todo el sistema de archivos es local y virtual, basado en `localStorage`. No hay sincronización entre dispositivos, autenticación, acceso al disco ni garantía de persistencia. Exportar un documento sí descarga un archivo real. El archivo importado se lee solo después de una selección o un arrastre explícito.

La importación de texto tiene un límite de 1 MB; la edición un máximo de un millón de caracteres UTF-16 y el almacenamiento total un límite conservador aproximado de 2,5 MB serializados, con 350 nodos. La cuota real del navegador puede ser menor. Los errores de cuota cancelan la transacción y dejan el estado anterior.

Paint admite imágenes de hasta 10 MB, con un lienzo de 800×480 y diez estados de deshacer. El dibujo se exporta como PNG y no se conserva como un archivo binario dentro del sistema de archivos virtual. La edición de texto mantiene hasta diez borradores, sujetos a la cuota. La importación de texto utiliza UTF-8: no se incluye un selector de codificaciones antiguas como Windows-1252.

## Plataforma y dispositivos

El objetivo principal es un navegador de escritorio actual con ratón o trackpad. Hay captura de puntero, zonas de redimensión, diseño de emergencia y pruebas a 390 px de ancho, pero **no se convierte Vista en una interfaz móvil moderna**. El tamaño compacto de algunos textos y controles es intencionado. Un dispositivo táctil no ofrece necesariamente la misma precisión o todos los gestos.

Se han automatizado Chromium y Firefox en Linux. No se declara certificación en Safari, navegadores antiguos ni todas las combinaciones de sistema, GPU, DPI o tecnologías de asistencia. El sitio no tiene un service worker: utiliza los recursos locales del servidor y la caché HTTP normal, no garantiza arranque sin conexión después de cerrar el navegador.

## Rendimiento y pruebas

Los resultados incluidos se han obtenido sobre la compilación final en un sandbox Linux compartido. Lighthouse aplica perfiles sintéticos. El arrastre usa una ventana visible y no CPU artificialmente limitada. La prueba de memoria abre y cierra un número acotado de ventanas y compara el heap tras GC; no demuestra matemáticamente la ausencia de todas las fugas posibles. Las puntuaciones no son datos de campo, auditorías WCAG completas ni una garantía de rendimiento en cualquier dispositivo.

Consulte `QA.md`, `PERFORMANCE.md` y los JSON originales para el alcance medido. Se han ejecutado las pruebas; no se afirma que toda combinación de acciones imaginable esté cubierta.

## Derechos de los recursos

Los iconos, cursores, fondos y marcas de Microsoft mantienen los derechos de sus titulares. La licencia del código no relicencia esos recursos. No se afirma autorización general para redistribución o uso comercial. Consulte `THIRD_PARTY_NOTICES.md` antes de publicar o sustituya los recursos si necesita una distribución totalmente abierta.
