import { uid, normalize } from './utils.js';

const MAX_BYTES = 2_500_000;
const MAX_TEXT = 1_000_000;
const sameName = (a, b) => a.toLocaleLowerCase('es-ES') === b.toLocaleLowerCase('es-ES');
export const fileIcon = (node) =>
  node?.type === 'folder' ? node.icon || 'folder' : node?.type === 'image' ? 'image' : 'text';
const seed = () => {
  const modified = new Date().toISOString();
  const folder = (id, name, parent, icon = 'folder', protectedNode = true) => ({
    id,
    name,
    parent,
    type: 'folder',
    icon,
    protected: protectedNode,
    modified,
  });
  const text = (id, name, parent, content) => ({
    id,
    name,
    parent,
    type: 'text',
    content,
    modified,
  });
  return [
    folder('c', 'Disco local (C:)', null, 'drive'),
    folder('d', 'Datos (D:)', null, 'drive'),
    folder('users', 'Usuarios', 'c', 'users'),
    folder('home', 'Usuario', 'users', 'user'),
    folder('windows', 'Windows', 'c'),
    folder('programs', 'Archivos de programa', 'c'),
    folder('desktop', 'Escritorio', 'home', 'desktop'),
    folder('documents', 'Documentos', 'home', 'documents'),
    folder('pictures', 'Imágenes', 'home', 'pictures'),
    folder('music', 'Música', 'home', 'music'),
    folder('videos', 'Vídeos', 'home', 'videos'),
    folder('downloads', 'Descargas', 'home', 'downloads'),
    folder('projects', 'Mis proyectos', 'documents', 'folder', false),
    text(
      'welcome-text',
      'Bienvenido a Vista.txt',
      'documents',
      'Bienvenido a Windows Vista\n=========================\n\nUn lugar para todas tus ideas.\n\nEste escritorio es una recreación web independiente de Windows Vista. No ejecuta Windows ni programas .exe.\n\nPARA EMPEZAR\n• Haz doble clic en los iconos del escritorio.\n• Arrastra las ventanas por la barra de título.\n• Busca aplicaciones y documentos en el menú Inicio.\n• Escribe en el Bloc de notas y guarda tus archivos.\n• Personaliza el color del cristal y el fondo de escritorio.\n\nTUS ARCHIVOS\nSe guardan en este navegador mediante almacenamiento local. No se envían a ningún servidor. Descarga una copia de los documentos importantes: borrar los datos del sitio también borra estos archivos.\n\nATAJOS\nCtrl + Esc       Menú Inicio\nCtrl + Alt + D   Mostrar escritorio\nAlt + `          Cambiar de ventana\nAlt + F4         Cerrar ventana (si el navegador lo permite)\nCtrl + S         Guardar en el Bloc de notas\nF2               Cambiar nombre en el Explorador\n\nDisfruta de un pequeño viaje a 2007.\n',
    ),
    text(
      'todo',
      'Cosas por hacer.txt',
      'documents',
      'Cosas por hacer\n\n☐ Explorar Windows Vista\n☐ Elegir mi fondo de escritorio\n☐ Escribir mi primera nota\n☐ Hacer una pausa\n',
    ),
    text(
      'project-notes',
      'Ideas.txt',
      'projects',
      'Las grandes cosas comienzan con una pequeña idea.\n',
    ),
    text(
      'data-readme',
      'Acerca de esta unidad.txt',
      'd',
      'Esta unidad es una carpeta virtual. Los archivos se almacenan únicamente en tu navegador.\n',
    ),
    ...[
      ['lake', 'Muelle al atardecer'],
      ['landscape', 'Un nuevo día'],
      ['mountain', 'Lago de montaña'],
      ['night', 'Aurora boreal'],
    ].map(([asset, name], i) => ({
      id: `photo-${i}`,
      name: `${name}.jpg`,
      parent: 'pictures',
      type: 'image',
      asset: `wallpapers/${asset}.webp`,
      modified,
    })),
  ];
};

export function validFileName(name) {
  const clean = String(name).trim();
  if (
    !clean ||
    clean.length > 120 ||
    /[<>:"/\\|?*\x00-\x1f]/.test(clean) ||
    /[. ]$/.test(clean) ||
    ['.', '..'].includes(clean) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)
  ) {
    throw new Error(
      'El nombre no es válido. No uses los caracteres \\ / : * ? " < > | ni nombres reservados de Windows.',
    );
  }
  return clean;
}

