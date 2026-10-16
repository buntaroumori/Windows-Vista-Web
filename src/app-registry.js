import { openWelcome } from './apps/welcome.js';
import { openExplorer } from './apps/explorer.js';
import { openNotepad } from './apps/notepad.js';
import { openCalculator } from './apps/calculator.js';
import { openBrowser } from './apps/browser.js';
import { openSettings } from './apps/settings.js';
import { openPhotos } from './apps/photos.js';
import { openPaint } from './apps/paint.js';
import { openGames } from './apps/games.js';

export const APPS = [
  {
    id: 'welcome',
    name: 'Centro de bienvenida',
    icon: 'control',
    keywords: 'bienvenida inicio windows welcome',
    description: 'Primeros pasos con Windows Vista',
    singleton: true,
    open: openWelcome,
  },
  {
    id: 'browser',
    name: 'Internet Explorer',
    icon: 'internet',
    keywords: 'internet web navegador explorer ie msn live',
    description: 'Páginas locales y acceso a sitios web',
    open: openBrowser,
  },
  {
    id: 'explorer',
    name: 'Explorador de Windows',
    icon: 'computer',
    keywords: 'equipo pc archivos carpetas documentos mi pc explorer',
    description: 'Organizar los archivos y carpetas',
    open: openExplorer,
  },
  {
    id: 'notepad',
    name: 'Bloc de notas',
    icon: 'notepad',
    keywords: 'notepad notas texto escribir editor',
    description: 'Crear y editar documentos de texto',
    open: openNotepad,
  },
  {
    id: 'calculator',
    name: 'Calculadora',
    icon: 'calculator',
    keywords: 'calc numeros cuentas calculator',
    description: 'Realizar cálculos con el teclado o el ratón',
    open: openCalculator,
  },
  {
    id: 'paint',
    name: 'Paint',
    icon: 'paint',
    keywords: 'pintura dibujo imagen pincel',
    description: 'Dibujar, pintar y guardar imágenes',
    singleton: true,
    open: openPaint,
  },
  {
    id: 'photos',
    name: 'Galería fotográfica de Windows',
    icon: 'pictures',
    keywords: 'fotos fotografias imagenes galeria photo',
    description: 'Ver imágenes y presentaciones',
    open: openPhotos,
  },
  {
    id: 'games',
    name: 'Buscaminas',
    icon: 'games',
    keywords: 'juegos minas buscaminas minesweeper',
    description: 'Encontrar todas las casillas seguras',
    singleton: true,
    open: openGames,
  },
  {
    id: 'settings',
    name: 'Panel de control',
    icon: 'control',
    keywords: 'configuracion personalizar personalizacion apariencia color fondo sistema ajustes',
    description: 'Personalizar la apariencia del escritorio',
    singleton: true,
    open: openSettings,
  },
];

export function registerApps(ctx) {
  ctx.apps = APPS;
  ctx.launch = (id, data = {}) => {
    const app = APPS.find((a) => a.id === id);
    if (!app) {
      ctx.ui.alert('No se encuentra esta aplicación en el escritorio virtual.');
      return null;
    }
    let existing = app.singleton ? [...ctx.wm.windows.values()].find((w) => w.appId === id) : null;
    if (id === 'notepad' && data.fileId && !data.forceNew)
      existing = [...ctx.wm.windows.values()].find(
        (w) => w.appId === 'notepad' && w.fileId === data.fileId,
      );
    if (existing) {
      ctx.wm.restore(existing.id);
      if (id === 'settings' && data.page) existing.navigate?.(data.page);
      return existing;
    }
    ctx.shell?.hideStart();
    ctx.ui.closeMenus();
    ctx.shell?.closeFlyout();
    const win = app.open(ctx, data);
    if (win && !data.startup) {
      let recent = ctx.storage.get('recent-apps.v1', []);
      if (!Array.isArray(recent)) recent = [];
      ctx.storage.set('recent-apps.v1', [id, ...recent.filter((a) => a !== id)].slice(0, 9));
      ctx.audio?.play('open');
    }
    return win;
  };
  ctx.openFile = (node) => {
    if (!node || ctx.fs.isTrashed(node)) return;
    return node.type === 'folder'
      ? ctx.launch('explorer', { path: node.id })
      : node.type === 'image'
        ? ctx.launch('photos', { fileId: node.id })
        : ctx.launch('notepad', { fileId: node.id });
  };
}
