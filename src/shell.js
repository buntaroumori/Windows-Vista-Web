import {
  $,
  $$,
  escapeHTML,
  icon,
  glyph,
  asset,
  normalize,
  clamp,
  isTyping,
  announce,
} from './utils.js';
import { fileIcon } from './filesystem.js';
import { clockSVG, updateClocks } from './sidebar.js';

const BASE_ICONS = [
  { id: 'user-home', label: 'Usuario', icon: 'user', app: 'explorer', data: { path: 'home' } },
  {
    id: 'computer',
    label: 'Equipo',
    icon: 'computer',
    app: 'explorer',
    data: { path: 'computer' },
  },
  { id: 'network', label: 'Red', icon: 'network', app: 'explorer', data: { path: 'network' } },
  {
    id: 'recycle',
    label: 'Papelera de reciclaje',
    icon: 'recycle-empty',
    app: 'explorer',
    data: { path: 'recycle' },
  },
  {
    id: 'internet-shortcut',
    label: 'Internet Explorer',
    icon: 'internet',
    app: 'browser',
    shortcut: true,
  },
  {
    id: 'notepad-shortcut',
    label: 'Bloc de notas',
    icon: 'notepad',
    app: 'notepad',
    shortcut: true,
  },
];

export class Shell {
  constructor(ctx) {
    this.ctx = ctx;
    this.wm = ctx.wm;
    this.ui = ctx.ui;
    this.settings = ctx.settings;
    this.fs = ctx.fs;
    this.desktop = $('#desktop');
    this.iconRoot = $('#desktop-icons');
    this.start = $('#start-menu');
    this.startButton = $('#start-button');
    this.tasks = $('#tasks');
    this.tray = $('#system-tray');
    this.selected = new Set();
    this.startOpen = false;
    this.startAll = false;
    this.startQuery = '';
    this.previewTimer = null;
    const positions = ctx.storage.get('desktop-positions.v1', {});
    this.positions =
      positions && typeof positions === 'object' && !Array.isArray(positions) ? positions : {};
    this.sortMode = 'default';
    this.renderDesktop();
    this.renderQuickLaunch();
    this.renderTray();
    this.renderTasks();
    this.startButton.onclick = () => (this.startOpen ? this.hideStart() : this.openStart());
    ctx.wm.subscribe(() => {
      this.renderTasks();
      this.hidePreview();
    });
    ctx.fs.subscribe(() => {
      this.renderDesktop();
      if (this.startOpen && this.startQuery) this.renderStartResults();
    });
    ctx.settings.subscribe((key) => {
      if (['userName', 'iconSize'].includes(key)) this.renderDesktop();
      if (['showClock', 'groupTasks'].includes(key)) {
        this.renderTray();
        this.renderTasks();
      }
      if (key === 'volume') this.updateVolume();
    });
    this.desktop.addEventListener('contextmenu', (event) => {
      if (event.target.closest('.aero-window, .sidebar, .desktop-icon')) return;
      event.preventDefault();
      this.hideStart();
      this.ui.showMenu(this.desktopMenu(), event.clientX, event.clientY);
    });
    this.desktop.addEventListener('pointerdown', (event) => this.beginSelection(event));
    $('#taskbar').addEventListener('contextmenu', (event) => {
      if (event.target.closest('.task-button')) return;
      event.preventDefault();
      this.ui.showMenu(this.taskbarMenu(), event.clientX, event.clientY);
    });
    document.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('#start-menu, #start-button')) this.hideStart();
      if (!event.target.closest('.tray-flyout, .system-tray')) this.closeFlyout();
      if (!event.target.closest('.task-button, .task-preview')) this.hidePreview();
    });
    document.addEventListener('keydown', (event) => this.globalKeys(event));
    window.addEventListener('resize', () => {
      this.closeFlyout();
      this.hideStart();
      this.renderDesktop();
      this.hidePreview();
    });
    window.addEventListener('online', () => this.updateNetwork());
    window.addEventListener('offline', () => this.updateNetwork());
    this.tick(new Date());
  }
  renderDesktop() {
    const size = this.settings.get('iconSize'),
      spacing = size === 'large' ? 108 : size === 'small' ? 67 : 88;
    this.desktopIcons = BASE_ICONS.map((i) => ({
      ...i,
      label: i.id === 'user-home' ? this.settings.get('userName') : i.label,
      icon: i.id === 'recycle' && this.fs.list('recycle').length ? 'recycle-full' : i.icon,
    })).concat(
      this.fs
        .list('desktop')
        .map((node) => ({ id: node.id, label: node.name, icon: fileIcon(node), node })),
    );
    if (this.sortMode === 'name')
      this.desktopIcons.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    else if (this.sortMode === 'type')
      this.desktopIcons.sort((a, b) => a.icon.localeCompare(b.icon));
    const rows = Math.max(1, Math.floor((this.desktop.clientHeight - 20) / spacing)),
      maxWidth = this.desktop.clientWidth;
    this.iconRoot.className = `desktop-icons icons-${size}`;
    this.iconRoot.innerHTML = this.desktopIcons
      .map((item, i) => {
        const saved = this.positions[item.id],
          position =
            saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
              ? {
                  x: clamp(saved.x, 0, maxWidth - 82),
                  y: clamp(saved.y, 0, this.desktop.clientHeight - 62),
                }
              : { x: 10 + Math.floor(i / rows) * 90, y: 12 + (i % rows) * spacing };
        item.position = position;
        return `<button class="desktop-icon ${this.selected.has(item.id) ? 'selected' : ''}" data-desktop-id="${escapeHTML(item.id)}" style="transform:translate(${position.x}px,${position.y}px)" aria-label="${escapeHTML(item.label)}" aria-pressed="${this.selected.has(item.id)}" title="${escapeHTML(item.label)}"><span class="desktop-icon-picture">${icon(item.icon, '', size === 'large' ? 56 : size === 'small' ? 32 : 48)}${item.shortcut ? '<span class="shortcut-arrow">↗</span>' : ''}</span><span class="desktop-icon-label">${escapeHTML(item.label)}</span></button>`;
      })
      .join('');
    $$('.desktop-icon', this.iconRoot).forEach((button) => {
      const item = this.desktopIcons.find((i) => i.id === button.dataset.desktopId);
      button.onclick = (event) => {
        if (this.suppressClick) return;
        if (event.ctrlKey || event.metaKey) {
          if (this.selected.has(item.id)) this.selected.delete(item.id);
          else this.selected.add(item.id);
        } else this.selected = new Set([item.id]);
        this.updateDesktopSelection();
      };
      button.ondblclick = (event) => {
        event.preventDefault();
        if (!this.suppressClick) this.openDesktopItem(item);
      };
      button.oncontextmenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.selected = new Set([item.id]);
        this.updateDesktopSelection();
        this.ui.showMenu(this.iconMenu(item), event.clientX, event.clientY);
      };
      button.onpointerdown = (event) => this.beginIconDrag(event, item, button);
      button.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.openDesktopItem(item);
        } else if (event.key.startsWith('Arrow')) {
          event.preventDefault();
          const index = this.desktopIcons.indexOf(item),
            offset =
              event.key === 'ArrowDown'
                ? 1
                : event.key === 'ArrowUp'
                  ? -1
                  : event.key === 'ArrowRight'
                    ? rows
                    : -rows;
          const next = this.desktopIcons[clamp(index + offset, 0, this.desktopIcons.length - 1)];
          this.selected = new Set([next.id]);
          this.updateDesktopSelection();
          $$('.desktop-icon', this.iconRoot)
            .find((el) => el.dataset.desktopId === next.id)
            ?.focus();
        } else if (event.key === 'F2' && item.node) {
          event.preventDefault();
          this.renameDesktop(item);
        } else if (event.key === 'Delete' && item.node) {
          event.preventDefault();
          this.deleteDesktop();
        }
      };
    });
  }
  updateDesktopSelection() {
    $$('.desktop-icon', this.iconRoot).forEach((el) => {
      const selected = this.selected.has(el.dataset.desktopId);
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-pressed', String(selected));
    });
  }
  openDesktopItem(item) {
    if (item.node) this.ctx.openFile(item.node);
    else this.ctx.launch(item.app, item.data || {});
  }
  beginIconDrag(event, item, button) {
    if (event.button !== 0) return;
    const startX = event.clientX,
      startY = event.clientY,
      originals = new Map();
    let moved = false;
    if (!this.selected.has(item.id)) {
      this.selected = new Set([item.id]);
      this.updateDesktopSelection();
    }
    this.desktopIcons
      .filter((i) => this.selected.has(i.id))
      .forEach((i) => originals.set(i.id, { ...i.position }));
    button.setPointerCapture(event.pointerId);
    const move = (e) => {
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      this.suppressClick = true;
      originals.forEach((pos, id) => {
        const current = this.desktopIcons.find((i) => i.id === id);
        current.position = {
          x: clamp(pos.x + dx, 0, this.desktop.clientWidth - 82),
          y: clamp(pos.y + dy, 0, this.desktop.clientHeight - 64),
        };
        const el = $$('.desktop-icon', this.iconRoot).find((b) => b.dataset.desktopId === id);
        if (el) {
          el.style.transform = `translate(${current.position.x}px,${current.position.y}px)`;
          el.classList.add('dragging');
        }
      });
    };
    const end = () => {
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', end);
      button.removeEventListener('pointercancel', end);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (moved) {
        originals.forEach((_, id) => {
          this.positions[id] = this.desktopIcons.find((i) => i.id === id).position;
        });
        this.ctx.storage.set('desktop-positions.v1', this.positions);
        $$('.dragging', this.iconRoot).forEach((el) => el.classList.remove('dragging'));
      }
      setTimeout(() => {
        this.suppressClick = false;
      }, 50);
    };
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
  }
  beginSelection(event) {
    if (event.button !== 0 || event.target.closest('.aero-window, .sidebar, .desktop-icon')) return;
    this.hideStart();
    this.ui.closeMenus();
    if (!event.ctrlKey) this.selected.clear();
    this.updateDesktopSelection();
    this.desktop.focus();
    const startX = event.clientX,
      startY = event.clientY,
      box = $('#selection-box'),
      before = new Set(this.selected);
    this.desktop.setPointerCapture(event.pointerId);
    const move = (e) => {
      const x = Math.min(startX, e.clientX),
        y = Math.min(startY, e.clientY),
        width = Math.abs(e.clientX - startX),
        height = Math.abs(e.clientY - startY);
      if (width + height < 4) return;
      box.hidden = false;
      Object.assign(box.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
      this.selected = new Set(before);
      this.desktopIcons.forEach((item) => {
        const p = item.position;
        if (p.x + 78 > x && p.x < x + width && p.y + 74 > y && p.y < y + height)
          this.selected.add(item.id);
      });
      this.updateDesktopSelection();
    };
    const end = () => {
      box.hidden = true;
      this.desktop.removeEventListener('pointermove', move);
      this.desktop.removeEventListener('pointerup', end);
      this.desktop.removeEventListener('pointercancel', end);
      if (this.desktop.hasPointerCapture(event.pointerId))
        this.desktop.releasePointerCapture(event.pointerId);
    };
    this.desktop.addEventListener('pointermove', move);
    this.desktop.addEventListener('pointerup', end);
    this.desktop.addEventListener('pointercancel', end);
  }
  desktopMenu() {
    return [
      {
        label: 'Ver',
        submenu: [
          ['large', 'Iconos grandes'],
          ['medium', 'Iconos medianos'],
          ['small', 'Iconos pequeños'],
        ].map(([value, label]) => ({
          label,
          checked: this.settings.get('iconSize') === value,
          action: () => {
            this.positions = {};
            this.ctx.storage.set('desktop-positions.v1', {});
            this.settings.set('iconSize', value);
          },
        })),
      },
      {
        label: 'Ordenar por',
        submenu: [
          ['name', 'Nombre'],
          ['type', 'Tipo de elemento'],
        ].map(([value, label]) => ({
          label,
          checked: this.sortMode === value,
          action: () => {
            this.sortMode = value;
            this.positions = {};
            this.ctx.storage.set('desktop-positions.v1', {});
            this.renderDesktop();
          },
        })),
      },
      { label: 'Actualizar', action: () => this.renderDesktop() },
      { separator: true },
      { label: 'Pegar', disabled: true },
      { separator: true },
      {
        label: 'Nuevo',
        submenu: [
          { label: 'Carpeta', icon: 'folder', action: () => this.newDesktopItem('folder') },
          { label: 'Documento de texto', icon: 'text', action: () => this.newDesktopItem('text') },
        ],
      },
      {
        label: 'Windows Sidebar',
        icon: 'calendar',
        checked: this.settings.get('sidebar'),
        action: () => this.settings.set('sidebar', !this.settings.get('sidebar')),
      },
      { separator: true },
      { label: 'Personalizar', icon: 'colors', action: () => this.ctx.launch('settings') },
    ];
  }
  iconMenu(item) {
    const items = [{ label: 'Abrir', bold: true, action: () => this.openDesktopItem(item) }];
    if (item.id === 'recycle')
      items.push({
        label: 'Vaciar la Papelera de reciclaje',
        disabled: !this.fs.list('recycle').length,
        action: async () => {
          if (
            await this.ui.confirm(
              '¿Desea eliminar permanentemente todos los elementos de la Papelera de reciclaje?',
            )
          )
            this.fs.emptyTrash();
        },
      });
    if (item.node)
      items.push(
        { separator: true },
        { label: 'Cambiar nombre', shortcut: 'F2', action: () => this.renameDesktop(item) },
        { label: 'Eliminar', shortcut: 'Supr', action: () => this.deleteDesktop() },
      );
    items.push(
      { separator: true },
      {
        label: 'Propiedades',
        action: () =>
          item.id === 'computer'
            ? this.ctx.launch('settings', { page: 'system' })
            : this.ui.dialog({
                title: `Propiedades de ${item.label}`,
                icon: item.icon,
                body: `<p><strong>${escapeHTML(item.label)}</strong></p><p>${item.node ? `Ubicación: Escritorio<br>Tipo: ${item.node.type === 'folder' ? 'Carpeta de archivos' : 'Documento'}` : item.shortcut ? 'Acceso directo a una aplicación del escritorio virtual.' : 'Carpeta del sistema del escritorio virtual.'}</p>`,
              }),
      },
    );
    return items;
  }
  async newDesktopItem(type) {
    const name = await this.ui.prompt(
      type === 'folder' ? 'Nueva carpeta' : 'Nuevo documento de texto',
      'Nombre:',
      this.fs.uniqueName('desktop', type === 'folder' ? 'Nueva carpeta' : 'Nuevo documento.txt'),
    );
    if (name) {
      try {
        const node = this.fs.create('desktop', name, type);
        this.selected = new Set([node.id]);
        this.updateDesktopSelection();
      } catch (error) {
        this.ui.alert(error.message);
      }
    }
  }
  async renameDesktop(item) {
    const name = await this.ui.prompt('Cambiar nombre', 'Nombre:', item.label);
    if (name && item.node) {
      try {
        this.fs.rename(item.id, name);
      } catch (error) {
        this.ui.alert(error.message);
      }
    }
  }
  async deleteDesktop() {
    const items = this.desktopIcons.filter((i) => i.node && this.selected.has(i.id));
    if (!items.length) return;
    if (
      await this.ui.confirm(
        `¿Desea mover ${items.length === 1 ? `«${items[0].label}»` : 'los elementos seleccionados'} a la Papelera de reciclaje?`,
      )
    ) {
      try {
        items.forEach((i) => this.fs.trash(i.id));
        this.selected.clear();
      } catch (error) {
        this.ui.alert(error.message);
      }
    }
  }
  renderQuickLaunch() {
    $('#quick-launch').innerHTML =
      `<button data-quick="desktop" title="Mostrar escritorio (Ctrl+Alt+D)" aria-label="Mostrar escritorio">${icon('desktop', '', 20)}</button><button data-quick="switch" title="Cambiar entre ventanas (Alt+&#96;)" aria-label="Cambiar entre ventanas">${icon('run', '', 21)}</button><button data-quick="browser" title="Iniciar Internet Explorer" aria-label="Iniciar Internet Explorer">${icon('internet', '', 21)}</button>`;
    $$('[data-quick]').forEach(
      (button) =>
        (button.onclick = () => {
          if (button.dataset.quick === 'desktop') this.wm.showDesktop();
          else if (button.dataset.quick === 'switch') this.showSwitcher();
          else this.ctx.launch('browser');
        }),
    );
  }
  openStart(query = '') {
    this.closeFlyout();
    this.hidePreview();
    this.ui.closeMenus();
    this.startOpen = true;
    this.startAll = false;
    this.startQuery = query;
    this.start.hidden = false;
    this.startButton.setAttribute('aria-expanded', 'true');
    this.startButton.classList.add('pressed');
    this.renderStart();
    const input = $('.start-search input', this.start);
    input.value = query;
    this.renderStartResults();
    input.focus();
  }
  searchStart(query) {
    this.openStart(query);
  }
  hideStart(restoreFocus = false) {
    if (!this.startOpen) return;
    this.startOpen = false;
    this.start.hidden = true;
    this.startButton.setAttribute('aria-expanded', 'false');
    this.startButton.classList.remove('pressed');
    if (restoreFocus) this.startButton.focus();
  }
  renderStart() {
    const links = [
      ['Documentos', 'documents'],
      ['Imágenes', 'pictures'],
      ['Música', 'music'],
      ['Juegos', 'games'],
      ['Elementos recientes', 'recent'],
      ['separator'],
      ['Equipo', 'computer'],
      ['Red', 'network'],
      ['Conectar a', 'connect'],
      ['separator'],
      ['Panel de control', 'control'],
      ['Programas predeterminados', 'programs'],
      ['Ayuda y soporte técnico', 'help'],
    ];
    this.start.innerHTML = `<div class="start-avatar"><img src="${asset('avatar.svg')}" width="48" height="48" alt=""></div><div class="start-left"><div class="start-pinned"><button data-start-app="browser">${icon('internet', '', 34)}<span><strong>Internet</strong><small>Internet Explorer</small></span></button><button data-start-app="mail">${icon('mail', '', 34)}<span><strong>Correo electrónico</strong><small>Windows Mail</small></span></button><div class="start-separator"></div></div><div class="start-results"></div><button class="all-programs"><span>▸</span><strong>Todos los programas</strong></button><label class="start-search"><input placeholder="Iniciar búsqueda" aria-label="Buscar programas y archivos" autocomplete="off" spellcheck="false">${glyph('search', 15)}</label></div><div class="start-right"><button class="start-user" data-start-link="home">${escapeHTML(this.settings.get('userName'))}</button><nav>${links.map(([label, key]) => (label === 'separator' ? '<div class="start-right-separator"></div>' : `<button data-start-link="${key}" title="${label}">${label}${key === 'recent' ? '<span>▸</span>' : ''}</button>`)).join('')}</nav><div class="start-power-controls"><button class="start-power" title="Apagar" aria-label="Apagar">${glyph('power', 16)}</button><button class="start-lock" title="Bloquear" aria-label="Bloquear">${glyph('lock', 16)}</button><button class="start-power-more" title="Opciones de apagado" aria-label="Opciones de apagado">▸</button></div></div>`;
    $$('[data-start-app]', this.start).forEach(
      (b) => (b.onclick = () => this.startLaunch(b.dataset.startApp)),
    );
    $$('[data-start-link]', this.start).forEach(
      (b) => (b.onclick = () => this.startLink(b.dataset.startLink, b)),
    );
    $('.all-programs', this.start).onclick = () => {
      this.startAll = !this.startAll;
      this.startQuery = '';
      $('.start-search input', this.start).value = '';
      this.renderStartResults();
    };
    const search = $('.start-search input', this.start);
    search.oninput = () => {
      this.startQuery = search.value;
      this.startAll = false;
      this.renderStartResults();
    };
    search.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        $('.start-results button:not(:disabled)', this.start)?.click();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        $('.start-results button:not(:disabled)', this.start)?.focus();
      }
    };
    this.start.onkeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.hideStart(true);
      } else if (!event.target.matches('input') && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const buttons = $$('button:not(:disabled)', this.start);
        const i = buttons.indexOf(document.activeElement);
        buttons[
          (i + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
      }
    };
    $('.start-power', this.start).onclick = () => this.shutdown();
    $('.start-lock', this.start).onclick = () => this.lock();
    $('.start-power-more', this.start).onclick = (event) => {
      const r = event.currentTarget.getBoundingClientRect();
      this.ui.showMenu(
        [
          { label: 'Cambiar de usuario', action: () => this.lock() },
          { label: 'Cerrar sesión', action: () => this.shutdown() },
          { label: 'Bloquear', action: () => this.lock() },
          { separator: true },
          { label: 'Reiniciar', action: () => this.shutdown(true) },
          { label: 'Apagar', action: () => this.shutdown() },
        ],
        r.right,
        r.bottom - 190,
      );
    };
  }
  renderStartResults() {
    const root = $('.start-results', this.start);
    if (!root) return;
    const q = normalize(this.startQuery),
      apps = this.ctx.apps.filter((a) => !a.hidden);
    $('.start-pinned', this.start).hidden = !!q || this.startAll;
    $('.all-programs', this.start).innerHTML = this.startAll
      ? '<span>◂</span><strong>Atrás</strong>'
      : '<span>▸</span><strong>Todos los programas</strong>';
    let programs,
      files = [];
    if (q) {
      programs = apps.filter((a) => normalize(a.name + ' ' + a.keywords).includes(q));
      files = this.fs.search(q).slice(0, 7);
    } else if (this.startAll)
      programs = [...apps].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else {
      let recent = this.ctx.storage.get('recent-apps.v1', []);
      if (!Array.isArray(recent)) recent = [];
      const order = [
        ...new Set([
          ...recent,
          'welcome',
          'photos',
          'explorer',
          'notepad',
          'calculator',
          'paint',
          'games',
        ]),
      ];
      programs = order
        .map((id) => apps.find((a) => a.id === id))
        .filter(Boolean)
        .slice(0, 7);
    }
    root.classList.toggle('start-search-results', !!q);
    root.classList.toggle('start-all-list', this.startAll);
    root.innerHTML = `${q ? `<h3>Programas (${programs.length})</h3>` : this.startAll ? '<h3>Todos los programas</h3>' : ''}${programs.map((a) => `<button class="start-program" data-program="${a.id}">${icon(a.icon, '', q || this.startAll ? 24 : 30)}<span>${escapeHTML(a.name)}</span></button>`).join('')}${q && files.length ? `<h3>Archivos (${files.length})</h3>${files.map((n) => `<button class="start-program" data-start-file="${escapeHTML(n.id)}">${icon(fileIcon(n), '', 23)}<span>${escapeHTML(n.name)}</span></button>`).join('')}` : ''}${q && !programs.length && !files.length ? '<p class="start-no-results">No hay elementos que coincidan con la búsqueda.</p>' : ''}`;
    $$('[data-program]', root).forEach(
      (b) => (b.onclick = () => this.startLaunch(b.dataset.program)),
    );
    $$('[data-start-file]', root).forEach(
      (b) =>
        (b.onclick = () => {
          const n = this.fs.get(b.dataset.startFile);
          this.hideStart();
          if (n) this.ctx.openFile(n);
        }),
    );
  }
  startLaunch(id) {
    this.hideStart();
    this.ctx.launch(id === 'mail' ? 'browser' : id, id === 'mail' ? { url: 'vista://correo' } : {});
  }
  startLink(key, owner) {
    if (key === 'recent') {
      const recent = this.fs.nodes
          .filter((n) => n.type !== 'folder' && !this.fs.isTrashed(n))
          .sort((a, b) => b.modified.localeCompare(a.modified))
          .slice(0, 9),
        r = owner.getBoundingClientRect();
      this.ui.showMenu(
        [
          ...recent.map((n) => ({
            label: n.name,
            icon: fileIcon(n),
            action: () => {
              this.hideStart();
              this.ctx.openFile(n);
            },
          })),
          { separator: true },
          {
            label: 'Ver todos',
            action: () => {
              this.hideStart();
              this.ctx.launch('explorer', { path: 'recent' });
            },
          },
        ],
        r.right,
        r.top,
      );
      return;
    }
    this.hideStart();
    if (['home', 'documents', 'pictures', 'music', 'computer', 'network'].includes(key))
      this.ctx.launch('explorer', { path: key });
    else if (key === 'games') this.ctx.launch('games');
    else if (key === 'connect') this.showNetwork();
    else if (key === 'control') this.ctx.launch('settings');
    else if (key === 'programs') this.ctx.launch('settings', { page: 'programs' });
    else if (key === 'help') this.ctx.launch('browser', { url: 'vista://ayuda' });
  }
  renderTasks() {
    const groups = new Map(),
      grouped = this.settings.get('groupTasks') !== false;
    this.wm.windows.forEach((win) => {
      const key = grouped ? win.appId : win.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(win);
    });
    this.tasks.innerHTML = [...groups]
      .map(([key, wins]) => {
        const first = wins[0],
          active = wins.some((w) => w.id === this.wm.activeId),
          definition = this.ctx.apps.find((a) => a.id === first.appId);
        const title =
          wins.length > 1 ? `(${wins.length}) ${definition?.name || first.title}` : first.title;
        return `<button class="task-button ${active ? 'active' : ''} ${wins.every((w) => w.minimized) ? 'minimized' : ''}" data-task-key="${key}" data-app="${first.appId}" ${wins.length === 1 ? `data-window="${first.id}"` : ''} aria-label="${escapeHTML(title)}" aria-pressed="${active}" title="${escapeHTML(title)}">${icon(first.icon, '', 16)}<span>${escapeHTML(title)}</span>${wins.length > 1 ? '<small>▴</small>' : ''}</button>`;
      })
      .join('');
    $$('.task-button', this.tasks).forEach((button) => {
      const wins = groups.get(button.dataset.taskKey);
      button.onclick = () => {
        this.hidePreview();
        clearTimeout(this.previewTimer);
        if (wins.length === 1) {
          const win = wins[0];
          if (this.wm.activeId === win.id && !win.minimized) this.wm.minimize(win.id);
          else this.wm.restore(win.id);
        } else this.groupMenu(wins, button);
      };
      button.oncontextmenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.hidePreview();
        if (wins.length === 1) this.wm.systemMenu(wins[0], event.clientX, event.clientY);
        else this.groupMenu(wins, button, event.clientX, event.clientY);
      };
      button.onpointerenter = () => {
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => this.showPreview(wins, button), 550);
      };
      button.onpointerleave = () => {
        clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
          if (!$('.task-preview:hover')) this.hidePreview();
        }, 180);
      };
    });
  }
  groupMenu(wins, button, x, y) {
    const r = button.getBoundingClientRect();
    this.ui.showMenu(
      [
        ...wins.map((w) => ({
          label: w.title,
          icon: w.icon,
          checked: w.id === this.wm.activeId,
          action: () => this.wm.restore(w.id),
        })),
        { separator: true },
        { label: 'Minimizar grupo', action: () => wins.forEach((w) => this.wm.minimize(w.id)) },
        { label: 'Restaurar grupo', action: () => wins.forEach((w) => this.wm.restore(w.id)) },
        {
          label: 'Cerrar grupo',
          action: async () => {
            for (const w of wins) await this.wm.close(w.id);
          },
        },
      ],
      x ?? r.left,
      y ?? r.top - wins.length * 25 - 95,
    );
  }
  hidePreview() {
    clearTimeout(this.previewTimer);
    $('.task-preview')?.remove();
  }
  showPreview(wins, button) {
    if (!button.isConnected || this.ui.menus.length || this.startOpen) return;
    this.hidePreview();
    const el = document.createElement('div');
    el.className = 'task-preview glass';
    wins.slice(0, 4).forEach((win) => {
      const card = document.createElement('div');
      card.className = 'preview-card';
      card.innerHTML = `<div class="preview-title">${icon(win.icon, '', 16)}<span>${escapeHTML(win.title)}</span><button aria-label="Cerrar ${escapeHTML(win.title)}">×</button></div><div class="preview-viewport" aria-hidden="true"></div>`;
      const clone = win.body.cloneNode(true);
      $$('[id]', clone).forEach((node) => node.removeAttribute('id'));
      clone.removeAttribute('id');
      clone.inert = true;
      const width = win.body.clientWidth || win.rect.width - 14,
        height = win.body.clientHeight || win.rect.height - 38;
      const factor = Math.min(196 / width, 123 / height);
      Object.assign(clone.style, {
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${factor})`,
        transformOrigin: '0 0',
        position: 'absolute',
      });
      $('.preview-viewport', card).append(clone);
      card.onclick = (event) => {
        if (!event.target.closest('button')) {
          this.wm.restore(win.id);
          this.hidePreview();
        }
      };
      $('button', card).onclick = () => {
        this.wm.close(win.id);
        this.hidePreview();
      };
      el.append(card);
    });
    el.onpointerenter = () => clearTimeout(this.previewTimer);
    el.onpointerleave = () => this.hidePreview();
    $('#overlays').append(el);
    const r = button.getBoundingClientRect();
    el.style.left = `${clamp(r.left + r.width / 2 - el.offsetWidth / 2, 6, innerWidth - el.offsetWidth - 6)}px`;
  }
  renderTray() {
    this.tray.innerHTML = `<button class="tray-hidden-icons" aria-label="Mostrar iconos ocultos" title="Mostrar iconos ocultos">‹</button><button class="tray-language" title="Español (España)" aria-label="ES, Español (España)">ES</button><button class="tray-security" title="Centro de seguridad" aria-label="Centro de seguridad">${icon('security', '', 16)}</button><button class="tray-network" title="Red" aria-label="Red">${glyph('network', 18)}<i></i></button><button class="tray-volume" title="Volumen" aria-label="Volumen">${glyph(this.settings.get('volume') ? 'sound' : 'mute', 18)}</button><button class="tray-clock" title="Fecha y hora" aria-label="Fecha y hora" ${this.settings.get('showClock') === false ? 'hidden' : ''}><time></time></button>`;
    $('.tray-clock', this.tray).onclick = () =>
      this.flyout?.dataset.kind === 'calendar' ? this.closeFlyout() : this.showCalendar();
    $('.tray-volume', this.tray).onclick = () =>
      this.flyout?.dataset.kind === 'volume' ? this.closeFlyout() : this.showVolume();
    $('.tray-network', this.tray).onclick = () =>
      this.flyout?.dataset.kind === 'network' ? this.closeFlyout() : this.showNetwork();
    $('.tray-security', this.tray).onclick = () =>
      this.ctx.launch('settings', { page: 'security' });
    $('.tray-language', this.tray).onclick = (event) => {
      const r = event.currentTarget.getBoundingClientRect();
      this.ui.showMenu(
        [
          { label: 'ES Español (España)', checked: true, action: () => {} },
          { separator: true },
          {
            label: 'Ayuda de teclado',
            action: () => this.ctx.launch('browser', { url: 'vista://ayuda' }),
          },
        ],
        r.left,
        r.top - 65,
      );
    };
    $('.tray-hidden-icons', this.tray).onclick = (event) => {
      const r = event.currentTarget.getBoundingClientRect();
      this.ui.showMenu(
        [
          {
            label: 'Centro de seguridad de Windows',
            icon: 'security',
            action: () => this.ctx.launch('settings', { page: 'security' }),
          },
          {
            label: 'Windows Sidebar',
            icon: 'calendar',
            checked: this.settings.get('sidebar'),
            action: () => this.settings.set('sidebar', !this.settings.get('sidebar')),
          },
        ],
        r.left,
        r.top - 64,
      );
    };
    this.tick(new Date());
    this.updateNetwork();
  }
  tick(date) {
    const time = $('time', this.tray);
    if (time) {
      const text = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      if (time.textContent !== text) time.textContent = text;
      $('.tray-clock', this.tray).setAttribute('aria-label', `${text}, fecha y hora`);
      time.dateTime = date.toISOString();
      $('.tray-clock', this.tray).title = date.toLocaleDateString('es-ES', { dateStyle: 'full' });
    }
    if (this.flyout?.dataset.kind === 'calendar') {
      updateClocks(this.flyout, date);
      const value = $('.flyout-digital-time', this.flyout);
      if (value) value.textContent = date.toLocaleTimeString('es-ES');
    }
  }
  closeFlyout() {
    this.flyout?.remove();
    this.flyout = null;
  }
  makeFlyout(kind, className, html) {
    this.closeFlyout();
    this.hideStart();
    this.ui.closeMenus();
    const el = document.createElement('section');
    el.className = `tray-flyout glass ${className}`;
    el.dataset.kind = kind;
    el.setAttribute('role', 'dialog');
    el.setAttribute(
      'aria-label',
      kind === 'calendar'
        ? 'Fecha y hora'
        : kind === 'network'
          ? 'Red'
          : kind === 'switcher'
            ? 'Cambiar entre ventanas'
            : 'Volumen',
    );
    el.innerHTML = html;
    $('#overlays').append(el);
    this.flyout = el;
    return el;
  }
  showCalendar() {
    const date = new Date();
    this.displayMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    this.selectedDate = date;
    const el = this.makeFlyout(
      'calendar',
      'date-time-flyout',
      `<div class="date-time-content"><h3>${escapeHTML(date.toLocaleDateString('es-ES', { dateStyle: 'full' }))}</h3><div class="date-time-columns"><div class="month-calendar"></div><div class="flyout-clock">${clockSVG()}<div class="flyout-digital-time"></div><small>${escapeHTML(Intl.DateTimeFormat().resolvedOptions().timeZone)}</small></div></div></div><button class="date-time-settings">Cambiar la configuración de fecha y hora…</button>`,
    );
    $('.date-time-settings', el).onclick = () =>
      this.ui.alert(
        'La fecha, la hora y la zona horaria proceden de tu dispositivo. Una página web no puede modificar el reloj del sistema. Puedes cambiarlo en la configuración de tu sistema operativo.',
        'Fecha y hora',
      );
    this.renderMonth();
    this.tick(date);
    return el;
  }
  renderMonth() {
    const root = $('.month-calendar', this.flyout);
    if (!root) return;
    const year = this.displayMonth.getFullYear(),
      month = this.displayMonth.getMonth(),
      firstDay = (new Date(year, month, 1).getDay() + 6) % 7,
      today = new Date();
    root.innerHTML = `<header><button class="calendar-prev" aria-label="Mes anterior">◂</button><button class="month-label">${escapeHTML(this.displayMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</button><button class="calendar-next" aria-label="Mes siguiente">▸</button></header><div class="calendar-weekdays">${['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map((d) => `<span>${d}</span>`).join('')}</div><div class="calendar-days">${Array.from(
      { length: 42 },
      (_, i) => {
        const d = new Date(year, month, 1 - firstDay + i);
        const iso = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        return `<button data-calendar-day="${iso}" class="${d.getMonth() !== month ? 'other-month' : ''} ${d.toDateString() === today.toDateString() ? 'today' : ''} ${d.toDateString() === this.selectedDate.toDateString() ? 'selected' : ''}" aria-label="${escapeHTML(d.toLocaleDateString('es-ES', { dateStyle: 'long' }))}">${d.getDate()}</button>`;
      },
    ).join(
      '',
    )}</div><button class="calendar-today">Hoy: ${today.toLocaleDateString('es-ES')}</button>`;
    $('.calendar-prev', root).onclick = () => {
      this.displayMonth = new Date(year, month - 1, 1);
      this.renderMonth();
    };
    $('.calendar-next', root).onclick = () => {
      this.displayMonth = new Date(year, month + 1, 1);
      this.renderMonth();
    };
    $('.month-label', root).onclick = $('.calendar-today', root).onclick = () => {
      this.displayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.selectedDate = today;
      this.renderMonth();
    };
    $$('[data-calendar-day]', root).forEach(
      (b) =>
        (b.onclick = () => {
          const [y, m, d] = b.dataset.calendarDay.split('-').map(Number);
          this.selectedDate = new Date(y, m, d);
          this.displayMonth = new Date(y, m, 1);
          this.renderMonth();
        }),
    );
  }
  showVolume() {
    const el = this.makeFlyout(
      'volume',
      'volume-flyout',
      `<div class="volume-inner"><strong>Volumen</strong><span class="volume-value">${this.settings.get('volume')}</span><input class="volume-range" type="range" min="0" max="100" value="${this.settings.get('volume')}" aria-label="Volumen general"><button class="volume-mute" aria-label="Silenciar">${glyph(this.settings.get('volume') ? 'sound' : 'mute', 24)}</button></div><button class="volume-mixer">Mezclador</button>`,
    );
    $('.volume-range', el).oninput = (event) =>
      this.settings.set('volume', Number(event.target.value));
    $('.volume-mute', el).onclick = () => {
      const v = this.settings.get('volume');
      if (v) this.previousVolume = v;
      this.settings.set('volume', v ? 0 : this.previousVolume || 65);
    };
    $('.volume-mixer', el).onclick = async () => {
      const result = await this.ui.dialog({
        title: 'Mezclador de volumen',
        icon: 'sound',
        body: `<p>Sonidos de la interfaz de este escritorio web.</p><label><input type="checkbox" name="sound" ${this.settings.get('sound') ? 'checked' : ''}> Activar sonidos</label><p class="dialog-hint">No cambia el volumen de tu dispositivo ni de otras pestañas.</p>`,
        buttons: [
          { label: 'Aceptar', value: 'ok', primary: true },
          { label: 'Cancelar', value: 'cancel' },
        ],
      });
      if (result.action === 'ok') this.settings.set('sound', !!result.values.sound);
    };
  }
  updateVolume() {
    const volume = this.settings.get('volume');
    const button = $('.tray-volume', this.tray);
    if (button) {
      button.innerHTML = glyph(volume ? 'sound' : 'mute', 18);
      button.title = volume ? `Volumen: ${volume}%` : 'Volumen: silenciado';
    }
    if (this.flyout?.dataset.kind === 'volume') {
      $('.volume-range', this.flyout).value = volume;
      $('.volume-value', this.flyout).textContent = volume;
      $('.volume-mute', this.flyout).innerHTML = glyph(volume ? 'sound' : 'mute', 24);
    }
    this.ctx.audio?.setVolume(volume);
  }
  showNetwork() {
    const online = navigator.onLine;
    const el = this.makeFlyout(
      'network',
      'network-flyout',
      `<div class="network-flyout-content">${icon('network', '', 36)}<div><strong>Conectividad del navegador</strong><p>${online ? 'Conexión de red detectada' : 'Sin conexión de red'}</p><small>Este indicador no comprueba el acceso a Internet ni emula una red física.</small></div></div><button class="network-explore">Abrir la carpeta Red</button>`,
    );
    $('.network-explore', el).onclick = () => {
      this.closeFlyout();
      this.ctx.launch('explorer', { path: 'network' });
    };
    return el;
  }
  updateNetwork() {
    const el = $('.tray-network', this.tray);
    el?.classList.toggle('offline', !navigator.onLine);
    if (el) el.title = navigator.onLine ? 'Conexión de red detectada' : 'Sin conexión de red';
    if (this.flyout?.dataset.kind === 'network') this.showNetwork();
  }
  taskbarMenu() {
    return [
      {
        label: 'Ventanas en cascada',
        disabled: !this.wm.windows.size,
        action: () => this.arrange('cascade'),
      },
      {
        label: 'Mostrar ventanas en paralelo',
        disabled: !this.wm.windows.size,
        action: () => this.arrange('tile'),
      },
      { label: 'Mostrar el escritorio', action: () => this.wm.showDesktop() },
      { separator: true },
      { label: 'Administrador de tareas', action: () => this.showTaskManager() },
      { separator: true },
      { label: 'Propiedades', action: () => this.taskbarProperties() },
    ];
  }
  arrange(mode) {
    const wins = [...this.wm.windows.values()].filter((w) => w.resizable);
    const area = this.wm.area();
    wins.forEach((win, i) => {
      if (win.minimized) this.wm.restore(win.id);
      if (win.state === 'maximized') this.wm.toggleMaximize(win.id);
      if (mode === 'cascade')
        win.rect = {
          x: 20 + (i % 10) * 26,
          y: 20 + (i % 10) * 26,
          width: Math.min(730, area.width - 280),
          height: Math.min(470, area.height - 220),
        };
      else {
        const cols = Math.ceil(Math.sqrt(wins.length)),
          rows = Math.ceil(wins.length / cols);
        const width = area.width / cols,
          height = area.height / rows;
        win.rect = { x: (i % cols) * width, y: Math.floor(i / cols) * height, width, height };
      }
      this.wm.applyRect(win);
    });
  }
  async taskbarProperties() {
    const result = await this.ui.dialog({
      title: 'Propiedades de la barra de tareas y del menú Inicio',
      width: 425,
      body: `<h3>Barra de tareas</h3><p>Personalice la forma en que se muestran los programas abiertos.</p><label class="field-row"><input name="groupTasks" type="checkbox" ${this.settings.get('groupTasks') !== false ? 'checked' : ''}>Agrupar botones similares de la barra de tareas</label><label class="field-row"><input name="showClock" type="checkbox" ${this.settings.get('showClock') !== false ? 'checked' : ''}>Mostrar el reloj</label>`,
      buttons: [
        { label: 'Aceptar', value: 'ok', primary: true },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    if (result.action === 'ok') {
      this.settings.set('groupTasks', !!result.values.groupTasks);
      this.settings.set('showClock', !!result.values.showClock);
    }
  }
  showTaskManager() {
    this.ui.dialog({
      title: 'Administrador de tareas de Windows',
      width: 500,
      body: `<h3>Aplicaciones</h3><div class="task-manager-list">${[...this.wm.windows.values()].map((w) => `<div>${icon(w.icon, '', 17)}<span>${escapeHTML(w.title)}</span><small>${w.minimized ? 'Minimizada' : 'En ejecución'}</small><button type="button" class="vista-button" data-end-task="${w.id}">Finalizar</button></div>`).join('') || '<p>No hay aplicaciones abiertas.</p>'}</div><p class="dialog-hint">Se muestran las ventanas de este escritorio, no los procesos del dispositivo.</p>`,
      onMount: (dialog) =>
        $$('[data-end-task]', dialog).forEach(
          (b) =>
            (b.onclick = async () => {
              const w = this.wm.windows.get(b.dataset.endTask);
              if (!w) return;
              await this.wm.close(w.id);
              if (!this.wm.windows.has(w.id)) b.closest('div').remove();
            }),
        ),
    });
  }
  showSwitcher() {
    const windows = [...this.wm.windows.values()];
    if (!windows.length) return;
    const el = this.makeFlyout(
      'switcher',
      'window-switcher',
      `<h3>Cambiar entre ventanas</h3><div>${windows.map((w) => `<button data-switch-window="${w.id}">${icon(w.icon, '', 40)}<span>${escapeHTML(w.title)}</span></button>`).join('')}</div>`,
    );
    $$('[data-switch-window]', el).forEach(
      (b) =>
        (b.onclick = () => {
          this.wm.restore(b.dataset.switchWindow);
          this.closeFlyout();
        }),
    );
    $('button', el)?.focus();
  }
  lock() {
    this.hideStart();
    this.closeFlyout();
    this.ui.closeMenus();
    this.hidePreview();
    const screen = $('#session-screen');
    screen.hidden = false;
    this.desktop.inert = true;
    $('#taskbar').inert = true;
    screen.innerHTML = `<div class="lock-account"><img src="${asset('avatar.svg')}" width="100" height="100" alt=""><h1>${escapeHTML(this.settings.get('userName'))}</h1><button class="unlock-button">Iniciar sesión ${glyph('forward', 20)}</button><p>Sesión local sin contraseña · Simulación</p></div><div class="session-brand"><img src="${asset('flag.svg')}" alt="" width="38" height="35">Windows Vista™ <small>Ultimate</small></div>`;
    const unlock = () => {
      screen.hidden = true;
      screen.innerHTML = '';
      this.desktop.inert = false;
      $('#taskbar').inert = false;
      this.wm.active?.el.focus();
    };
    $('.unlock-button', screen).onclick = unlock;
    $('.unlock-button', screen).focus();
    screen.onkeydown = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        unlock();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        $('.unlock-button', screen).focus();
      }
    };
  }
  shutdown(restart = false) {
    this.hideStart();
    this.closeFlyout();
    this.ui.closeMenus();
    this.hidePreview();
    this.wm.windows.forEach((w) => w.flushDraft?.());
    const screen = $('#session-screen');
    screen.hidden = false;
    this.desktop.inert = true;
    $('#taskbar').inert = true;
    screen.innerHTML = `<div class="shutdown-content"><img src="${asset('orb.svg')}" alt="" width="76" height="76"><h1>${restart ? 'Reiniciando…' : 'El escritorio está apagado'}</h1><p>${restart ? 'Guardando los borradores locales.' : 'Es seguro cerrar esta pestaña. Tus archivos guardados permanecen en este navegador.'}</p>${restart ? '' : '<button class="vista-button">Iniciar Windows</button>'}</div><div class="session-brand">Windows Vista™</div>`;
    if (restart) setTimeout(() => location.reload(), 700);
    else {
      $('button', screen).onclick = () => location.reload();
      $('button', screen).focus();
    }
  }
  globalKeys(event) {
    if (event.defaultPrevented || $('dialog[open]') || !$('#session-screen').hidden) return;
    const key = event.key.toLowerCase();
    if (event.ctrlKey && event.key === 'Escape') {
      event.preventDefault();
      this.startOpen ? this.hideStart(true) : this.openStart();
    } else if (event.ctrlKey && event.altKey && key === 'd') {
      event.preventDefault();
      this.hideStart();
      this.wm.showDesktop();
    } else if (event.ctrlKey && event.altKey && key === 'n') {
      event.preventDefault();
      this.ctx.launch('notepad');
    } else if (event.ctrlKey && event.altKey && key === 'c') {
      event.preventDefault();
      this.ctx.launch('calculator');
    } else if (event.altKey && (event.key === '`' || event.key === 'Tab')) {
      event.preventDefault();
      this.wm.cycle();
    } else if (event.altKey && event.key === 'F4' && this.wm.active) {
      event.preventDefault();
      this.wm.close(this.wm.activeId);
    } else if (event.key === 'Escape') {
      this.hideStart(true);
      this.closeFlyout();
      this.hidePreview();
    } else if (event.key === 'F1') {
      event.preventDefault();
      this.ctx.launch('browser', { url: 'vista://ayuda' });
    } else if (!isTyping(event.target) && event.target === this.desktop && event.key === 'Delete') {
      event.preventDefault();
      this.deleteDesktop();
    }
  }
}
