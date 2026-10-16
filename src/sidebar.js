import { $, $$, escapeHTML, asset, glyph, uid } from './utils.js';

export function clockSVG(className = '') {
  const id = uid().replace(/-/g, '').slice(0, 12);
  const marks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * Math.PI) / 30,
      big = i % 5 === 0,
      radius = big ? 43 : 46;
    return `<line x1="${64 + Math.sin(angle) * radius}" y1="${64 - Math.cos(angle) * radius}" x2="${64 + Math.sin(angle) * 49}" y2="${64 - Math.cos(angle) * 49}" stroke="${big ? '#35434a' : '#7c858a'}" stroke-width="${big ? 1.6 : 0.7}"/>`;
  }).join('');
  return `<svg class="analog-clock ${className}" width="130" height="130" viewBox="0 0 128 128" role="img" aria-label="Reloj analógico"><defs><linearGradient id="metal${id}" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset=".17" stop-color="#b8c3c9"/><stop offset=".35" stop-color="#eff4f5"/><stop offset=".65" stop-color="#87949c"/><stop offset=".85" stop-color="#d5dce0"/><stop offset="1" stop-color="#5a6974"/></linearGradient><radialGradient id="face${id}" cx=".4" cy=".3"><stop stop-color="#fff"/><stop offset=".85" stop-color="#f4f4ed"/><stop offset="1" stop-color="#cbd0ce"/></radialGradient><filter id="clockShadow${id}"><feDropShadow dy="2" stdDeviation="1" flood-opacity=".35"/></filter></defs><circle cx="64" cy="64" r="62" fill="#17262bc0"/><circle cx="64" cy="64" r="60" fill="url(#metal${id})" stroke="#f3f8ff" stroke-width=".7"/><circle cx="64" cy="64" r="54" fill="url(#face${id})" stroke="#79858d" stroke-width="1.4"/><circle cx="64" cy="64" r="51" fill="none" stroke="#fff"/>${marks}<g fill="#303c40" font-family="'Segoe UI',Selawik,Arial" font-size="11" font-weight="600" text-anchor="middle"><text x="64" y="31">12</text><text x="100" y="68">3</text><text x="64" y="105">6</text><text x="28" y="68">9</text></g><g filter="url(#clockShadow${id})"><g class="clock-hour"><path d="M62 70 61 41 64 33 67 41 66 70Z" fill="#31454f" stroke="#71838b" stroke-width=".7"/></g><g class="clock-minute"><path d="M63 73 62 25 64 19 66 25 65 73Z" fill="#253b47" stroke="#8d9da5" stroke-width=".7"/></g></g><g class="clock-second"><path d="M64 77V18" stroke="#a92a22" stroke-width="1.1"/><circle cx="64" cy="77" r="2.3" fill="#b23a2b"/></g><circle cx="64" cy="64" r="3.2" fill="#52616a" stroke="#d2dbe0" stroke-width="1"/><path d="M18 45A49 49 0 0 1 107 39Q64 17 18 45" fill="#fff" opacity=".23"/></svg>`;
}
export function updateClocks(root, date = new Date(), seconds = true) {
  const s = date.getSeconds(),
    m = date.getMinutes() + s / 60,
    h = (date.getHours() % 12) + m / 60;
  $$('.clock-hour', root).forEach((el) => el.setAttribute('transform', `rotate(${h * 30} 64 64)`));
  $$('.clock-minute', root).forEach((el) => el.setAttribute('transform', `rotate(${m * 6} 64 64)`));
  $$('.clock-second', root).forEach((el) => {
    el.style.display = seconds ? '' : 'none';
    el.setAttribute('transform', `rotate(${s * 6} 64 64)`);
  });
}

