import { $, $$, escapeHTML, asset, icon, glyph, uid, normalize, download } from '../utils.js';

const HELP = `<div class="help-page"><div class="web-kicker">AYUDA Y SOPORTE TÉCNICO</div><h1>Bienvenido a Windows Vista</h1><p class="web-intro">Las cosas de siempre. Una nueva manera de disfrutarlas.</p><h2>El escritorio</h2><p>Haz doble clic en un icono para abrirlo. Arrastra una ventana por su barra de título y cambia su tamaño desde los bordes. Los tres botones de la esquina superior derecha minimizan, maximizan o cierran la ventana. Haz doble clic en el título para maximizarla.</p><h2 id="archivos">Tus archivos, a mano</h2><p>En <a href="vista://app/explorer">Equipo</a> puedes explorar las unidades virtuales, crear carpetas, importar documentos, cambiar sus nombres y enviarlos a la Papelera. Los elementos de la Papelera se pueden restaurar. Las capacidades de los discos son ilustrativas.</p><h2 id="notas">Escribe algo que merezca la pena</h2><p>Abre el <a href="vista://app/notepad">Bloc de notas</a>, escribe y pulsa Ctrl+S. Tus documentos se guardan en este navegador. Para llevarlos contigo, usa Archivo → Descargar archivo .txt. Los borradores sin guardar se recuperan al volver a abrir el escritorio (hasta 10).</p><h2>Hazlo tuyo</h2><p>En <a href="vista://app/settings">Personalización</a> puedes cambiar el fondo, el color del cristal, la transparencia y los gadgets. Las preferencias se recuerdan en el dispositivo.</p><h2>Atajos de teclado</h2><table class="help-shortcuts"><tr><td>Ctrl + Esc</td><td>Abrir Inicio</td></tr><tr><td>Ctrl + Alt + D</td><td>Mostrar / restaurar escritorio</td></tr><tr><td>Alt + &#96;</td><td>Cambiar de ventana</td></tr><tr><td>Alt + F4</td><td>Cerrar la ventana activa, si el navegador lo permite</td></tr><tr><td>F2 / Supr</td><td>Cambiar nombre / enviar a la Papelera</td></tr><tr><td>Ctrl + S</td><td>Guardar documento</td></tr><tr><td>Ctrl + L / Ctrl + T</td><td>Dirección / nueva pestaña en Internet Explorer</td></tr></table><h2>Qué es esta experiencia</h2><p>Es una recreación web independiente, no una copia ejecutable de Windows ni un emulador de su kernel. No ejecuta archivos .exe ni accede al sistema de archivos real. Internet Explorer muestra páginas locales; los sitios externos se abren en una pestaña real para respetar sus restricciones de seguridad.</p><p>Los datos se almacenan mediante localStorage y no se envían a un servidor. El almacenamiento privado, las cuotas o borrar los datos del sitio pueden eliminar tus archivos. Conserva una copia descargada de lo importante. Los gadgets no descargan información de Internet ni ejecutan gadgets originales de terceros.</p><p>El reloj usa la hora y zona horaria de tu dispositivo. Algunos atajos de Windows pertenecen al sistema anfitrión y no se pueden interceptar desde una web. Los efectos Aero dependen de las capacidades del navegador y la GPU.</p><hr><p class="web-fineprint">Windows, Windows Vista, Internet Explorer y sus elementos gráficos son marcas o recursos de Microsoft. Proyecto de recreación no afiliado a Microsoft.</p></div>`;

