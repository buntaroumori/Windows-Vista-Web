import { $, escapeHTML, download, debounce, uid } from '../utils.js';

export function openNotepad(ctx, data = {}) {
  const { wm, ui, fs, storage } = ctx;
  const node = data.fileId ? fs.get(data.fileId) : null;
  const recovered = data.draft;
  let fileId = recovered?.fileId ?? node?.id ?? null;
  let name = recovered?.name ?? node?.name ?? data.name ?? 'Sin título';
  let content = recovered?.text ?? node?.content ?? data.content ?? '';
  let dirty = !!recovered || (data.content !== undefined && !node),
    wrap = true,
    statusVisible = true;
  const draftId = recovered?.id ?? uid();
  const win = wm.create('notepad', {
    title: `${name} - Bloc de notas`,
    icon: 'notepad',
    width: 660,
    height: 452,
    minWidth: 330,
    minHeight: 220,
    className: 'notepad-app',
  });
  if (!win) return;
  const readDrafts = () => {
    const d = storage.get('drafts.v1', {});
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  };
  const removeDraft = () => {
    const drafts = readDrafts();
    delete drafts[draftId];
    storage.set('drafts.v1', drafts);
  };
  const persistDraft = () => {
    if (!dirty || !win.el.isConnected) return;
    const drafts = readDrafts();
    drafts[draftId] = {
      id: draftId,
      fileId,
      name,
      text: textarea.value.slice(0, 1_000_000),
      updated: Date.now(),
    };
    const keys = Object.keys(drafts).sort((a, b) => drafts[b].updated - drafts[a].updated);
    keys.slice(10).forEach((key) => delete drafts[key]);
    storage.set('drafts.v1', drafts);
  };
  const delayedDraft = debounce(persistDraft, 250);
  const copy = async (cut = false) => {
    const text = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (cut) {
        textarea.setRangeText('', textarea.selectionStart, textarea.selectionEnd, 'end');
        changed();
      }
    } catch {
      ui.alert(
        'El navegador no permite acceder al portapapeles. Usa Ctrl+C para copiar o Ctrl+X para cortar.',
        'Bloc de notas',
      );
    }
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
      changed();
    } catch {
      ui.alert(
        'Usa Ctrl+V para pegar directamente en el documento. El navegador ha restringido el acceso al portapapeles.',
        'Bloc de notas',
      );
    }
  };
  const selectAll = () => {
    textarea.focus();
    textarea.select();
    updateStatus();
  };
  const undo = () => {
    textarea.focus();
    document.execCommand('undo');
  };
  const setWrap = () => {
    wrap = !wrap;
    textarea.wrap = wrap ? 'soft' : 'off';
    textarea.classList.toggle('no-wrap', !wrap);
  };
  const setStatus = () => {
    statusVisible = !statusVisible;
    status.hidden = !statusVisible;
  };
  ui.menubar(win, [
    {
      label: 'Archivo',
      items: () => [
        { label: 'Nuevo', shortcut: 'Ctrl+N', action: () => ctx.launch('notepad') },
        { label: 'Abrir…', shortcut: 'Ctrl+O', action: openLocal },
        { label: 'Abrir Documentos', action: () => ctx.launch('explorer', { path: 'documents' }) },
        { label: 'Guardar', shortcut: 'Ctrl+S', icon: 'text', action: () => save() },
        { label: 'Guardar como…', shortcut: 'Ctrl+Mayús+S', action: () => save(true) },
        { separator: true },
        {
          label: 'Descargar archivo .txt',
          action: () => download(name === 'Sin título' ? 'Documento.txt' : name, textarea.value),
        },
        { label: 'Imprimir…', shortcut: 'Ctrl+P', action: print },
        { separator: true },
        { label: 'Salir', action: () => win.close() },
      ],
    },
    {
      label: 'Edición',
      items: [
        { label: 'Deshacer', shortcut: 'Ctrl+Z', action: undo },
        { separator: true },
        { label: 'Cortar', shortcut: 'Ctrl+X', action: () => copy(true) },
        { label: 'Copiar', shortcut: 'Ctrl+C', action: () => copy() },
        { label: 'Pegar', shortcut: 'Ctrl+V', action: paste },
        {
          label: 'Eliminar',
          shortcut: 'Supr',
          action: () => {
            textarea.setRangeText('', textarea.selectionStart, textarea.selectionEnd, 'end');
            changed();
          },
        },
        { separator: true },
        { label: 'Buscar…', shortcut: 'Ctrl+F', action: find },
        { label: 'Seleccionar todo', shortcut: 'Ctrl+A', action: selectAll },
        { label: 'Hora y fecha', shortcut: 'F5', action: insertDate },
      ],
    },
    {
      label: 'Formato',
      items: () => [
        { label: 'Ajuste de línea', checked: wrap, action: setWrap },
        { label: 'Fuente…', action: font },
      ],
    },
    {
      label: 'Ver',
      items: () => [{ label: 'Barra de estado', checked: statusVisible, action: setStatus }],
    },
    {
      label: 'Ayuda',
      items: [
        {
          label: 'Ver la ayuda',
          action: () => ctx.launch('browser', { url: 'vista://ayuda#notas' }),
        },
        { separator: true },
        {
          label: 'Acerca del Bloc de notas',
          action: () =>
            ui.dialog({
              title: 'Acerca del Bloc de notas',
              icon: 'notepad',
              body: '<h3>Bloc de notas</h3><p>Una hoja en blanco para tus ideas.</p><p>Recreación web de la aplicación de Windows Vista. Los documentos se guardan en este navegador. Puedes descargar una copia desde Archivo.</p>',
            }),
        },
      ],
    },
  ]);
  const textarea = document.createElement('textarea');
  textarea.className = 'notepad-text';
  textarea.setAttribute('aria-label', 'Documento de texto');
  textarea.spellcheck = false;
  textarea.wrap = 'soft';
  textarea.maxLength = 1_000_000;
  textarea.value = content;
  const status = document.createElement('footer');
  status.className = 'app-status notepad-status';
  win.body.append(textarea, status);
  win.fileId = fileId;
  function updateStatus() {
    const before = textarea.value.slice(0, textarea.selectionStart),
      lines = before.split('\n');
    status.innerHTML = `<span>${dirty ? 'Modificado · Borrador local' : 'Documento guardado'}</span><span class="status-spacer"></span><span>Lín. ${lines.length}, col. ${lines.at(-1).length + 1}</span>`;
  }
  function changed() {
    dirty = true;
    content = textarea.value;
    updateStatus();
    delayedDraft();
  }
  textarea.addEventListener('input', changed);
  textarea.addEventListener('click', updateStatus);
  textarea.addEventListener('keyup', updateStatus);
  textarea.addEventListener('select', updateStatus);
  async function save(as = false) {
    if (!fileId || as || !fs.get(fileId) || fs.isTrashed(fileId)) {
      const result = await ui.dialog({
        title: 'Guardar como',
        width: 460,
        icon: 'text',
        body: `<label class="field-label">Nombre de archivo:<input class="vista-input" name="name" value="${escapeHTML(name === 'Sin título' ? 'Documento.txt' : name)}" required maxlength="120" autocomplete="off"></label><label class="field-label">Guardar en:<select class="vista-input" name="parent"><option value="documents">Documentos</option><option value="desktop">Escritorio</option><option value="downloads">Descargas</option></select></label><p class="dialog-hint">El archivo se guardará en el escritorio virtual de este navegador. Para exportarlo, usa Archivo → Descargar archivo .txt.</p>`,
        buttons: [
          { label: 'Guardar', value: 'save', primary: true, validate: true },
          { label: 'Cancelar', value: 'cancel' },
        ],
      });
      if (result.action !== 'save') return false;
      let targetName = result.values.name.trim();
      if (!/\.[a-z0-9]{1,8}$/i.test(targetName)) targetName += '.txt';
      try {
        const existing = fs
          .list(result.values.parent)
          .find((n) => n.name.toLowerCase() === targetName.toLowerCase());
        if (existing) {
          if (existing.type !== 'text')
            throw new Error('Ya existe una carpeta o imagen con ese nombre.');
          if (
            !(await ui.confirm(`«${targetName}» ya existe. ¿Desea reemplazarlo?`, 'Guardar como'))
          )
            return false;
          fs.write(existing.id, textarea.value);
          fileId = existing.id;
        } else fileId = fs.create(result.values.parent, targetName, 'text', textarea.value).id;
        name = targetName;
      } catch (error) {
        await ui.alert(error.message, 'Bloc de notas', 'warning');
        return false;
      }
    } else {
      try {
        fs.write(fileId, textarea.value);
        name = fs.get(fileId).name;
      } catch (error) {
        await ui.alert(error.message, 'Bloc de notas', 'warning');
        return false;
      }
    }
    dirty = false;
    win.fileId = fileId;
    win.setTitle(`${name} - Bloc de notas`);
    delayedDraft.cancel();
    removeDraft();
    updateStatus();
    return true;
  }
  async function askSave() {
    if (!dirty) return true;
    persistDraft();
    const { action } = await ui.dialog({
      title: 'Bloc de notas',
      icon: 'notepad',
      body: `<p>¿Desea guardar los cambios en <strong>${escapeHTML(name)}</strong>?</p>`,
      buttons: [
        { label: 'Guardar', value: 'save', primary: true },
        { label: 'No guardar', value: 'discard' },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    if (action === 'save') return save();
    return action === 'discard';
  }
  async function openLocal() {
    if (!(await askSave())) return;
    const file = await ui.openTextFile();
    if (!file) return;
    removeDraft();
    fileId = null;
    win.fileId = null;
    name = file.name;
    textarea.value = file.content;
    win.setTitle(`${name} - Bloc de notas`);
    changed();
  }
  let findValue = '';
  async function find() {
    const result = await ui.dialog({
      title: 'Buscar',
      width: 395,
      body: `<label class="field-label">Buscar:<input class="vista-input" name="query" value="${escapeHTML(findValue)}" required autocomplete="off"></label><label><input type="checkbox" name="caseSensitive"> Coincidir mayúsculas y minúsculas</label>`,
      buttons: [
        { label: 'Buscar siguiente', value: 'find', primary: true, validate: true },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    if (result.action !== 'find') return;
    findValue = result.values.query;
    const sensitive = !!result.values.caseSensitive;
    const haystack = sensitive ? textarea.value : textarea.value.toLowerCase(),
      needle = sensitive ? findValue : findValue.toLowerCase();
    let index = haystack.indexOf(needle, textarea.selectionEnd);
    if (index < 0) index = haystack.indexOf(needle);
    if (index < 0) return ui.alert(`No se encuentra «${findValue}».`, 'Bloc de notas');
    textarea.focus();
    textarea.setSelectionRange(index, index + findValue.length);
    const line = textarea.value.slice(0, index).split('\n').length;
    textarea.scrollTop = Math.max(0, (line - 3) * parseInt(getComputedStyle(textarea).lineHeight));
    updateStatus();
  }
  async function font() {
    const result = await ui.dialog({
      title: 'Fuente',
      width: 390,
      body: '<label class="field-label">Fuente:<select name="family" class="vista-input"><option>Lucida Console</option><option>Consolas</option><option>Courier New</option><option>Arial</option><option>Segoe UI</option></select></label><label class="field-label">Tamaño:<select class="vista-input" name="size"><option>11</option><option selected>13</option><option>16</option><option>18</option><option>22</option><option>28</option></select></label><div class="font-preview">AaBbYyZz · 0123456789</div>',
      buttons: [
        { label: 'Aceptar', value: 'ok', primary: true },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    if (result.action === 'ok') {
      textarea.style.fontFamily = `"${result.values.family}", monospace`;
      textarea.style.fontSize = `${result.values.size}px`;
    }
  }
  function insertDate() {
    textarea.setRangeText(
      new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
      textarea.selectionStart,
      textarea.selectionEnd,
      'end',
    );
    changed();
    textarea.focus();
  }
  function print() {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Imprimir documento';
    frame.srcdoc = `<!doctype html><html lang="es"><title>${escapeHTML(name)}</title><style>body{font:12pt monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:20mm}</style><body>${escapeHTML(textarea.value)}</body></html>`;
    frame.onload = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    };
    document.body.append(frame);
    setTimeout(() => frame.remove(), 60000);
  }
  win.onBeforeClose = askSave;
  const flush = () => {
    delayedDraft.cancel();
    persistDraft();
  };
  win.flushDraft = flush;
  window.addEventListener('pagehide', flush);
  win.cleanup.push(() => {
    delayedDraft.cancel();
    removeDraft();
    window.removeEventListener('pagehide', flush);
  });
  win.onKeydown = (event) => {
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        save(event.shiftKey);
      } else if (key === 'o') {
        event.preventDefault();
        openLocal();
      } else if (key === 'n') {
        event.preventDefault();
        ctx.launch('notepad');
      } else if (key === 'f') {
        event.preventDefault();
        find();
      } else if (key === 'p') {
        event.preventDefault();
        print();
      }
    } else if (event.key === 'F5') {
      event.preventDefault();
      insertDate();
    }
  };
  updateStatus();
  if (dirty) persistDraft();
  requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
  return win;
}
