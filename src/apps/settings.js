import { $, $$, escapeHTML, asset, icon, glyph } from '../utils.js';

const COLORS = [
  ['Escarcha', '#b8d6db'],
  ['Hielo', '#85b9c9'],
  ['Cielo', '#6caadd'],
  ['Mar', '#4c77b4'],
  ['Hoja', '#6caa77'],
  ['Lima', '#bec976'],
  ['Arena', '#d2b380'],
  ['Naranja', '#cc916a'],
  ['Rojo', '#b87475'],
  ['Rosa', '#c48eac'],
  ['Violeta', '#a296c2'],
  ['Grafito', '#6e7c82'],
];
const WALLPAPERS = [
  ['aurora', 'Windows Vista'],
  ['leaf', 'Hoja'],
  ['lake', 'Muelle al atardecer'],
  ['night', 'Aurora boreal'],
  ['landscape', 'Un nuevo día'],
  ['mountain', 'Lago de montaña'],
];
export function openSettings(ctx, data = {}) {
  const { wm, ui, settings, fs } = ctx;
  const win = wm.create('settings', {
    title: 'Personalización',
    icon: 'control',
    width: 775,
    height: 565,
    minWidth: 490,
    minHeight: 360,
    className: 'settings-app',
  });
  if (!win) return;
  let page = data.page || 'personalize';
  win.body.innerHTML = `<div class="navigation-bar"><button class="nav-circle settings-back" aria-label="Atrás">${glyph('back', 17)}</button><div class="breadcrumb">${icon('control', '', 16)}<button class="settings-root">Panel de control</button><span class="crumb-arrow">▸</span><span class="settings-crumb"></span></div></div><div class="control-layout"><nav class="control-sidebar"><button data-page="personalize">Ventana principal del Panel de control</button><h4>Vea también</h4><button data-page="wallpaper">Fondo de escritorio</button><button data-page="color">Color de las ventanas</button><button data-page="user">Cuentas de usuario</button><button data-page="system">Sistema</button><button data-page="security">Centro de seguridad</button><button data-page="programs">Programas</button></nav><div class="control-content"></div></div><footer class="app-status">${icon('control', '', 16)}<span>Panel de control · Entorno local</span></footer>`;
  const content = $('.control-content', win.body);
  const preview = (wallpaper = settings.get('wallpaper'), color = settings.get('accent')) =>
    `<div class="settings-preview" style="background-image:url('${asset(`wallpapers/${wallpaper}.webp`)}')"><div class="mini-aero" style="background:${color}b0"><span>Windows Aero</span><div>Una nueva perspectiva.</div></div><div class="mini-taskbar"><img src="${asset('orb.svg')}" alt=""></div></div>`;
  function show(next) {
    page = next;
    const title =
      {
        personalize: 'Personalización',
        color: 'Color y apariencia de las ventanas',
        wallpaper: 'Fondo de escritorio',
        user: 'Cuentas de usuario',
        system: 'Sistema',
        security: 'Centro de seguridad de Windows',
        programs: 'Programas predeterminados',
      }[page] || 'Personalización';
    win.setTitle(title);
    $('.settings-crumb', win.body).textContent = title;
    $$('[data-page]', win.body).forEach((b) =>
      b.classList.toggle('selected', b.dataset.page === page),
    );
    if (page === 'color') renderColor();
    else if (page === 'wallpaper') renderWallpaper();
    else if (page === 'system') renderSystem();
    else if (page === 'user') renderUser();
    else if (page === 'security') renderSecurity();
    else if (page === 'programs') renderPrograms();
    else renderPersonalize();
    content.scrollTop = 0;
  }
  function renderPersonalize() {
    content.innerHTML = `<h1>Personalice la apariencia y los sonidos</h1><p>Haga que su equipo sea una expresión de su estilo.</p>${preview()}<div class="personalization-options">${[
      [
        'colors',
        'Color y apariencia de las ventanas',
        'Cambiar el color del cristal, la transparencia y la intensidad.',
        'color',
      ],
      ['pictures', 'Fondo de escritorio', 'Decorar el escritorio con una imagen.', 'wallpaper'],
      [
        'user',
        'Imagen y nombre de la cuenta',
        'Cambiar el nombre que aparece en el menú Inicio.',
        'user',
      ],
    ]
      .map(
        ([img, label, detail, key]) =>
          `<button class="control-option" data-goto="${key}">${icon(img, '', 40)}<span><strong>${label}</strong><small>${detail}</small></span></button>`,
      )
      .join(
        '',
      )}</div><div class="control-options-checks"><label><input type="checkbox" data-setting="sidebar" ${settings.get('sidebar') ? 'checked' : ''}> Mostrar Windows Sidebar</label><label><input type="checkbox" data-setting="sound" ${settings.get('sound') ? 'checked' : ''}> Reproducir sonidos de la interfaz</label><label><input type="checkbox" data-setting="reducedMotion" ${settings.get('reducedMotion') ? 'checked' : ''}> Reducir las animaciones</label></div><p><button class="link-button gadget-gallery">Agregar gadgets a Sidebar</button></p>`;
    $$('[data-goto]', content).forEach((b) => (b.onclick = () => show(b.dataset.goto)));
    $$('[data-setting]', content).forEach(
      (input) => (input.onchange = () => settings.set(input.dataset.setting, input.checked)),
    );
    $('.gadget-gallery', content).onclick = () => ctx.sidebar.addGallery();
  }
  function renderColor() {
    let color = settings.get('accent');
    content.innerHTML = `<h1>Cambie el color del cristal de las ventanas</h1><p>Haga clic en un color para ver una vista previa.</p><div class="color-swatches">${COLORS.map(([name, value]) => `<button class="color-swatch ${value === color ? 'selected' : ''}" data-color="${value}" title="${name}" aria-label="${name}" aria-pressed="${value === color}" style="--swatch:${value}"><i></i></button>`).join('')}</div><div class="color-preview-wrap">${preview()}</div><label class="field-row"><input class="color-transparency" type="checkbox" ${settings.get('transparency') ? 'checked' : ''}>Habilitar transparencia</label><label class="field-row">Intensidad del color: <input class="color-intensity" aria-label="Intensidad del color" type="range" min="25" max="95" value="${settings.get('glassOpacity')}"></label><div class="field-row"><label>Color personalizado: <input class="color-custom" aria-label="Color personalizado" type="color" value="${color}"></label></div><div class="control-form-buttons"><button class="vista-button primary color-save">Aceptar</button><button class="vista-button color-cancel">Cancelar</button></div>`;
    const update = () => {
      $('.mini-aero', content).style.background =
        color +
        Math.round((Number($('.color-intensity', content).value) / 100) * 255)
          .toString(16)
          .padStart(2, '0');
    };
    $$('.color-swatch', content).forEach(
      (b) =>
        (b.onclick = () => {
          color = b.dataset.color;
          $$('.color-swatch', content).forEach((x) => {
            x.classList.toggle('selected', x === b);
            x.setAttribute('aria-pressed', String(x === b));
          });
          $('.color-custom', content).value = color;
          update();
        }),
    );
    $('.color-custom', content).oninput = (event) => {
      color = event.target.value;
      update();
    };
    $('.color-intensity', content).oninput = update;
    $('.color-transparency', content).onchange = update;
    $('.color-save', content).onclick = () => {
      settings.set('accent', color);
      settings.set('transparency', $('.color-transparency', content).checked);
      settings.set('glassOpacity', Number($('.color-intensity', content).value));
      show('personalize');
    };
    $('.color-cancel', content).onclick = () => show('personalize');
  }
  function renderWallpaper() {
    let wallpaper = settings.get('wallpaper');
    content.innerHTML = `<h1>Elija el fondo de escritorio</h1><p>Fondos de Windows Vista</p><div class="wallpaper-choices">${WALLPAPERS.map(([id, label]) => `<label class="wallpaper-choice ${id === wallpaper ? 'selected' : ''}"><img src="${asset(`thumbnails/${id}.webp`)}" alt="${label}" loading="lazy"><span><input type="radio" name="wallpaper" value="${id}" ${id === wallpaper ? 'checked' : ''}>${label}</span></label>`).join('')}</div><p class="control-note">Posición de imagen: rellenar la pantalla manteniendo la proporción.</p><div class="control-form-buttons"><button class="vista-button primary wallpaper-save">Aceptar</button><button class="vista-button wallpaper-cancel">Cancelar</button></div>`;
    $$('input[name=wallpaper]', content).forEach(
      (input) =>
        (input.onchange = () => {
          wallpaper = input.value;
          $$('.wallpaper-choice', content).forEach((label) =>
            label.classList.toggle('selected', $('input', label).checked),
          );
        }),
    );
    $('.wallpaper-save', content).onclick = () => {
      settings.set('wallpaper', wallpaper);
      show('personalize');
    };
    $('.wallpaper-cancel', content).onclick = () => show('personalize');
  }
  function renderUser() {
    content.innerHTML = `<h1>Realizar cambios en la cuenta de usuario</h1><div class="account-heading"><img src="${asset('avatar.svg')}" width="80" height="80" alt="Imagen de la cuenta: una flor"><div><h2>${escapeHTML(settings.get('userName'))}</h2><p>Cuenta local de demostración</p><small>Sin contraseña · No autentica en el sistema real</small></div></div><label class="field-label">Nuevo nombre de la cuenta:<input name="userName" class="vista-input account-name" value="${escapeHTML(settings.get('userName'))}" maxlength="40" autocomplete="off"></label><button class="vista-button primary account-save">Cambiar el nombre</button><h2>Opciones de la sesión</h2><p>Puede bloquear este escritorio sin cerrar las aplicaciones abiertas.</p><button class="link-button account-lock">Bloquear el escritorio</button>`;
    $('.account-save', content).onclick = () => {
      const value = $('.account-name', content).value.trim();
      if (!value) return;
      settings.set('userName', value);
      renderUser();
    };
    $('.account-lock', content).onclick = () => ctx.shell.lock();
  }
  function renderSystem() {
    content.innerHTML = `<h1>Ver información básica acerca del equipo</h1><div class="system-edition"><div><h2>Edición de Windows</h2><h3>Windows Vista™ Ultimate</h3><p>Recreación web de la interfaz Aero</p></div><img src="${asset('flag.svg')}" width="80" height="76" alt=""></div><h2>Sistema</h2><dl class="system-properties"><dt>Tipo de sistema</dt><dd>Aplicación web estática · JavaScript ES2022</dd><dt>Equipo</dt><dd>VISTA-PC</dd><dt>Nombre de usuario</dt><dd>${escapeHTML(settings.get('userName'))}</dd><dt>Procesador y memoria</dt><dd>No se emulan dispositivos físicos</dd><dt>Almacenamiento</dt><dd>localStorage · ${fs.nodes.length} elementos virtuales</dd><dt>Red</dt><dd>${navigator.onLine ? 'Navegador con conexión de red' : 'Navegador sin conexión de red'}</dd></dl><h2>Acerca de esta edición</h2><p>Esta experiencia no instala Windows, no ejecuta programas de Windows y no necesita una clave de producto.</p><p>El reloj y las preferencias usan los recursos del navegador. Consulte la ayuda para conocer las diferencias con el sistema original.</p><button class="link-button system-help">Más información sobre este escritorio</button><div class="system-footer">Windows Vista y Windows Aero son marcas de Microsoft. Proyecto no afiliado a Microsoft.</div>`;
    $('.system-help', content).onclick = () => ctx.launch('browser', { url: 'vista://ayuda' });
  }
  function renderSecurity() {
    content.innerHTML = `<h1>Centro de seguridad de Windows</h1><div class="security-banner">${icon('security', '', 48)}<div><strong>Un entorno local y transparente</strong><p>Sus documentos no se envían a un servidor.</p></div></div>${[
      [
        'Almacenamiento de archivos',
        'En este navegador',
        'Los archivos y borradores se guardan en localStorage. Borrar los datos del sitio también elimina esos archivos.',
      ],
      [
        'Conexiones de la aplicación',
        'Recursos locales',
        'No hay analítica, publicidad, cuentas en la nube ni bibliotecas remotas en tiempo de ejecución.',
      ],
      [
        'Firewall y antivirus',
        'No se emulan',
        'Este proyecto no protege ni modifica el sistema operativo anfitrión.',
      ],
      [
        'Navegación web',
        'En el navegador real',
        'Los enlaces externos se abren mediante una acción explícita en otra pestaña.',
      ],
    ]
      .map(
        ([title, state, detail]) =>
          `<details class="security-detail"><summary><strong>${title}</strong><span>${state}</span></summary><p>${detail}</p></details>`,
      )
      .join(
        '',
      )}<p class="control-note">Descargue una copia de los documentos importantes. Esta simulación no sustituye las herramientas de seguridad del dispositivo.</p>`;
  }
  function renderPrograms() {
    content.innerHTML = `<h1>Programas del escritorio</h1><p>Elija una aplicación para abrirla.</p><div class="programs-list">${ctx.apps
      .filter((a) => !a.hidden)
      .map(
        (a) =>
          `<button class="control-option" data-app="${a.id}">${icon(a.icon, '', 32)}<span><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.description)}</small></span></button>`,
      )
      .join('')}</div>`;
    $$('[data-app]', content).forEach((b) => (b.onclick = () => ctx.launch(b.dataset.app)));
  }
  $$('[data-page]', win.body).forEach((b) => (b.onclick = () => show(b.dataset.page)));
  $('.settings-back', win.body).onclick = () => show('personalize');
  $('.settings-root', win.body).onclick = () => show('personalize');
  win.navigate = (next) => show(next || 'personalize');
  show(page);
  return win;
}
