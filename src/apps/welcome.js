import { $, $$, asset, escapeHTML, icon, glyph } from '../utils.js';

export function openWelcome(ctx) {
  const { wm, ui, settings, fs, launch } = ctx;
  const win = wm.create('welcome', {
    title: 'Centro de bienvenida',
    icon: 'control',
    width: 790,
    height: 562,
    minWidth: 550,
    minHeight: 390,
    className: 'welcome-app',
  });
  if (!win) return;
  const tasks = [
    ['computer', 'Ver los detalles del equipo', 'system'],
    ['user', 'Transferir archivos y configuraciones', 'import'],
    ['network', 'Conectarse a Internet', 'network'],
    ['colors', 'Personalizar Windows', 'personalize'],
    ['users', 'Agregar nuevos usuarios', 'user'],
    ['help', 'Qué hay de nuevo en Windows Vista', 'help'],
  ];
  win.body.innerHTML = `<div class="navigation-bar welcome-navigation"><button class="nav-circle" disabled aria-label="Atrás">${glyph('back', 17)}</button><button class="nav-circle" disabled aria-label="Adelante">${glyph('forward', 17)}</button><div class="breadcrumb">${icon('control', '', 16)}<span>Centro de bienvenida</span><span class="crumb-arrow">▸</span></div><label class="shell-search"><input aria-label="Buscar en Inicio" placeholder="Buscar">${glyph('search', 14)}</label></div>
    <div class="welcome-scroll"><div class="welcome-hero"><div class="welcome-brand"><img src="${asset('flag.svg')}" width="78" height="72" alt=""><div><h1>Windows Vista<span>™</span></h1><div class="welcome-edition">Ultimate</div></div></div><div class="welcome-system"><div><strong>Tu equipo. Tus posibilidades.</strong><p>Un lugar para descubrir, crear y conectar.</p><dl><dt>Equipo:</dt><dd>PC de ${escapeHTML(settings.get('userName'))}</dd><dt>Entorno:</dt><dd>Escritorio web · Windows Aero</dd></dl><button class="link-button" data-action="system">Ver los detalles del equipo</button></div>${icon('computer', 'welcome-computer', 82)}</div></div>
    <section class="welcome-section"><div class="section-heading"><h2>Introducción a Windows</h2><span>6 elementos</span></div><div class="welcome-tasks">${tasks.map(([img, label, action]) => `<button class="welcome-tile" data-action="${action}">${icon(img, '', 35)}<span>${label}</span></button>`).join('')}</div></section>
    <section class="welcome-section welcome-discover"><div class="section-heading"><h2>Descubra Windows Vista</h2><button class="link-button" data-action="help">Más información</button></div><div class="welcome-features"><button data-action="explore"><span class="feature-picture explore-picture">${icon('documents', '', 38)}</span><span><strong>Todo en su sitio</strong><small>Encuentre sus archivos fácilmente.</small></span></button><button data-action="photos"><span class="feature-picture photo-picture">${icon('pictures', '', 38)}</span><span><strong>Sus mejores recuerdos</strong><small>Vea y disfrute sus fotografías.</small></span></button><button data-action="security"><span class="feature-picture security-picture">${icon('security', '', 37)}</span><span><strong>Explore con tranquilidad</strong><small>Conozca este entorno web.</small></span></button></div></section></div>
    <footer class="welcome-footer"><label><input type="checkbox" ${settings.get('welcome') ? 'checked' : ''}> Ejecutar al iniciar</label><span>Recreación web independiente</span></footer>`;
  const actions = {
    system: () => launch('settings', { page: 'system' }),
    import: async () => {
      const file = await ui.openTextFile();
      if (!file) return;
      try {
        fs.create('documents', fs.uniqueName('documents', file.name), 'text', file.content);
        ui.balloon('Transferencia completada', `${file.name} se ha añadido a Documentos.`);
      } catch (error) {
        ui.alert(error.message);
      }
    },
    network: () => ctx.shell.showNetwork(),
    personalize: () => launch('settings'),
    user: () => launch('settings', { page: 'user' }),
    help: () => launch('browser', { url: 'vista://ayuda' }),
    explore: () => launch('explorer', { path: 'documents' }),
    photos: () => launch('photos'),
    security: () => launch('settings', { page: 'security' }),
  };
  $$('[data-action]', win.body).forEach(
    (button) => (button.onclick = () => actions[button.dataset.action]?.()),
  );
  $('input[type=checkbox]', win.body).onchange = (event) =>
    settings.set('welcome', event.target.checked);
  $('.shell-search input', win.body).onkeydown = (event) => {
    if (event.key === 'Enter') ctx.shell.searchStart(event.target.value);
  };
  return win;
}