export class Sidebar {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = $('#sidebar');
    this.photoIndex = 0;
    this.playing = true;
    this.lastPhoto = Date.now();
    this.calendarOffset = 0;
    this.photos = ['landscape', 'lake', 'mountain', 'night'];
    const saved = ctx.storage.get('clock.v1', {});
    this.clockOptions = {
      name: typeof saved.name === 'string' ? saved.name.slice(0, 30) : '',
      seconds: saved.seconds !== false,
    };
    ctx.settings.subscribe((key) => {
      if (key === 'sidebar' || key === 'gadgets') this.render();
    });
    this.render();
  }
  render() {
    const { settings } = this.ctx;
    this.root.hidden = !settings.get('sidebar');
    if (this.root.hidden) return;
    this.root.innerHTML = `<div class="sidebar-tools"><button class="sidebar-add" aria-label="Agregar gadgets" title="Agregar gadgets">${glyph('plus', 13)}</button><button class="sidebar-hide" aria-label="Ocultar Sidebar" title="Ocultar Sidebar">‹</button></div><div class="sidebar-gadgets">${settings
      .get('gadgets')
      .map((name) => this.gadgetHTML(name))
      .join('')}</div>`;
    $('.sidebar-add', this.root).onclick = () => this.addGallery();
    $('.sidebar-hide', this.root).onclick = () => settings.set('sidebar', false);
    $$('.gadget-close', this.root).forEach(
      (b) =>
        (b.onclick = () =>
          settings.set(
            'gadgets',
            settings
              .get('gadgets')
              .filter((name) => name !== b.closest('[data-gadget]').dataset.gadget),
          )),
    );
    $$('.gadget-options', this.root).forEach(
      (b) => (b.onclick = () => this.options(b.closest('[data-gadget]').dataset.gadget)),
    );
    $$('.gadget-grip', this.root).forEach((b) => (b.onpointerdown = (event) => this.drag(event)));
    const previous = $('.sidebar-photo-prev', this.root),
      next = $('.sidebar-photo-next', this.root),
      play = $('.sidebar-photo-play', this.root);
    if (previous) {
      previous.onclick = () => this.changePhoto(-1);
      next.onclick = () => this.changePhoto(1);
      play.onclick = () => {
        this.playing = !this.playing;
        play.innerHTML = glyph(this.playing ? 'pause' : 'play', 12);
        play.setAttribute(
          'aria-label',
          this.playing ? 'Pausar diapositivas' : 'Reproducir diapositivas',
        );
      };
      $('.sidebar-photo-open', this.root).onclick = () =>
        this.ctx.launch('photos', { asset: `wallpapers/${this.photos[this.photoIndex]}.webp` });
    }
    if ($('.calendar-gadget', this.root)) {
      $('.gadget-calendar-prev', this.root).onclick = () => {
        this.calendarOffset--;
        this.updateCalendar();
      };
      $('.gadget-calendar-next', this.root).onclick = () => {
        this.calendarOffset++;
        this.updateCalendar();
      };
      $('.calendar-date', this.root).onclick = () => this.ctx.shell.showCalendar();
      this.updateCalendar();
    }
    const note = $('.gadget-note-text', this.root);
    if (note) {
      const text = this.ctx.storage.get(
        'gadget-note.v1',
        'No olvides disfrutar de las pequeñas cosas.',
      );
      note.value = typeof text === 'string' ? text : '';
      note.oninput = () => this.ctx.storage.set('gadget-note.v1', note.value);
    }
    this.tick(new Date());
  }
  gadgetHTML(name) {
    const content =
      name === 'clock'
        ? `${clockSVG()}${this.clockOptions.name ? `<div class="clock-label">${escapeHTML(this.clockOptions.name)}</div>` : ''}`
        : name === 'photos'
          ? `<div class="slideshow-frame"><button class="sidebar-photo-open" aria-label="Abrir fotografía"><img src="${asset(`thumbnails/${this.photos[this.photoIndex]}.webp`)}" alt="Fotografía de muestra"></button><div class="slideshow-controls"><button class="sidebar-photo-prev" aria-label="Diapositiva anterior">${glyph('back', 12)}</button><button class="sidebar-photo-play" aria-label="${this.playing ? 'Pausar' : 'Reproducir'} diapositivas">${glyph(this.playing ? 'pause' : 'play', 12)}</button><button class="sidebar-photo-next" aria-label="Diapositiva siguiente">${glyph('forward', 12)}</button></div></div>`
          : name === 'calendar'
            ? '<div class="calendar-gadget"><div class="gadget-calendar-top"><button class="gadget-calendar-prev" aria-label="Mes anterior">‹</button><span class="gadget-calendar-weekday"></span><button class="gadget-calendar-next" aria-label="Mes siguiente">›</button></div><button class="calendar-date" title="Ver calendario"><strong></strong><span></span></button><div class="gadget-calendar-year"></div></div>'
            : '<div class="notes-gadget"><textarea class="gadget-note-text" maxlength="2000" aria-label="Nota del gadget"></textarea></div>';
    const label = {
      clock: 'Reloj',
      photos: 'Presentación',
      calendar: 'Calendario',
      notes: 'Notas',
    }[name];
    return `<section class="gadget gadget-${name}" data-gadget="${name}" aria-label="${label}"><div class="gadget-content">${content}</div><div class="gadget-tools"><button class="gadget-close" aria-label="Cerrar gadget ${label}" title="Cerrar">×</button><button class="gadget-options" aria-label="Opciones de ${label}" title="Opciones">⌁</button><button class="gadget-grip" aria-label="Mover gadget ${label}" title="Arrastrar para mover">⠿</button></div></section>`;
  }
  tick(date) {
    if (this.root.hidden) return;
    updateClocks(this.root, date, this.clockOptions.seconds);
    if (Date.now() - this.lastPhoto >= 10000 && this.playing && !document.hidden) {
      this.changePhoto(1);
      this.lastPhoto = Date.now();
    }
    if (this.lastDay !== date.toDateString()) {
      this.lastDay = date.toDateString();
      this.updateCalendar();
    }
  }
  changePhoto(step) {
    this.photoIndex = (this.photoIndex + step + this.photos.length) % this.photos.length;
    const img = $('.sidebar-photo-open img', this.root);
    if (img) img.src = asset(`thumbnails/${this.photos[this.photoIndex]}.webp`);
    this.lastPhoto = Date.now();
  }
  updateCalendar() {
    const el = $('.calendar-gadget', this.root);
    if (!el) return;
    const now = new Date(),
      date = new Date(
        now.getFullYear(),
        now.getMonth() + this.calendarOffset,
        this.calendarOffset ? 1 : now.getDate(),
      );
    $('.gadget-calendar-weekday', el).textContent = date.toLocaleDateString('es-ES', {
      weekday: 'long',
    });
    $('.calendar-date strong', el).textContent = date.getDate();
    $('.calendar-date span', el).textContent = date.toLocaleDateString('es-ES', { month: 'long' });
    $('.gadget-calendar-year', el).textContent = date.getFullYear();
  }
  async options(name) {
    const { ui, storage, settings } = this.ctx;
    if (name === 'clock') {
      const result = await ui.dialog({
        title: 'Reloj',
        width: 370,
        body: `<label class="field-label">Nombre del reloj:<input class="vista-input" name="name" maxlength="30" value="${escapeHTML(this.clockOptions.name)}"></label><label><input type="checkbox" name="seconds" ${this.clockOptions.seconds ? 'checked' : ''}> Mostrar segundero</label>`,
        buttons: [
          { label: 'Aceptar', value: 'ok', primary: true },
          { label: 'Cancelar', value: 'cancel' },
        ],
      });
      if (result.action === 'ok') {
        this.clockOptions = { name: result.values.name, seconds: !!result.values.seconds };
        storage.set('clock.v1', this.clockOptions);
        this.render();
      }
    } else if (name === 'photos') this.ctx.launch('photos');
    else if (name === 'calendar') {
      this.calendarOffset = 0;
      this.updateCalendar();
    } else
      ui.alert(
        'Esta nota se guarda automáticamente en este navegador. Puede escribir hasta 2.000 caracteres.',
        'Notas',
      );
  }
  async addGallery() {
    const names = {
      clock: ['Reloj', 'reloj'],
      photos: ['Presentación', 'fotografías'],
      calendar: ['Calendario', 'fecha'],
      notes: ['Notas', 'nota'],
    };
    await this.ctx.ui.dialog({
      title: 'Galería de gadgets',
      width: 500,
      body: `<h3>Agregue gadgets a Windows Sidebar</h3><div class="gadget-gallery">${Object.entries(
        names,
      )
        .map(
          ([key, [label]]) =>
            `<button type="button" data-add-gadget="${key}" ${this.ctx.settings.get('gadgets').includes(key) ? 'disabled' : ''}><span class="gadget-gallery-preview preview-${key}">${key === 'clock' ? clockSVG() : key === 'calendar' ? '16' : key === 'notes' ? 'Aa' : `<img src="${asset('thumbnails/lake.webp')}" alt="">`}</span><strong>${label}</strong><small>${this.ctx.settings.get('gadgets').includes(key) ? 'Agregado' : 'Agregar'}</small></button>`,
        )
        .join('')}</div><p>Gadgets locales. No se ejecutan gadgets externos de Windows.</p>`,
      onMount: (dialog) => {
        $$('[data-add-gadget]', dialog).forEach(
          (b) =>
            (b.onclick = () => {
              const list = this.ctx.settings.get('gadgets');
              if (!list.includes(b.dataset.addGadget))
                this.ctx.settings.set('gadgets', [...list, b.dataset.addGadget]);
              this.ctx.settings.set('sidebar', true);
              b.disabled = true;
              $('small', b).textContent = 'Agregado';
            }),
        );
        updateClocks(dialog);
      },
    });
  }
  drag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget,
      gadget = target.closest('.gadget'),
      startY = event.clientY;
    let delta = 0;
    target.setPointerCapture(event.pointerId);
    gadget.classList.add('gadget-dragging');
    const move = (e) => {
      delta = e.clientY - startY;
      gadget.style.transform = `translateY(${delta}px)`;
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      const gadgets = $$('.gadget', this.root);
      const center = gadget.getBoundingClientRect().top + gadget.offsetHeight / 2;
      const others = gadgets.filter((g) => g !== gadget);
      const index = others.findIndex(
        (g) => center < g.getBoundingClientRect().top + g.offsetHeight / 2,
      );
      const order = others.map((g) => g.dataset.gadget);
      order.splice(index === -1 ? order.length : index, 0, gadget.dataset.gadget);
      this.ctx.settings.set('gadgets', order);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }
}