export function openBrowser(ctx, data = {}) {
  const { wm, ui, fs, storage } = ctx;
  const win = wm.create('browser', {
    title: 'Internet Explorer',
    icon: 'internet',
    width: 875,
    height: 592,
    minWidth: 480,
    minHeight: 330,
    className: 'browser-app',
  });
  if (!win) return;
  let tabs = [],
    activeId,
    zoom = 100;
  win.body.innerHTML = `<div class="navigation-bar browser-navigation"><button class="nav-circle ie-back" title="Atrás" aria-label="Atrás">${glyph('back', 18)}</button><button class="nav-circle ie-forward" title="Adelante" aria-label="Adelante">${glyph('forward', 18)}</button><form class="browser-address-form"><span class="address-icon">${icon('internet', '', 16)}</span><input class="browser-address" aria-label="Dirección web" spellcheck="false" autocomplete="off"><button type="button" class="ie-refresh" aria-label="Actualizar" title="Actualizar">${glyph('refresh', 14)}</button><button type="submit" class="ie-go" title="Ir" aria-label="Ir">${glyph('forward', 14)}</button></form><form class="browser-search-form"><input aria-label="Búsqueda en el escritorio" placeholder="Buscar" autocomplete="off"><button type="submit" aria-label="Buscar">${glyph('search', 15)}</button></form></div>
    <div class="ie-command-row"><button class="ie-favorites" title="Favoritos" aria-label="Favoritos">${icon('favorites', '', 22)}</button><div class="browser-tabs" role="tablist" aria-label="Pestañas"></div><button class="ie-new-tab" title="Nueva pestaña (Ctrl+T)" aria-label="Nueva pestaña">${glyph('plus', 13)}</button><div class="ie-commands"><button class="ie-home" aria-label="Inicio" title="Página principal">${glyph('home', 17)}</button><button class="ie-page">Página ▾</button><button class="ie-tools">Herramientas ▾</button><button class="ie-help" title="Ayuda" aria-label="Ayuda">${icon('help', '', 16)}</button></div></div><div class="browser-document selectable" tabindex="0"></div><footer class="app-status"><span>${icon('internet', '', 14)} <span class="ie-state">Listo</span></span><span class="status-spacer"></span><span>Contenido local · Entorno simulado</span><button class="ie-zoom" title="Cambiar zoom">100% ▾</button></footer>`;
  const address = $('.browser-address', win.body),
    doc = $('.browser-document', win.body);
  const active = () => tabs.find((t) => t.id === activeId);
  function addTab(url = 'vista://inicio') {
    const tab = { id: uid(), history: [], index: -1, title: 'Nueva pestaña' };
    tabs.push(tab);
    activeId = tab.id;
    navigate(url);
  }
  function closeTab(id) {
    if (tabs.length === 1) {
      win.close();
      return;
    }
    const index = tabs.findIndex((t) => t.id === id);
    tabs.splice(index, 1);
    if (activeId === id) activeId = tabs[Math.min(index, tabs.length - 1)].id;
    renderPage();
  }
  function cleanURL(raw) {
    let value = String(raw || 'vista://inicio').trim();
    if (/^vista:\/\//i.test(value))
      return value.replace(/^vista:\/\/[^?#]*/i, (path) => path.toLowerCase());
    if (value === 'about:blank') return 'vista://nueva';
    if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:/i.test(value))
      throw new Error('Esta dirección no está permitida. Utiliza http:// o https://.');
    if (!/^https?:\/\//i.test(value)) {
      if (!value.includes('.') || /\s/.test(value))
        return `vista://buscar?q=${encodeURIComponent(value)}`;
      value = `https://${value}`;
    }
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Dirección no válida.');
    return parsed.href;
  }
  function navigate(raw, add = true) {
    let url;
    try {
      url = cleanURL(raw);
    } catch (error) {
      ui.alert(error.message, 'Internet Explorer', 'warning');
      return;
    }
    if (url.startsWith('vista://app/')) {
      ctx.launch(url.slice('vista://app/'.length).split(/[?#]/)[0]);
      return;
    }
    const tab = active();
    if (add) {
      tab.history = tab.history.slice(0, tab.index + 1);
      tab.history.push(url);
      tab.index = tab.history.length - 1;
    }
    renderPage();
  }
  function renderTabs() {
    const bar = $('.browser-tabs', win.body);
    bar.innerHTML = tabs
      .map(
        (t) =>
          `<div class="browser-tab ${t.id === activeId ? 'selected' : ''}"><button role="tab" aria-selected="${t.id === activeId}" data-tab="${t.id}">${icon('internet', '', 15)}<span>${escapeHTML(t.title)}</span></button><button class="tab-close" data-close-tab="${t.id}" aria-label="Cerrar pestaña ${escapeHTML(t.title)}">×</button></div>`,
      )
      .join('');
    $$('[data-tab]', bar).forEach(
      (b) =>
        (b.onclick = () => {
          activeId = b.dataset.tab;
          renderPage();
        }),
    );
    $$('[data-close-tab]', bar).forEach((b) => (b.onclick = () => closeTab(b.dataset.closeTab)));
  }
  function home() {
    return `<div class="live-page"><header class="live-header"><img src="${asset('flag.svg')}" alt="" width="33" height="30"><span>Windows <strong>Live</strong></span><span class="live-tag">Lo que te importa, más cerca.</span></header><nav class="live-nav"><a href="vista://inicio" class="current">Inicio</a><a href="vista://correo">Correo</a><a href="vista://fotos">Fotografías</a><a href="vista://ayuda">Ayuda de Windows</a></nav><form class="live-search"><input aria-label="Buscar programas y archivos" placeholder="Buscar programas y archivos en este equipo"><button class="vista-button" type="submit">Buscar</button></form><div class="live-hero"><div><span class="live-hero-kicker">BIENVENIDO A WINDOWS VISTA</span><h1>Un mundo de<br>posibilidades.</h1><p>Descubre una nueva forma de disfrutar de tu equipo.</p><a href="vista://ayuda">Empieza a explorar <b>›</b></a></div><img src="${asset('wallpapers/lake.webp')}" alt="Muelle sobre un lago al atardecer"></div><div class="live-columns"><section><h2>Tu espacio personal</h2><a href="vista://app/explorer">${icon('documents', '', 25)} Documentos y carpetas</a><a href="vista://app/photos">${icon('pictures', '', 25)} Tus mejores fotografías</a><a href="vista://app/notepad">${icon('notepad', '', 25)} Una idea, una nota</a></section><section><h2>Hazlo a tu manera</h2><a href="vista://app/settings">Cambiar la apariencia de Windows</a><a href="vista://app/calculator">Hacer cuentas con la Calculadora</a><a href="vista://app/paint">Dibujar en Paint</a></section><section><h2>Conoce tu escritorio</h2><p>Ventanas transparentes, herramientas familiares y un pequeño viaje a 2007.</p><a href="vista://ayuda">Visita el centro de ayuda →</a></section></div><footer class="live-footer">Experiencia local sin conexión · Recreación independiente · <a href="vista://acerca">Acerca de este proyecto</a></footer></div>`;
  }
  function searchPage(url) {
    const query = new URL(url).searchParams.get('q') || '';
    const results = fs.search(query);
    const programs = ctx.apps.filter(
      (a) => !a.hidden && normalize(a.name + ' ' + a.keywords).includes(normalize(query)),
    );
    return `<div class="web-results"><div class="web-kicker">WINDOWS SEARCH</div><h1>Resultados para «${escapeHTML(query)}»</h1><form class="live-search"><input aria-label="Buscar" value="${escapeHTML(query)}"><button class="vista-button">Buscar</button></form><h2>Programas (${programs.length})</h2>${programs.map((a) => `<button class="web-result" data-app="${a.id}">${icon(a.icon, '', 28)}<span><strong>${escapeHTML(a.name)}</strong><small>Aplicación del escritorio</small></span></button>`).join('') || '<p>No se encontraron programas.</p>'}<h2>Archivos (${results.length})</h2>${results.map((n) => `<button class="web-result" data-file="${escapeHTML(n.id)}">${icon(n.type === 'folder' ? 'folder' : n.type === 'image' ? 'image' : 'text', '', 28)}<span><strong>${escapeHTML(n.name)}</strong><small>${escapeHTML(fs.path(n.parent))}</small></span></button>`).join('') || '<p>No se encontraron archivos.</p>'}<p class="web-fineprint">La búsqueda se realiza en el escritorio virtual, no en Internet.</p></div>`;
  }
  function mailPage(url) {
    const messages = [
      {
        subject: 'Bienvenido a tu nuevo escritorio',
        from: 'Equipo de bienvenida',
        date: 'Hoy',
        body: 'Hola:\n\nNos alegra verte por aquí. Tu escritorio ya está listo: abre Inicio para descubrir sus programas, escribe tu primera nota o elige una fotografía para el fondo.\n\nEste buzón contiene mensajes de muestra, no recibe ni envía correo real.\n\n¡Disfruta del viaje!',
      },
      {
        subject: 'Un lugar para tus ideas',
        from: 'Bloc de notas',
        date: 'Ayer',
        body: 'A veces solo hace falta una hoja en blanco.\n\nAbre el Bloc de notas, escribe y guarda tu documento. Lo encontrarás en Documentos. También puedes descargarlo como archivo de texto.',
      },
      {
        subject: 'Haz que Windows sea tuyo',
        from: 'Personalización',
        date: 'Ayer',
        body: 'Un poco de color cambia las cosas.\n\nHaz clic con el botón derecho en el escritorio y elige Personalizar para cambiar el cristal, el fondo y los gadgets.',
      },
    ];
    const index = Number(new URL(url).searchParams.get('message'));
    const show = new URL(url).searchParams.has('message');
    const m = messages[Math.max(0, Math.min(2, index || 0))];
    return `<div class="mail-demo"><header>Windows <strong>Live Mail</strong><small>Buzón de demostración · 3 mensajes</small></header><div class="mail-layout"><nav><strong>Carpetas locales</strong><a href="vista://correo">Bandeja de entrada (3)</a><span>Elementos enviados</span><span>Borradores</span></nav><section>${show ? `<a href="vista://correo">← Volver a la bandeja de entrada</a><h2>${escapeHTML(m.subject)}</h2><p class="mail-from">De: ${escapeHTML(m.from)}</p><pre>${escapeHTML(m.body)}</pre>` : `<h2>Bandeja de entrada</h2>${messages.map((m, i) => `<a class="mail-message" href="vista://correo?message=${i}">${icon('mail', '', 25)}<span><strong>${escapeHTML(m.subject)}</strong><small>${escapeHTML(m.from)}</small></span><time>${m.date}</time></a>`).join('')}`}</section></div></div>`;
  }
  function renderPage() {
    const tab = active();
    const url = tab.history[tab.index] || 'vista://inicio';
    address.value = url;
    let html, title;
    if (url.startsWith('vista://ayuda') || url.startsWith('vista://acerca')) {
      html = HELP;
      title = 'Ayuda de Windows Vista';
    } else if (url.startsWith('vista://buscar')) {
      html = searchPage(url);
      title = 'Resultados de búsqueda';
    } else if (url.startsWith('vista://correo')) {
      html = mailPage(url);
      title = 'Windows Live Mail';
    } else if (url.startsWith('vista://fotos')) {
      html = `<div class="web-results"><h1>Galería fotográfica</h1><p>Tus mejores recuerdos, en un solo lugar.</p><div class="web-photo-grid">${fs
        .list('pictures')
        .filter((n) => n.type === 'image')
        .map(
          (n) =>
            `<button data-file="${n.id}"><img src="${asset(n.asset)}" alt="${escapeHTML(n.name)}"><span>${escapeHTML(n.name)}</span></button>`,
        )
        .join('')}</div></div>`;
      title = 'Fotografías';
    } else if (url.startsWith('http')) {
      const parsed = new URL(url);
      title = parsed.hostname;
      html = `<div class="external-page">${icon('internet', '', 64)}<h1>Explorar ${escapeHTML(parsed.hostname)}</h1><p>Los sitios externos se abren en una pestaña real de tu navegador.</p><p>Así se respetan sus políticas de seguridad, inicio de sesión y navegación.</p><p class="external-url selectable">${escapeHTML(url)}</p><button class="vista-button primary" data-external="${escapeHTML(url)}">Abrir sitio web ↗</button><p class="web-fineprint">Esta ventana es una simulación de Internet Explorer, no un motor de navegación de 2007.</p><a href="vista://inicio">Volver a la página principal</a></div>`;
    } else {
      html = home();
      title = 'Windows Live';
    }
    tab.title = title;
    doc.innerHTML = html;
    doc.scrollTop = 0;
    doc.style.zoom = `${zoom}%`;
    $('.ie-back', win.body).disabled = tab.index <= 0;
    $('.ie-forward', win.body).disabled = tab.index >= tab.history.length - 1;
    $('.ie-state', win.body).textContent = 'Listo';
    win.setTitle(`${title} - Internet Explorer`);
    renderTabs();
    if (url.includes('#')) {
      const id = url.split('#')[1];
      requestAnimationFrame(() => {
        const target = [...doc.querySelectorAll('[id]')].find((el) => el.id === id);
        target?.scrollIntoView({ block: 'start' });
      });
    }
  }
  doc.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]'),
      app = event.target.closest('button[data-app]'),
      file = event.target.closest('[data-file]'),
      external = event.target.closest('[data-external]');
    if (link) {
      event.preventDefault();
      navigate(link.getAttribute('href'));
    } else if (app) ctx.launch(app.dataset.app);
    else if (file) {
      const n = fs.get(file.dataset.file);
      if (n) ctx.openFile(n);
    } else if (external) window.open(external.dataset.external, '_blank', 'noopener,noreferrer');
  });
  doc.addEventListener('submit', (event) => {
    event.preventDefault();
    if (event.target.matches('.live-search'))
      navigate(`vista://buscar?q=${encodeURIComponent($('input', event.target).value)}`);
  });
  $('.browser-address-form', win.body).onsubmit = (event) => {
    event.preventDefault();
    navigate(address.value);
  };
  $('.browser-search-form', win.body).onsubmit = (event) => {
    event.preventDefault();
    const input = $('input', event.currentTarget);
    navigate(`vista://buscar?q=${encodeURIComponent(input.value)}`);
  };
  const back = () => {
    const t = active();
    if (t.index > 0) {
      t.index--;
      renderPage();
    }
  };
  const forward = () => {
    const t = active();
    if (t.index < t.history.length - 1) {
      t.index++;
      renderPage();
    }
  };
  $('.ie-back', win.body).onclick = back;
  $('.ie-forward', win.body).onclick = forward;
  $('.ie-new-tab', win.body).onclick = () => addTab();
  $('.ie-home', win.body).onclick = () => navigate('vista://inicio');
  $('.ie-refresh', win.body).onclick = renderPage;
  $('.ie-help', win.body).onclick = () => navigate('vista://ayuda');
  $('.ie-favorites', win.body).onclick = (event) => {
    let favorites = storage.get('favorites.v1', [
      { title: 'Windows Live', url: 'vista://inicio' },
      { title: 'Ayuda de Windows Vista', url: 'vista://ayuda' },
    ]);
    if (!Array.isArray(favorites)) favorites = [];
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(
      [
        {
          label: 'Agregar a Favoritos…',
          icon: 'favorites',
          action: async () => {
            const title = await ui.prompt('Agregar a Favoritos', 'Nombre:', active().title);
            if (title) {
              favorites.push({ title, url: address.value });
              storage.set('favorites.v1', favorites.slice(-30));
            }
          },
        },
        { separator: true },
        ...favorites
          .filter((f) => typeof f.title === 'string' && typeof f.url === 'string')
          .map((f) => ({ label: f.title, icon: 'internet', action: () => navigate(f.url) })),
      ],
      r.left,
      r.bottom,
    );
  };
  const zoomMenu = () =>
    [75, 100, 125, 150].map((v) => ({
      label: `${v}%`,
      checked: zoom === v,
      action: () => {
        zoom = v;
        doc.style.zoom = `${zoom}%`;
        $('.ie-zoom', win.body).textContent = `${zoom}% ▾`;
      },
    }));
  $('.ie-zoom', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(zoomMenu(), r.left, r.top - 118);
  };
  $('.ie-page', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(
      [
        {
          label: 'Guardar página local como texto…',
          action: () => download(`${active().title}.txt`, doc.innerText),
        },
        { label: 'Zoom', submenu: zoomMenu() },
        { label: 'Nueva pestaña', shortcut: 'Ctrl+T', action: () => addTab() },
      ],
      r.left,
      r.bottom,
    );
  };
  $('.ie-tools', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(
      [
        { label: 'Pantalla completa de la ventana', action: () => wm.toggleMaximize(win.id) },
        {
          label: 'Opciones de Internet',
          action: () =>
            ui.alert(
              'Página principal: vista://inicio\nEste navegador muestra páginas locales. Las direcciones externas se abren en una pestaña de tu navegador real. No se envía el historial a ningún servidor.',
              'Opciones de Internet',
            ),
        },
        { label: 'Ayuda y privacidad', action: () => navigate('vista://ayuda') },
      ],
      r.left,
      r.bottom,
    );
  };
  win.onKeydown = (event) => {
    const key = event.key.toLowerCase();
    if (event.ctrlKey && key === 'l') {
      event.preventDefault();
      address.focus();
      address.select();
    } else if (event.ctrlKey && key === 't') {
      event.preventDefault();
      addTab();
    } else if (event.ctrlKey && key === 'w') {
      event.preventDefault();
      closeTab(activeId);
    } else if (event.ctrlKey && event.key === 'Tab') {
      event.preventDefault();
      const i = tabs.findIndex((t) => t.id === activeId);
      activeId = tabs[(i + (event.shiftKey ? tabs.length - 1 : 1)) % tabs.length].id;
      renderPage();
    } else if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      back();
    } else if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      forward();
    } else if (event.key === 'F5') {
      event.preventDefault();
      renderPage();
    }
  };
  addTab(data.url || 'vista://inicio');
  return win;
}
