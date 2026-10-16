import {
  $,
  $$,
  escapeHTML,
  icon,
  glyph,
  normalize,
  prettyBytes,
  asset,
  isTyping,
} from '../utils.js';
import { fileIcon } from '../filesystem.js';

const SPECIAL = {
  computer: 'Equipo',
  network: 'Red',
  recycle: 'Papelera de reciclaje',
  recent: 'Elementos recientes',
};
export function openExplorer(ctx, data = {}) {
  const { wm, ui, fs } = ctx;
  const win = wm.create('explorer', {
    title: 'Equipo',
    icon: 'computer',
    width: 810,
    height: 545,
    minWidth: 465,
    minHeight: 300,
    className: 'explorer-app',
  });
  if (!win) return;
  let path = data.path ?? 'computer',
    history = [],
    historyIndex = -1,
    query = '',
    view = data.view || 'icons',
    selected = new Set(),
    listed = [];
  win.body.innerHTML = `<div class="navigation-bar"><button class="nav-circle explorer-back" aria-label="Atrás" title="Atrás (Alt+Izquierda)">${glyph('back', 17)}</button><button class="nav-circle explorer-forward" aria-label="Adelante" title="Adelante (Alt+Derecha)">${glyph('forward', 17)}</button><button class="nav-history" aria-label="Historial">▾</button><div class="breadcrumb explorer-breadcrumb"></div><label class="shell-search"><input placeholder="Buscar" aria-label="Buscar en esta carpeta">${glyph('search', 14)}</label></div>
    <div class="app-toolbar explorer-toolbar"><button class="toolbar-button organize">Organizar ▾</button><span class="toolbar-separator"></span><button class="toolbar-button views">${icon('pictures', '', 16)} Vistas ▾</button><span class="toolbar-separator"></span><button class="toolbar-button new-folder">Nueva carpeta</button><button class="toolbar-button empty-trash" hidden>Vaciar la Papelera</button><button class="toolbar-button restore-all" hidden>Restaurar todos</button><span class="toolbar-spacer"></span><button class="toolbar-button explorer-help" title="Ayuda" aria-label="Ayuda">${icon('help', '', 16)}</button></div>
    <div class="explorer-panes"><nav class="explorer-sidebar" aria-label="Carpetas"><div class="explorer-nav-heading">Vínculos favoritos</div><button data-path="documents">${icon('documents', '', 18)}Documentos</button><button data-path="pictures">${icon('pictures', '', 18)}Imágenes</button><button data-path="music">${icon('music', '', 18)}Música</button><button data-path="recent">${icon('search', '', 18)}Elementos recientes</button><button data-path="downloads">${icon('downloads', '', 18)}Descargas</button><div class="explorer-tree-heading">Carpetas</div><div class="explorer-tree"><button data-path="desktop">▾ ${icon('desktop', '', 16)}Escritorio</button><button class="tree-indent" data-path="home">▸ ${icon('user', '', 16)}${escapeHTML(ctx.settings.get('userName'))}</button><button class="tree-indent" data-path="computer">▾ ${icon('computer', '', 16)}Equipo</button><button class="tree-indent-2" data-path="c">${icon('drive', '', 16)}Disco local (C:)</button><button class="tree-indent-2" data-path="d">${icon('drive', '', 16)}Datos (D:)</button><button class="tree-indent" data-path="network">▸ ${icon('network', '', 16)}Red</button><button class="tree-indent" data-path="recycle">${icon('recycle-empty', '', 16)}Papelera</button></div></nav><div class="explorer-main"><div class="explorer-view" tabindex="0" role="listbox" aria-label="Archivos y carpetas" aria-multiselectable="true"></div></div></div><div class="explorer-details"></div><footer class="app-status"><span class="explorer-count"></span><span class="status-spacer"></span><span>Almacenamiento de este navegador</span></footer>`;
  const content = $('.explorer-view', win.body),
    crumb = $('.explorer-breadcrumb', win.body),
    search = $('.shell-search input', win.body);
  const error = (err) => ui.alert(err.message, 'Explorador de Windows', 'warning');
  const currentName = () => SPECIAL[path] || fs.get(path)?.name || 'Equipo';
  const canCreate = () => !!fs.get(path) && !fs.isTrashed(path);
  const back = () => {
    if (historyIndex > 0) {
      historyIndex--;
      go(history[historyIndex], false);
    }
  };
  const forward = () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      go(history[historyIndex], false);
    }
  };
  function go(next, addHistory = true) {
    path =
      SPECIAL[next] || (fs.get(next)?.type === 'folder' && !fs.isTrashed(next)) ? next : 'computer';
    if (addHistory) {
      history = history.slice(0, historyIndex + 1);
      history.push(path);
      historyIndex = history.length - 1;
    }
    query = '';
    search.value = '';
    selected.clear();
    render();
  }
  function renderCrumb() {
    const ancestors = SPECIAL[path] ? [] : fs.ancestors(path);
    crumb.innerHTML = `${icon(SPECIAL[path] ? (path === 'recycle' ? 'recycle-empty' : path === 'network' ? 'network' : 'computer') : fileIcon(fs.get(path)), '', 16)}<button data-path="computer">Equipo</button>${ancestors.length ? ancestors.map((n) => `<span class="crumb-arrow">▸</span><button data-path="${escapeHTML(n.id)}">${escapeHTML(n.name)}</button>`).join('') : path !== 'computer' ? `<span class="crumb-arrow">▸</span><button data-path="${path}">${escapeHTML(currentName())}</button>` : ''}`;
    $$('[data-path]', crumb).forEach((button) => (button.onclick = () => go(button.dataset.path)));
    crumb.title = SPECIAL[path] || fs.path(path);
    $('.explorer-back', win.body).disabled = historyIndex <= 0;
    $('.explorer-forward', win.body).disabled = historyIndex >= history.length - 1;
    win.setTitle(`${currentName()} — Explorador de Windows`);
    search.placeholder = `Buscar en ${currentName()}`;
  }
  function getItems() {
    if (path === 'recent')
      return fs.nodes
        .filter(
          (n) =>
            n.type !== 'folder' && !fs.isTrashed(n) && normalize(n.name).includes(normalize(query)),
        )
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .slice(0, 20);
    return fs.list(path, query);
  }
  function render() {
    renderCrumb();
    $$('.explorer-sidebar [data-path]', win.body).forEach((button) =>
      button.classList.toggle('selected', button.dataset.path === path),
    );
    $('.new-folder', win.body).hidden = !canCreate();
    $('.empty-trash', win.body).hidden = path !== 'recycle';
    $('.restore-all', win.body).hidden = path !== 'recycle';
    content.className = `explorer-view view-${view}`;
    if (path === 'computer') {
      listed = [{ id: 'c' }, { id: 'd' }];
      content.innerHTML = `<h2 class="explorer-group-heading">Discos duros (2)</h2><div class="drive-grid">${[
        ['c', 'Disco local (C:)', 44, '41,2 GB disponibles de 74,5 GB'],
        ['d', 'Datos (D:)', 19, '120 GB disponibles de 148 GB'],
      ]
        .filter(([, name]) => normalize(name).includes(normalize(query)))
        .map(
          ([id, name, used, size]) =>
            `<button class="drive-item file-item" role="option" aria-selected="false" data-node="${id}" title="Unidad virtual. Capacidad ilustrativa.">${icon('drive', '', 48)}<span><strong>${name}</strong><span class="drive-meter"><i style="width:${used}%"></i></span><small>${size}</small></span></button>`,
        )
        .join(
          '',
        )}</div><h2 class="explorer-group-heading">Dispositivos con almacenamiento extraíble (1)</h2><button class="drive-item dvd-drive" title="Unidad de DVD virtual">${icon('dvd', '', 48)}<span><strong>Unidad de DVD RW (E:)</strong><small>Sin disco</small></span></button><div class="computer-network-hint">Las unidades y capacidades se representan de forma simulada.</div>`;
      $('.dvd-drive', content).ondblclick = () =>
        ui.alert(
          'Inserte un disco en la unidad E:. Esta unidad es una representación visual; el navegador no accede a dispositivos físicos.',
          'Unidad de DVD RW (E:)',
        );
    } else if (path === 'network') {
      listed = [];
      content.innerHTML = `<div class="network-info">${icon('info', '', 17)}Esta red representa únicamente el equipo local del escritorio web.</div><h2 class="explorer-group-heading">Equipo (1)</h2><button class="network-computer">${icon('computer', '', 54)}<span>VISTA-PC</span></button>`;
      $('.network-computer', content).ondblclick = () => go('computer');
    } else {
      listed = getItems();
      content.innerHTML = `${path === 'recycle' ? '<div class="recycle-info">Los elementos de esta carpeta se pueden restaurar o eliminar permanentemente.</div>' : ''}${view === 'details' && listed.length ? '<div class="file-column-headings"><span>Nombre</span><span>Fecha de modificación</span><span>Tipo</span><span>Tamaño</span></div>' : ''}<div class="file-list">${listed.map((node) => `<button class="file-item" role="option" aria-selected="${selected.has(node.id)}" data-node="${escapeHTML(node.id)}" title="${escapeHTML(node.name)}">${node.type === 'image' && view !== 'details' ? `<span class="file-thumbnail"><img src="${asset(node.asset.replace('wallpapers/', 'thumbnails/'))}" alt="" loading="lazy" draggable="false"></span>` : icon(fileIcon(node), '', view === 'details' ? 18 : 48)}<span class="file-name">${escapeHTML(node.name)}</span>${view === 'details' ? `<span class="file-modified">${new Date(node.modified).toLocaleDateString('es-ES')}</span><span class="file-type">${node.type === 'folder' ? 'Carpeta de archivos' : node.type === 'image' ? 'Imagen JPEG' : 'Documento de texto'}</span><span class="file-size">${node.type === 'text' ? prettyBytes(new Blob([node.content || '']).size) : ''}</span>` : ''}</button>`).join('')}</div>${listed.length ? '' : `<div class="empty-state">${icon(path === 'recycle' ? 'recycle-empty' : 'folder', '', 48)}<p>${query ? 'Ningún elemento coincide con la búsqueda.' : 'Esta carpeta está vacía.'}</p></div>`}`;
    }
    $$('.file-item', content).forEach((button) => {
      button.onclick = (event) => select(button.dataset.node, event);
      button.ondblclick = () => open(button.dataset.node);
      button.oncontextmenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!selected.has(button.dataset.node)) select(button.dataset.node, {});
        itemMenu(event.clientX, event.clientY);
      };
    });
    updateSelection();
  }
  function select(id, event = {}) {
    if (event.shiftKey && selected.size) {
      const start = listed.findIndex((n) => n.id === [...selected][0]),
        end = listed.findIndex((n) => n.id === id);
      if (start >= 0 && end >= 0)
        listed
          .slice(Math.min(start, end), Math.max(start, end) + 1)
          .forEach((n) => selected.add(n.id));
    } else if (event.ctrlKey || event.metaKey) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
    } else selected = new Set([id]);
    updateSelection();
  }
  function updateSelection() {
    $$('.file-item', content).forEach((el) => {
      const active = selected.has(el.dataset.node);
      el.classList.toggle('selected', active);
      el.setAttribute('aria-selected', String(active));
    });
    const node = selected.size === 1 ? fs.get([...selected][0]) : null;
    $('.explorer-details', win.body).innerHTML = node
      ? `${icon(fileIcon(node), '', 40)}<div><strong>${escapeHTML(node.name)}</strong><p>${node.type === 'folder' ? 'Carpeta de archivos' : node.type === 'image' ? 'Imagen · Archivo de muestra' : `Documento de texto · ${prettyBytes(new Blob([node.content || '']).size)}`}</p></div><span class="detail-date">Modificado: ${new Date(node.modified).toLocaleDateString('es-ES')}</span>`
      : `${icon(path === 'computer' ? 'computer' : path === 'recycle' ? 'recycle-empty' : 'folder', '', 40)}<div><strong>${escapeHTML(currentName())}</strong><p>${selected.size ? `${selected.size} elementos seleccionados` : 'Seleccione un elemento para ver sus detalles.'}</p></div>`;
    $('.explorer-count', win.body).textContent =
      `${listed.length} elemento${listed.length === 1 ? '' : 's'}${selected.size ? ` · ${selected.size} seleccionado${selected.size === 1 ? '' : 's'}` : ''}`;
  }
  function open(id) {
    const node = fs.get(id);
    if (!node) return;
    if (path === 'recycle') return properties(node);
    if (node.type === 'folder') go(id);
    else ctx.openFile(node);
  }
  async function create(type = 'folder') {
    if (!canCreate()) return;
    const name = await ui.prompt(
      type === 'folder' ? 'Nueva carpeta' : 'Nuevo documento de texto',
      'Nombre:',
      fs.uniqueName(path, type === 'folder' ? 'Nueva carpeta' : 'Nuevo documento.txt'),
    );
    if (!name) return;
    try {
      const node = fs.create(path, name, type);
      selected = new Set([node.id]);
      render();
    } catch (err) {
      error(err);
    }
  }
  async function rename() {
    const node = fs.get([...selected][0]);
    if (!node || node.protected || selected.size !== 1) return;
    const name = await ui.prompt('Cambiar nombre', 'Escriba un nuevo nombre:', node.name);
    if (name && name !== node.name) {
      try {
        fs.rename(node.id, name);
      } catch (err) {
        error(err);
      }
    }
  }
  async function remove() {
    const nodes = [...selected].map((id) => fs.get(id)).filter((n) => n && !n.protected);
    if (!nodes.length) return;
    if (path === 'recycle') {
      await empty();
      return;
    }
    if (
      !(await ui.confirm(
        `¿Desea mover ${nodes.length === 1 ? `«${nodes[0].name}»` : `estos ${nodes.length} elementos`} a la Papelera de reciclaje?`,
        'Eliminar archivo',
      ))
    )
      return;
    try {
      nodes.forEach((n) => fs.trash(n.id));
      selected.clear();
      render();
    } catch (err) {
      error(err);
    }
  }
  async function empty() {
    if (!fs.list('recycle').length) return;
    if (
      await ui.confirm(
        '¿Desea eliminar permanentemente todos los elementos de la Papelera de reciclaje? Esta acción no se puede deshacer.',
        'Vaciar la Papelera de reciclaje',
      )
    ) {
      try {
        fs.emptyTrash();
        selected.clear();
        render();
      } catch (err) {
        error(err);
      }
    }
  }
  function properties(node) {
    ui.dialog({
      title: `Propiedades de ${node.name}`,
      icon: fileIcon(node),
      body: `<p><strong>${escapeHTML(node.name)}</strong></p><p>Tipo: ${node.type === 'folder' ? 'Carpeta de archivos' : node.type === 'image' ? 'Imagen' : 'Documento de texto'}</p><p class="selectable">Ubicación: ${escapeHTML(fs.path(node.parent))}</p><p>Modificado: ${escapeHTML(new Date(node.modified).toLocaleString('es-ES'))}</p>${node.trashed ? '<p>Este elemento está en la Papelera de reciclaje.</p>' : ''}<p>Almacenado localmente en este navegador.</p>`,
    });
  }
  const viewMenu = () =>
    ['icons', 'details', 'list'].map((value, i) => ({
      label: ['Iconos medianos', 'Detalles', 'Lista'][i],
      checked: view === value,
      action: () => {
        view = value;
        render();
      },
    }));
  function itemMenu(x, y) {
    const node = fs.get([...selected][0]);
    if (!node) return;
    ui.showMenu(
      [
        {
          label: path === 'recycle' ? 'Restaurar' : 'Abrir',
          bold: true,
          action: () => {
            if (path === 'recycle') {
              try {
                [...selected].forEach((id) => fs.restore(id));
                selected.clear();
                render();
              } catch (err) {
                error(err);
              }
            } else open(node.id);
          },
        },
        { separator: true },
        {
          label: 'Cambiar nombre',
          shortcut: 'F2',
          disabled: node.protected || selected.size !== 1 || path === 'recycle',
          action: rename,
        },
        { label: 'Eliminar', shortcut: 'Supr', disabled: node.protected, action: remove },
        { separator: true },
        { label: 'Propiedades', action: () => properties(node) },
      ],
      x,
      y,
    );
  }
  const backgroundMenu = () => [
    { label: 'Ver', submenu: viewMenu() },
    { label: 'Actualizar', action: render },
    { separator: true },
    {
      label: 'Nuevo',
      disabled: !canCreate(),
      submenu: [
        { label: 'Carpeta', icon: 'folder', action: () => create('folder') },
        { label: 'Documento de texto', icon: 'text', action: () => create('text') },
      ],
    },
    ...(path === 'recycle' ? [{ label: 'Vaciar la Papelera de reciclaje', action: empty }] : []),
  ];
  $('.explorer-back', win.body).onclick = back;
  $('.explorer-forward', win.body).onclick = forward;
  $('.nav-history', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(
      history.map((p, i) => ({
        label: SPECIAL[p] || fs.get(p)?.name || p,
        checked: i === historyIndex,
        action: () => {
          historyIndex = i;
          go(p, false);
        },
      })),
      r.left,
      r.bottom,
    );
  };
  $$('.explorer-sidebar [data-path]', win.body).forEach(
    (button) => (button.onclick = () => go(button.dataset.path)),
  );
  $('.new-folder', win.body).onclick = () => create();
  $('.empty-trash', win.body).onclick = empty;
  $('.restore-all', win.body).onclick = () => {
    try {
      fs.list('recycle').forEach((n) => fs.restore(n.id));
      render();
    } catch (err) {
      error(err);
    }
  };
  $('.views', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(viewMenu(), r.left, r.bottom);
  };
  $('.organize', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(
      [
        { label: 'Nueva carpeta', disabled: !canCreate(), action: () => create() },
        { label: 'Nuevo documento de texto', disabled: !canCreate(), action: () => create('text') },
        { separator: true },
        { label: 'Cambiar nombre', shortcut: 'F2', disabled: selected.size !== 1, action: rename },
        { label: 'Eliminar', shortcut: 'Supr', disabled: !selected.size, action: remove },
        { separator: true },
        {
          label: 'Seleccionar todo',
          shortcut: 'Ctrl+A',
          action: () => {
            listed.forEach((n) => selected.add(n.id));
            updateSelection();
          },
        },
        {
          label: 'Importar archivo de texto…',
          disabled: !canCreate(),
          action: async () => {
            const f = await ui.openTextFile();
            if (f) {
              try {
                fs.create(path, fs.uniqueName(path, f.name), 'text', f.content);
              } catch (err) {
                error(err);
              }
            }
          },
        },
      ],
      r.left,
      r.bottom,
    );
  };
  $('.explorer-help', win.body).onclick = () =>
    ctx.launch('browser', { url: 'vista://ayuda#archivos' });
  search.oninput = () => {
    query = search.value;
    selected.clear();
    render();
  };
  search.onkeydown = (event) => {
    if (event.key === 'Escape') {
      query = '';
      search.value = '';
      render();
    }
  };
  content.oncontextmenu = (event) => {
    event.preventDefault();
    ui.showMenu(backgroundMenu(), event.clientX, event.clientY);
  };
  content.addEventListener('click', (event) => {
    if (!event.target.closest('.file-item, .drive-item')) {
      selected.clear();
      updateSelection();
    }
  });
  crumb.ondblclick = (event) => {
    if (event.target.closest('button')) return;
    const previous = fs.path(path) || currentName();
    crumb.innerHTML = '<input class="address-edit" aria-label="Dirección de carpeta">';
    const input = $('input', crumb);
    input.value = previous;
    input.focus();
    input.select();
    input.onkeydown = (e) => {
      if (e.key === 'Escape') renderCrumb();
      if (e.key === 'Enter') {
        const target = fs.nodes.find(
          (n) =>
            n.type === 'folder' &&
            normalize(fs.path(n.id)) === normalize(input.value.replace(/\\$/, '')),
        );
        if (target) go(target.id);
        else {
          ui.alert('No se encuentra esta carpeta.');
          renderCrumb();
        }
      }
    };
    input.onblur = () => {
      if (input.isConnected) renderCrumb();
    };
  };
  content.ondragover = (event) => {
    event.preventDefault();
    content.classList.add('drop-target');
  };
  content.ondragleave = () => content.classList.remove('drop-target');
  content.ondrop = async (event) => {
    event.preventDefault();
    content.classList.remove('drop-target');
    if (!canCreate()) return;
    for (const file of [...event.dataTransfer.files].slice(0, 10)) {
      if (
        file.size > 1_000_000 ||
        (!file.type.startsWith('text/') && !/\.(txt|md|csv|json|log)$/i.test(file.name))
      ) {
        ui.balloon('Archivo no importado', 'Solo se admiten archivos de texto de hasta 1 MB.');
        continue;
      }
      try {
        fs.create(path, fs.uniqueName(path, file.name), 'text', await file.text());
      } catch (err) {
        error(err);
      }
    }
  };
  win.onKeydown = (event) => {
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      back();
      return;
    }
    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      forward();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      crumb.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return;
    }
    if (isTyping(event.target)) return;
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      create();
    } else if (event.key === 'F2') {
      event.preventDefault();
      rename();
    } else if (event.key === 'Delete') {
      event.preventDefault();
      remove();
    } else if (event.key === 'Enter' && selected.size === 1) {
      event.preventDefault();
      open([...selected][0]);
    } else if (event.ctrlKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      listed.forEach((n) => selected.add(n.id));
      updateSelection();
    } else if (event.key.startsWith('Arrow') && listed.length) {
      event.preventDefault();
      const current = listed.findIndex((n) => selected.has(n.id));
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const next = Math.max(0, Math.min(listed.length - 1, current + step));
      selected = new Set([listed[next].id]);
      updateSelection();
      $$('.file-item', content)[next]?.scrollIntoView({ block: 'nearest' });
    }
  };
  win.cleanup.push(
    fs.subscribe(() => {
      selected = new Set([...selected].filter((id) => fs.get(id)));
      if (!SPECIAL[path] && (!fs.get(path) || fs.isTrashed(path))) go('computer');
      else render();
    }),
  );
  go(path);
  return win;
}
