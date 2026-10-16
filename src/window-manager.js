import { $, $$, icon, glyph, clamp, uid, announce } from './utils.js';

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export class WindowManager {
  constructor(ui, settings) {
    this.ui = ui;
    this.settings = settings;
    this.windows = new Map();
    this.activeId = null;
    this.z = 20;
    this.listeners = new Set();
    this.cascade = 0;
    this.layer = $('#window-layer');
    this.desktop = $('#desktop');
    window.addEventListener('resize', () => this.fitAll());
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.listeners.forEach((fn) => fn());
  }
  get active() {
    return this.windows.get(this.activeId);
  }
  area() {
    return { width: this.desktop.clientWidth, height: this.desktop.clientHeight };
  }
  get reducedMotion() {
    return (
      this.settings.get('reducedMotion') || matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
  create(
    appId,
    {
      title,
      icon: iconName,
      width = 740,
      height = 500,
      minWidth = 340,
      minHeight = 220,
      x,
      y,
      resizable = true,
      maximizable = true,
      className = '',
    } = {},
  ) {
    if (this.windows.size >= 40) {
      this.ui.alert('Cierra algunas ventanas antes de abrir más aplicaciones.');
      return null;
    }
    const area = this.area(),
      offset = (this.cascade++ % 7) * 24;
    const sidebarSpace = area.width > 1050 && this.settings.get('sidebar') ? 165 : 0;
    const rect = {
      width: Math.min(width, area.width - 12),
      height: Math.min(height, area.height - 16),
      x: x ?? Math.max(12, Math.round((area.width - sidebarSpace - width) / 2) + offset),
      y: y ?? Math.max(12, Math.round((area.height - height) / 2) - 20 + offset),
    };
    rect.x = clamp(rect.x, 0, area.width - rect.width);
    rect.y = clamp(rect.y, 0, area.height - rect.height);
    const id = `window-${uid()}`;
    const el = document.createElement('section');
    el.id = id;
    el.className = `aero-window glass ${className}`;
    el.tabIndex = -1;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-labelledby', `${id}-title`);
    el.dataset.app = appId;
    el.innerHTML = `<div class="aero-frame-blur" aria-hidden="true"><i></i><i></i><i></i><i></i></div><header class="titlebar"><button class="window-icon-button" aria-label="Menu de la ventana" title="Menú de la ventana">${icon(iconName, '', 16)}</button><span class="window-title" id="${id}-title"></span><div class="caption-buttons"><button class="caption-button minimize" data-caption="minimize" aria-label="Minimizar" title="Minimizar">${glyph('min', 12)}</button><button class="caption-button maximize" data-caption="maximize" aria-label="Maximizar" title="Maximizar" ${!maximizable ? 'disabled' : ''}>${glyph('max', 12)}</button><button class="caption-button close" data-caption="close" aria-label="Cerrar" title="Cerrar">${glyph('close', 13)}</button></div></header><div class="window-body"></div>${resizable ? EDGES.map((edge) => `<span class="resize-handle resize-${edge}" data-edge="${edge}" aria-hidden="true"></span>`).join('') : ''}`;
    const win = {
      id,
      appId,
      title,
      icon: iconName,
      el,
      body: $('.window-body', el),
      titlebar: $('.titlebar', el),
      rect,
      minWidth: Math.min(minWidth, area.width - 12),
      minHeight: Math.min(minHeight, area.height - 16),
      resizable,
      maximizable,
      preferredMinWidth: minWidth,
      preferredMinHeight: minHeight,
      state: 'normal',
      restoreRect: null,
      minimized: false,
      z: 0,
      cleanup: [],
      onBeforeClose: null,
      onKeydown: null,
    };
    win.setTitle = (value) => {
      win.title = String(value);
      $('.window-title', el).textContent = win.title;
      this.emit();
    };
    win.focus = () => this.focus(id);
    win.close = () => this.close(id);
    win.minimize = () => this.minimize(id);
    win.maximize = () => this.toggleMaximize(id);
    win.setSize = (w, h) => {
      const a = this.area();
      win.rect.width = clamp(w, win.minWidth, a.width);
      win.rect.height = clamp(h, win.minHeight, a.height);
      this.applyRect(win);
    };
    win.setTitle(title);
    el.addEventListener('pointerdown', () => this.focus(id), { capture: true });
    el.addEventListener('focusin', () => this.focus(id, false));
    el.addEventListener('keydown', (event) => {
      if (!event.defaultPrevented) win.onKeydown?.(event);
    });
    win.titlebar.addEventListener('pointerdown', (event) => this.beginMove(event, win));
    win.titlebar.addEventListener('dblclick', (event) => {
      if (!event.target.closest('button') && maximizable) this.toggleMaximize(id);
    });
    win.titlebar.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.systemMenu(win, event.clientX, event.clientY);
    });
    $('.window-icon-button', el).onclick = (event) => {
      const r = event.currentTarget.getBoundingClientRect();
      this.systemMenu(win, r.left, r.bottom);
    };
    $('.window-icon-button', el).ondblclick = () => this.close(id);
    $$('[data-caption]', el).forEach((button) => {
      button.addEventListener('pointerdown', (event) => event.stopPropagation());
      button.onclick = (event) => {
        event.stopPropagation();
        if (button.dataset.caption === 'close') this.close(id);
        else if (button.dataset.caption === 'minimize') this.minimize(id);
        else this.toggleMaximize(id);
      };
    });
    $$('[data-edge]', el).forEach((handle) =>
      handle.addEventListener('pointerdown', (event) =>
        this.beginResize(event, win, handle.dataset.edge),
      ),
    );
    this.windows.set(id, win);
    this.layer.append(el);
    this.applyRect(win);
    this.focus(id);
    announce(`${title} abierto`);
    return win;
  }
  applyRect(win) {
    const r = win.rect;
    win.el.style.transform = `translate3d(${Math.round(r.x)}px, ${Math.round(r.y)}px, 0)`;
    win.el.style.width = `${Math.round(r.width)}px`;
    win.el.style.height = `${Math.round(r.height)}px`;
    win.el.dataset.state = win.state;
  }
  focus(id, moveFocus = true) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.minimized) {
      this.restore(id);
      return;
    }
    if (this.activeId !== id) {
      this.active?.el.classList.remove('active');
      this.activeId = id;
      win.el.classList.add('active');
      win.z = ++this.z;
      win.el.style.zIndex = win.z;
      if (this.z > 8000) {
        [...this.windows.values()]
          .sort((a, b) => a.z - b.z)
          .forEach((w, i) => {
            w.z = 20 + i;
            w.el.style.zIndex = w.z;
          });
        this.z = 20 + this.windows.size;
      }
      this.emit();
    }
    if (moveFocus && !win.el.contains(document.activeElement))
      win.el.focus({ preventScroll: true });
  }
  focusNext() {
    const next = [...this.windows.values()]
      .filter((w) => !w.minimized)
      .sort((a, b) => b.z - a.z)[0];
    if (next) this.focus(next.id);
    else {
      this.activeId = null;
      this.desktop.focus({ preventScroll: true });
      this.emit();
    }
  }
  beginMove(event, win) {
    if (event.button !== 0 || event.target.closest('button') || win.state === 'maximized') return;
    event.preventDefault();
    this.ui.closeMenus();
    this.pointerOperation(
      event,
      win,
      (dx, dy, initial) => {
        const area = this.area();
        win.rect.x = clamp(initial.x + dx, -initial.width + 100, area.width - 100);
        win.rect.y = clamp(initial.y + dy, 0, area.height - 35);
      },
      'moving',
    );
  }
  beginResize(event, win, edge) {
    if (event.button !== 0 || win.state === 'maximized') return;
    event.preventDefault();
    event.stopPropagation();
    this.focus(win.id);
    this.ui.closeMenus();
    this.pointerOperation(
      event,
      win,
      (dx, dy, initial) => {
        const area = this.area();
        let { x, y, width, height } = initial;
        if (edge.includes('e'))
          width = clamp(initial.width + dx, win.minWidth, area.width - initial.x);
        if (edge.includes('s'))
          height = clamp(initial.height + dy, win.minHeight, area.height - initial.y);
        if (edge.includes('w')) {
          width = clamp(initial.width - dx, win.minWidth, initial.width + initial.x);
          x = initial.x + initial.width - width;
        }
        if (edge.includes('n')) {
          height = clamp(initial.height - dy, win.minHeight, initial.height + initial.y);
          y = initial.y + initial.height - height;
        }
        win.rect = { x, y, width, height };
      },
      'resizing',
    );
  }
  pointerOperation(event, win, update, type) {
    const target = event.currentTarget,
      initial = { ...win.rect },
      startX = event.clientX,
      startY = event.clientY;
    let lastX = startX,
      lastY = startY,
      frame = 0,
      finished = false;
    target.setPointerCapture(event.pointerId);
    win.el.classList.add(type);
    document.body.classList.add('pointer-operation');
    win.el.style.willChange = 'transform';
    const draw = () => {
      frame = 0;
      update(lastX - startX, lastY - startY, initial);
      this.applyRect(win);
    };
    const move = (e) => {
      if (e.pointerId !== event.pointerId) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const finish = (e) => {
      if (finished || (e.pointerId !== undefined && e.pointerId !== event.pointerId)) return;
      finished = true;
      if (frame) cancelAnimationFrame(frame);
      draw();
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);
      target.removeEventListener('lostpointercapture', finish);
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      win.el.classList.remove(type);
      win.el.style.willChange = '';
      document.body.classList.remove('pointer-operation');
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
    target.addEventListener('lostpointercapture', finish);
  }
  toggleMaximize(id) {
    const win = this.windows.get(id);
    if (!win?.maximizable) return;
    if (win.minimized) this.restore(id);
    if (win.state === 'maximized') {
      win.state = 'normal';
      win.rect = { ...win.restoreRect };
    } else {
      win.restoreRect = { ...win.rect };
      win.state = 'maximized';
      const area = this.area();
      win.rect = { x: 0, y: 0, width: area.width, height: area.height };
    }
    win.el.classList.toggle('maximized', win.state === 'maximized');
    const button = $('[data-caption="maximize"]', win.el);
    button.innerHTML = glyph(win.state === 'maximized' ? 'restore' : 'max', 12);
    button.setAttribute('aria-label', win.state === 'maximized' ? 'Restaurar' : 'Maximizar');
    button.title = button.getAttribute('aria-label');
    if (!this.reducedMotion) {
      win.el.classList.add('geometry-animation');
      setTimeout(() => win.el.classList.remove('geometry-animation'), 170);
    }
    this.applyRect(win);
    this.focus(id);
    this.emit();
  }
  taskTarget(win) {
    const button = $(`.task-button[data-app="${win.appId}"]`);
    const r = button?.getBoundingClientRect();
    return { x: r?.x ?? 80, y: r?.y ?? innerHeight - 20 };
  }
  minimize(id) {
    const win = this.windows.get(id);
    if (!win || win.minimized) return;
    this.ui.closeMenus();
    win.minimized = true;
    win.el.inert = true;
    win.el.classList.remove('active');
    const finish = () => {
      if (win.minimized) win.el.hidden = true;
    };
    if (!this.reducedMotion) {
      const target = this.taskTarget(win);
      win.el.getAnimations().forEach((a) => a.cancel());
      win.el
        .animate(
          [
            { opacity: 1, transform: win.el.style.transform },
            { opacity: 0, transform: `translate3d(${target.x}px,${target.y}px,0) scale(.12,.06)` },
          ],
          { duration: 150, easing: 'cubic-bezier(.4,0,.7,1)' },
        )
        .finished.then(finish)
        .catch(() => {});
    } else finish();
    if (this.activeId === id) {
      this.activeId = null;
      this.focusNext();
    }
    this.emit();
  }
  restore(id) {
    const win = this.windows.get(id);
    if (!win) return;
    const wasMinimized = win.minimized;
    win.minimized = false;
    win.el.hidden = false;
    win.el.inert = false;
    win.el.getAnimations().forEach((a) => a.cancel());
    if (wasMinimized && !this.reducedMotion) {
      const target = this.taskTarget(win);
      win.el.animate(
        [
          { opacity: 0, transform: `translate3d(${target.x}px,${target.y}px,0) scale(.12,.06)` },
          { opacity: 1, transform: win.el.style.transform },
        ],
        { duration: 160, easing: 'cubic-bezier(.1,.7,.2,1)' },
      );
    }
    this.focus(id);
    this.emit();
  }
  async close(id) {
    const win = this.windows.get(id);
    if (!win || win.closing) return;
    win.closing = true;
    try {
      if (win.onBeforeClose && !(await win.onBeforeClose())) return false;
    } catch (error) {
      await this.ui.alert(error.message, win.title, 'warning');
      return false;
    } finally {
      win.closing = false;
    }
    win.cleanup.forEach((fn) => fn());
    win.el.remove();
    this.windows.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
      this.focusNext();
    }
    this.ui.closeMenus();
    this.emit();
    announce(`${win.title} cerrado`);
    return true;
  }
  systemMenu(win, x, y) {
    this.ui.showMenu(
      [
        {
          label: 'Restaurar',
          icon: 'run',
          disabled: !win.minimized && win.state !== 'maximized',
          action: () => {
            if (win.minimized) this.restore(win.id);
            else this.toggleMaximize(win.id);
          },
        },
        {
          label: 'Mover',
          disabled: win.state === 'maximized' || win.minimized,
          action: () => this.keyboardMove(win),
        },
        {
          label: 'Tamaño',
          disabled: !win.resizable || win.state === 'maximized' || win.minimized,
          action: () => this.keyboardMove(win, true),
        },
        { label: 'Minimizar', disabled: win.minimized, action: () => this.minimize(win.id) },
        {
          label: 'Maximizar',
          disabled: !win.maximizable || win.state === 'maximized',
          action: () => this.toggleMaximize(win.id),
        },
        { separator: true },
        { label: 'Cerrar', bold: true, shortcut: 'Alt+F4', action: () => this.close(win.id) },
      ],
      x,
      y,
      { label: 'Ventana' },
    );
  }
  keyboardMove(win, resize = false) {
    win.cancelKeyboardOperation?.();
    const original = { ...win.rect };
    this.focus(win.id);
    announce('Usa las flechas para mover la ventana. Entrar confirma; Escape cancela.');
    const handler = (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Escape') {
          win.rect = original;
          this.applyRect(win);
        }
        stop();
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const step = event.ctrlKey ? 1 : 10;
        const a = this.area();
        if (resize) {
          win.rect.width = clamp(
            win.rect.width +
              (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
            win.minWidth,
            a.width - win.rect.x,
          );
          win.rect.height = clamp(
            win.rect.height +
              (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
            win.minHeight,
            a.height - win.rect.y,
          );
        } else {
          win.rect.x = clamp(
            win.rect.x +
              (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
            0,
            a.width - 100,
          );
          win.rect.y = clamp(
            win.rect.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
            0,
            a.height - 35,
          );
        }
        this.applyRect(win);
      }
    };
    const stop = () => {
      document.removeEventListener('keydown', handler, true);
      win.cleanup = win.cleanup.filter((fn) => fn !== stop);
      delete win.cancelKeyboardOperation;
    };
    win.cancelKeyboardOperation = stop;
    win.cleanup.push(stop);
    document.addEventListener('keydown', handler, true);
  }
  fitAll() {
    const a = this.area();
    this.windows.forEach((win) => {
      win.minWidth = Math.min(win.preferredMinWidth, a.width - 8);
      win.minHeight = Math.min(win.preferredMinHeight, a.height - 8);
      if (win.state === 'maximized') win.rect = { x: 0, y: 0, width: a.width, height: a.height };
      else {
        win.rect.width = Math.min(win.rect.width, a.width - 8);
        win.rect.height = Math.min(win.rect.height, a.height - 8);
        win.rect.x = clamp(win.rect.x, -win.rect.width + 100, a.width - 100);
        win.rect.y = clamp(win.rect.y, 0, a.height - 35);
      }
      this.applyRect(win);
    });
  }
  showDesktop() {
    const visible = [...this.windows.values()].filter((w) => !w.minimized);
    if (visible.length) {
      this.desktopRestore = visible.map((w) => w.id);
      visible.forEach((w) => this.minimize(w.id));
    } else {
      (this.desktopRestore ?? []).forEach((id) => this.restore(id));
      this.desktopRestore = [];
    }
  }
  cycle() {
    const windows = [...this.windows.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (!windows.length) return;
    const index = windows.findIndex((w) => w.id === this.activeId);
    this.restore(windows[(index + 1) % windows.length].id);
  }
}
