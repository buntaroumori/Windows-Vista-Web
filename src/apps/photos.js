import { $, $$, asset, escapeHTML, glyph, icon, download } from '../utils.js';

export function openPhotos(ctx, data = {}) {
  const { wm, ui, fs } = ctx;
  const win = wm.create('photos', {
    title: 'Galería fotográfica de Windows',
    icon: 'pictures',
    width: 830,
    height: 578,
    minWidth: 450,
    minHeight: 310,
    className: 'photos-app',
  });
  if (!win) return;
  let images = fs.nodes.filter((n) => n.type === 'image' && !fs.isTrashed(n));
  let index = Math.max(
      0,
      images.findIndex((n) => n.id === data.fileId || n.asset === data.asset),
    ),
    rotation = 0,
    zoom = 1,
    slideshow = false,
    grid = !data.fileId && !data.asset;
  let timer;
  win.body.innerHTML = `<div class="app-toolbar"><button class="toolbar-button photo-file">Archivo ▾</button><button class="toolbar-button photo-gallery">${icon('pictures', '', 17)}Galería</button><button class="toolbar-button photo-info">Información</button><span class="toolbar-spacer"></span><button class="toolbar-button photo-help" aria-label="Ayuda">${icon('help', '', 16)}</button></div><div class="photo-stage"><div class="photo-grid"></div><div class="photo-image-wrap"><img class="photo-main" alt=""></div><aside class="photo-information" hidden></aside></div><div class="photo-controls"><span class="photo-counter"></span><div class="photo-navigation"><button class="photo-prev" title="Imagen anterior" aria-label="Imagen anterior">${glyph('back', 17)}</button><button class="photo-play" title="Presentación" aria-label="Iniciar presentación">${glyph('play', 21)}</button><button class="photo-next" title="Imagen siguiente" aria-label="Imagen siguiente">${glyph('forward', 17)}</button></div><div class="photo-adjust"><button class="photo-rotate" title="Girar a la derecha" aria-label="Girar a la derecha">↻</button><button class="photo-fit" title="Ajustar imagen" aria-label="Ajustar imagen">${glyph('fullscreen', 16)}</button><input type="range" min="50" max="200" value="100" aria-label="Zoom de imagen" class="photo-zoom"></div></div><footer class="app-status"><span class="photo-name"></span><span class="status-spacer"></span><span>Fotografías de muestra de Windows Vista</span></footer>`;
  const image = $('.photo-main', win.body),
    wrap = $('.photo-image-wrap', win.body),
    gridEl = $('.photo-grid', win.body);
  function layout() {
    if (!image.naturalWidth || grid) return;
    const turned = rotation % 180 !== 0,
      w = turned ? image.naturalHeight : image.naturalWidth,
      h = turned ? image.naturalWidth : image.naturalHeight;
    const factor = Math.min((wrap.clientWidth - 40) / w, (wrap.clientHeight - 36) / h, 1.3) * zoom;
    image.style.width = `${image.naturalWidth * factor}px`;
    image.style.height = `${image.naturalHeight * factor}px`;
    image.style.transform = `rotate(${rotation}deg)`;
  }
  function render() {
    const node = images[index];
    gridEl.hidden = !grid;
    wrap.hidden = grid;
    $('.photo-controls', win.body).classList.toggle('is-grid', grid);
    if (!node) {
      gridEl.hidden = false;
      wrap.hidden = true;
      gridEl.innerHTML = '<div class="empty-state">No hay fotografías en esta galería.</div>';
      $('.photo-name', win.body).textContent = 'Sin imágenes';
      return;
    }
    if (grid) {
      gridEl.innerHTML = `<h2>Imágenes y vídeos</h2><div>${images.map((n, i) => `<button data-index="${i}"><span><img src="${asset(n.asset)}" alt="" loading="lazy"></span><strong>${escapeHTML(n.name.replace(/\.jpg$/, ''))}</strong></button>`).join('')}</div>`;
      $$('[data-index]', gridEl).forEach(
        (b) =>
          (b.ondblclick = () => {
            index = Number(b.dataset.index);
            grid = false;
            render();
          }),
      );
      $$('[data-index]', gridEl).forEach(
        (b) =>
          (b.onclick = () => {
            $$('[data-index]', gridEl).forEach((x) => x.classList.toggle('selected', x === b));
            index = Number(b.dataset.index);
            $('.photo-name', win.body).textContent = images[index].name;
          }),
      );
      win.setTitle('Galería fotográfica de Windows');
    } else {
      image.src = asset(node.asset);
      image.alt = node.name;
      win.setTitle(`${node.name} - Galería fotográfica de Windows`);
      layout();
    }
    $('.photo-information', win.body).innerHTML =
      `<h3>${escapeHTML(node.name)}</h3><p>Imagen de muestra</p><p>Ubicación: Imágenes</p><p>Fecha: ${new Date(node.modified).toLocaleDateString('es-ES')}</p><p>Los giros y el zoom son solo de visualización.</p>`;
    $('.photo-counter', win.body).textContent = `${index + 1} de ${images.length}`;
    $('.photo-name', win.body).textContent = node.name;
  }
  function next(step) {
    if (!images.length) return;
    index = (index + step + images.length) % images.length;
    grid = false;
    rotation = 0;
    zoom = 1;
    $('.photo-zoom', win.body).value = '100';
    render();
  }
  function toggleSlide() {
    slideshow = !slideshow;
    clearInterval(timer);
    grid = false;
    $('.photo-play', win.body).innerHTML = glyph(slideshow ? 'pause' : 'play', 21);
    $('.photo-play', win.body).setAttribute(
      'aria-label',
      slideshow ? 'Pausar presentación' : 'Iniciar presentación',
    );
    if (slideshow)
      timer = setInterval(() => {
        if (!document.hidden && !win.minimized) next(1);
      }, 4000);
    render();
  }
  image.onload = layout;
  $('.photo-prev', win.body).onclick = () => next(-1);
  $('.photo-next', win.body).onclick = () => next(1);
  $('.photo-play', win.body).onclick = toggleSlide;
  $('.photo-gallery', win.body).onclick = () => {
    grid = true;
    if (slideshow) toggleSlide();
    grid = true;
    render();
  };
  $('.photo-rotate', win.body).onclick = () => {
    grid = false;
    rotation = (rotation + 90) % 360;
    render();
  };
  $('.photo-fit', win.body).onclick = () => {
    zoom = 1;
    $('.photo-zoom', win.body).value = '100';
    layout();
  };
  $('.photo-zoom', win.body).oninput = (event) => {
    grid = false;
    zoom = Number(event.target.value) / 100;
    render();
  };
  $('.photo-info', win.body).onclick = () => {
    const info = $('.photo-information', win.body);
    info.hidden = !info.hidden;
    layout();
  };
  $('.photo-help', win.body).onclick = () => ctx.launch('browser', { url: 'vista://ayuda' });
  $('.photo-file', win.body).onclick = (event) => {
    const r = event.currentTarget.getBoundingClientRect();
    ui.showMenu(
      [
        {
          label: 'Abrir carpeta de imágenes',
          icon: 'pictures',
          action: () => ctx.launch('explorer', { path: 'pictures' }),
        },
        {
          label: 'Descargar imagen',
          disabled: !images.length,
          action: async () => {
            const n = images[index];
            const response = await fetch(asset(n.asset));
            if (response.ok) download(n.name.replace(/\.jpg$/, '.webp'), await response.blob());
          },
        },
        { separator: true },
        { label: 'Cerrar', action: () => win.close() },
      ],
      r.left,
      r.bottom,
    );
  };
  win.onKeydown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      next(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      next(1);
    } else if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      toggleSlide();
    }
  };
  const observer = new ResizeObserver(layout);
  observer.observe(wrap);
  win.cleanup.push(
    () => {
      observer.disconnect();
      clearInterval(timer);
    },
    fs.subscribe(() => {
      const id = images[index]?.id;
      images = fs.nodes.filter((n) => n.type === 'image' && !fs.isTrashed(n));
      index = Math.max(
        0,
        images.findIndex((n) => n.id === id),
      );
      render();
    }),
  );
  render();
  return win;
}