export class FileSystem {
  constructor(storage) {
    this.storage = storage;
    this.listeners = new Set();
    const saved = storage.get('files.v1');
    const valid =
      saved?.version === 1 &&
      Array.isArray(saved.nodes) &&
      saved.nodes.length <= 350 &&
      saved.nodes.every(
        (n) =>
          n &&
          typeof n.id === 'string' &&
          typeof n.name === 'string' &&
          ['folder', 'text', 'image'].includes(n.type) &&
          (n.parent === null || typeof n.parent === 'string') &&
          (n.type !== 'text' || (typeof n.content === 'string' && n.content.length <= MAX_TEXT)) &&
          (n.type !== 'image' ||
            (typeof n.asset === 'string' &&
              /^wallpapers\/(lake|landscape|mountain|night)\.webp$/.test(n.asset))),
      ) &&
      new Set(saved.nodes.map((n) => n.id)).size === saved.nodes.length &&
      ['c', 'home', 'documents', 'desktop', 'pictures', 'd'].every((id) =>
        saved.nodes.some((n) => n.id === id),
      );
    this.nodes = valid ? saved.nodes : seed();
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  get(id) {
    return this.nodes.find((n) => n.id === id);
  }
  isTrashed(node) {
    let current = typeof node === 'string' ? this.get(node) : node;
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      if (current.trashed) return true;
      seen.add(current.id);
      current = this.get(current.parent);
    }
    return false;
  }
  list(parent, query = '') {
    const q = normalize(query);
    return this.nodes
      .filter((n) => (parent === 'recycle' ? n.trashed : n.parent === parent && !this.isTrashed(n)))
      .filter((n) => !q || normalize(n.name).includes(q))
      .sort(
        (a, b) =>
          (a.type === 'folder' ? 0 : 1) - (b.type === 'folder' ? 0 : 1) ||
          a.name.localeCompare(b.name, 'es', { numeric: true }),
      );
  }
  search(query) {
    const q = normalize(query);
    return q
      ? this.nodes.filter((n) => !this.isTrashed(n) && normalize(n.name).includes(q)).slice(0, 24)
      : [];
  }
  ancestors(id) {
    const result = [],
      seen = new Set();
    let node = this.get(id);
    while (node && !seen.has(node.id)) {
      result.unshift(node);
      seen.add(node.id);
      node = this.get(node.parent);
    }
    return result;
  }
  path(id) {
    return this.ancestors(id)
      .map((n) => (n.id === 'c' ? 'C:' : n.id === 'd' ? 'D:' : n.name))
      .join('\\');
  }
  uniqueName(parent, base = 'Nueva carpeta') {
    let name = base,
      i = 2;
    while (this.list(parent).some((n) => sameName(n.name, name))) name = `${base} (${i++})`;
    return name;
  }
  transaction(change) {
    const backup = structuredClone(this.nodes);
    try {
      const result = change();
      const serialized = JSON.stringify({ version: 1, nodes: this.nodes });
      if (serialized.length * 2 > MAX_BYTES || this.nodes.length > 350)
        throw new Error('El almacenamiento local está lleno. Descarga y elimina algunos archivos.');
      if (!this.storage.set('files.v1', { version: 1, nodes: this.nodes })) {
        this.storage.set('files.v1', { version: 1, nodes: backup });
        throw new Error(
          'El navegador no permite guardar más datos. Descarga una copia de tus archivos.',
        );
      }
      this.listeners.forEach((fn) => fn());
      return result;
    } catch (error) {
      this.nodes = backup;
      throw error;
    }
  }
  create(parent, name, type = 'folder', content = '') {
    name = validFileName(name);
    if (!this.get(parent) || this.get(parent).type !== 'folder' || this.isTrashed(parent))
      throw new Error('La carpeta de destino no existe.');
    if (this.list(parent).some((n) => sameName(n.name, name)))
      throw new Error('Ya existe un archivo o carpeta con ese nombre.');
    if (!['folder', 'text'].includes(type)) throw new Error('Tipo de archivo no permitido.');
    if (content.length > MAX_TEXT) throw new Error('El archivo supera el límite de 1 MB de texto.');
    return this.transaction(() => {
      const node = {
        id: uid(),
        name,
        parent,
        type,
        content: type === 'text' ? String(content) : undefined,
        modified: new Date().toISOString(),
      };
      this.nodes.push(node);
      return node;
    });
  }
  write(id, content) {
    const node = this.get(id);
    if (!node || node.type !== 'text' || this.isTrashed(node))
      throw new Error('No se encuentra el archivo. Usa Guardar como para crear otro.');
    if (String(content).length > MAX_TEXT)
      throw new Error('El archivo supera el límite de 1 MB de texto.');
    return this.transaction(() => {
      node.content = String(content);
      node.modified = new Date().toISOString();
      return node;
    });
  }
  rename(id, name) {
    const node = this.get(id);
    name = validFileName(name);
    if (!node || node.protected || this.isTrashed(node))
      throw new Error('No se puede cambiar el nombre de esta carpeta.');
    if (this.list(node.parent).some((n) => n.id !== id && sameName(n.name, name)))
      throw new Error('Ya existe un elemento con ese nombre.');
    return this.transaction(() => {
      node.name = name;
      node.modified = new Date().toISOString();
    });
  }
  trash(id) {
    const node = this.get(id);
    if (!node || node.protected) throw new Error('Esta carpeta del sistema está protegida.');
    return this.transaction(() => {
      node.trashed = true;
      node.deletedAt = new Date().toISOString();
    });
  }
  restore(id) {
    const node = this.get(id);
    if (!node?.trashed) return;
    return this.transaction(() => {
      if (this.isTrashed(node.parent) || !this.get(node.parent)) node.parent = 'documents';
      node.name = this.uniqueName(node.parent, node.name);
      delete node.trashed;
      delete node.deletedAt;
    });
  }
  emptyTrash() {
    return this.transaction(() => {
      this.nodes = this.nodes.filter((n) => !this.isTrashed(n));
    });
  }
}
