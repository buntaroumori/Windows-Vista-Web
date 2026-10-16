# Recursos de terceros, licencias y marcas

Esta es una recreación web independiente. **No está afiliada, patrocinada, aprobada ni distribuida por Microsoft.** Windows, Windows Vista, Aero, Internet Explorer y otras denominaciones y símbolos son marcas de sus titulares. Los nombres se utilizan para identificar el sistema y las aplicaciones recreadas. No se concede ninguna licencia de marca.

## Importante antes de redistribuir o publicar

Los fondos, iconos y cursores de Windows se incluyen para la fidelidad histórica solicitada. Sus derechos no pasan a ser MIT por aparecer en este proyecto ni por estar disponibles en un repositorio o archivo público. **No se ha obtenido ni se afirma disponer de una autorización general de redistribución o explotación comercial de esos recursos propietarios.** La procedencia pública no prueba tal autorización. Revise los permisos aplicables a su uso y jurisdicción; sustituya o retire esos recursos si necesita una distribución completamente abierta o si no dispone de los permisos adecuados. Esta advertencia no constituye asesoramiento jurídico.

`LICENSE` cubre únicamente el código y la documentación originales del proyecto. Los recursos siguientes quedan expresamente fuera de esa licencia, incluso cuando aparecen en capturas o dentro de `site/`.

## 1. Fondos y fotografías de Windows Vista

- Archivo consultado: <https://frutigeraeroarchive.org/wallpapers/windows_vista>
- Originales JPEG: `https://frutigeraeroarchive.org/images/wallpapers/windows_vista/windows_vista_N.jpg`.
- Transformaciones: conversión a WebP, compresión de calidad 89, y miniaturas de hasta 320×210. No se atribuye la autoría de las fotografías al proyecto.

| Archivo incluido                   | Original archivado     |
| ---------------------------------- | ---------------------- |
| `assets/wallpapers/aurora.webp`    | `windows_vista_59.jpg` |
| `assets/wallpapers/leaf.webp`      | `windows_vista_25.jpg` |
| `assets/wallpapers/lake.webp`      | `windows_vista_6.jpg`  |
| `assets/wallpapers/night.webp`     | `windows_vista_49.jpg` |
| `assets/wallpapers/landscape.webp` | `windows_vista_3.jpg`  |
| `assets/wallpapers/mountain.webp`  | `windows_vista_60.jpg` |

Las miniaturas de `assets/thumbnails/` derivan de los mismos seis originales. Los derechos corresponden a Microsoft y/o a los autores y titulares originales de las imágenes; la página de archivo no es una licencia de esos derechos.

## 2. Iconos y cursores de Windows

- Fuente: <https://github.com/bartekl1/WindowsResources>
- Iconos: `Icons/Windows Vista/ico/imageres.dll/` y `Icons/Windows Vista/ico/shell32.dll/`.
- Cursores: `Cursors/Windows Vista/`, archivos `aero_arrow.cur`, `aero_link.cur`, `aero_ew.cur`, `aero_ns.cur`, `aero_nwse.cur` y `aero_nesw.cur`.
- Se han extraído los fotogramas de mayor profundidad de color de los ICO y exportado como PNG con variantes de 16, 24, 32, 48, 64 y 128 píxeles. Algunas variantes se redimensionan cuando no existe un fotograma nativo del tamaño requerido.
- Los iconos de Bloc de notas y Paint proceden de <https://github.com/visnalize/resources>, rutas `icons/win7/Default Programs/notepad_2.ico` y `mspaint_2.ico`. Son recursos compatibles de la época siguiente, **no una afirmación de identidad binaria con los de Vista**.

Los recursos originales son de Microsoft y/o sus titulares. El repositorio de origen no sustituye una autorización de Microsoft. Un inventario SHA-256 de los archivos incluidos se genera en `docs/assets-manifest.json` para trazabilidad, no como prueba de licencia.

## 3. Fuente Selawik

- Proyecto: <https://github.com/microsoft/Selawik>
- Versión: 1.01, archivo `Selawik_Release.zip` de la publicación oficial.
- Archivos incluidos: `assets/fonts/selawik-latin.woff2` y `selawik-bold.woff2`, variantes regular y negrita. El nombre local `latin` no significa que se haya modificado o sublicenciado la fuente.
- Licencia: **SIL Open Font License 1.1**, texto completo en `assets/fonts/OFL.txt`.
- Aviso original: Copyright 2015, Microsoft Corporation (www.microsoft.com), with Reserved Font Name Selawik. All Rights Reserved. Selawik is a trademark of Microsoft Corporation in the United States and/or other countries.

Selawik es una sustitución abierta de métricas próximas a Segoe UI. **No se distribuye Segoe UI.** Si el dispositivo del visitante ya tiene Segoe UI, el CSS puede utilizar su copia local. La rasterización puede variar entre plataformas.

## 4. SVG y código propios

`assets/orb.svg`, `flag.svg`, `avatar.svg` y `icons/calculator.svg` son dibujos vectoriales realizados para esta recreación, no extracciones de archivos de Windows. Su código fuente original se cubre con la licencia del proyecto. Las posibles similitudes con símbolos identificativos no otorgan derechos sobre las marcas subyacentes.

El reloj, los marcos, los reflejos, botones, gadgets y el resto de la interfaz se construyen con HTML, CSS, SVG y JavaScript propios. Los sonidos opcionales son tonos sintetizados con Web Audio, no grabaciones de Windows.

## 5. Herramientas de desarrollo

Vite, Playwright, Lighthouse, chrome-launcher y Prettier se usan únicamente para desarrollar, compilar o probar. Las herramientas completas no se cargan desde un CDN ni se envían al visitante. El build sí puede incluir el pequeño polyfill de `modulepreload` generado por Vite; se conserva a continuación su licencia MIT. Sus dependencias y versiones están bloqueadas en `package-lock.json`; sus licencias permanecen en los paquetes originales. El proyecto no tiene dependencias JavaScript de ejecución.

Si incorpora otros recursos, conserve sus atribuciones y licencias por separado. La auditoría de seguridad de npm y las pruebas de rendimiento no verifican ni conceden derechos de propiedad intelectual.

### Licencia de Vite para el helper generado

```text
# Vite core license
Vite is released under the MIT license:

MIT License

Copyright (c) 2019-present, VoidZero Inc. and Vite contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
