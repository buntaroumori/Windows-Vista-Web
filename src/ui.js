import { $, $$, escapeHTML, icon, glyph, announce } from './utils.js';

export class UI {
  constructor() {
    this.menus = [];
    this.returnFocus = null;
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (
          this.menus.length &&
          !event.target.closest('.context-menu, .menubar, [data-menu-owner]')
        )
          this.closeMenus();
      },
      true,
    );
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.menus.length) {
        event.preventDefault();
        this.closeMenus(true);
      }
    });
  }
  closeMenus(restoreFocus = false) {
    this.menus.forEach((menu) => {
      menu.dispose?.();
      menu.onClose?.();
      menu.el.remove();
    });
    this.menus = [];
    if (restoreFocus) this.returnFocus?.focus?.({ preventScroll: true });
  }
  showMenu(items, x, y, options = {}) {
    if (!options.parent) {
      this.closeMenus();
      this.returnFocus = options.owner ?? document.activeElement;
    } else {
      const index = this.menus.findIndex((m) => m.el === options.parent);
      this.menus.splice(index + 1).forEach((m) => {
        m.dispose?.();
        m.el.remove();
      });
    }
    const el = document.createElement('div');
    el.className = `context-menu ${options.className || ''}`;
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', options.label || 'Menú');
    const menu = { el, onClose: options.onClose };
    this.menus.push(menu);
    let submenuTimer;
    menu.dispose = () => clearTimeout(submenuTimer);
    items.filter(Boolean).forEach((item) => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        sep.setAttribute('role', 'separator');
        el.append(sep);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `context-item ${item.bold ? 'default-action' : ''}`;
      button.setAttribute('role', item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem');
      if (item.checked !== undefined) button.setAttribute('aria-checked', String(!!item.checked));
      button.disabled = !!item.disabled;
      button.innerHTML = `<span class="context-icon">${item.checked ? glyph('check', 13) : item.icon ? icon(item.icon, '', 16) : ''}</span><span class="context-label">${escapeHTML(item.label)}</span>${item.shortcut ? `<span class="context-shortcut">${escapeHTML(item.shortcut)}</span>` : ''}${item.submenu ? '<span class="context-arrow">▸</span>' : ''}`;
      if (item.submenu) {
        button.setAttribute('aria-haspopup', 'menu');
      }
      const openSub = () => {
        clearTimeout(submenuTimer);
        const r = button.getBoundingClientRect();
        const sub = this.showMenu(
          typeof item.submenu === 'function' ? item.submenu() : item.submenu,
          r.right - 3,
          r.top - 3,
          { parent: el, owner: button, label: item.label },
        );
        return sub;
      };
      button.addEventListener('pointerenter', () => {
        clearTimeout(submenuTimer);
        if (item.submenu) submenuTimer = setTimeout(openSub, 130);
        else {
          const i = this.menus.indexOf(menu);
          this.menus.splice(i + 1).forEach((m) => {
            m.dispose?.();
            m.el.remove();
          });
        }
      });
      button.addEventListener('click', async () => {
        if (item.submenu) {
          openSub().querySelector('button:not(:disabled)')?.focus();
          return;
        }
        this.closeMenus();
        try {
          await item.action?.();
        } catch (error) {
          this.alert(error.message);
        }
      });
      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' && item.submenu) {
          event.preventDefault();
          openSub().querySelector('button:not(:disabled)')?.focus();
        }
      });
      el.append(button);
    });
    el.addEventListener('pointerleave', () => clearTimeout(submenuTimer));
    el.addEventListener('keydown', (event) => {
      const buttons = $$('button:not(:disabled)', el);
      const current = buttons.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (event.key === 'ArrowLeft' && options.parent) {
        event.preventDefault();
        const i = this.menus.indexOf(menu);
        this.menus.splice(i).forEach((m) => {
          m.dispose?.();
          m.el.remove();
        });
        options.owner?.focus();
      } else if (event.key === 'Tab') this.closeMenus();
    });
    $('#overlays').append(el);
    el.style.left = '0px';
    el.style.top = '0px';
    const width = el.offsetWidth,
      height = el.offsetHeight;
    const left =
      options.parent && x + width > innerWidth
        ? options.parent.getBoundingClientRect().left - width + 4
        : Math.max(3, Math.min(x, innerWidth - width - 3));
    el.style.left = `${Math.max(3, left)}px`;
    el.style.top = `${Math.max(3, Math.min(y, innerHeight - height - 4))}px`;
    if (options.keyboard) $('button:not(:disabled)', el)?.focus();
    return el;
  }
  menubar(win, menus) {
    const bar = document.createElement('nav');
    bar.className = 'menubar';
    bar.setAttribute('aria-label', 'Menú de la aplicación');
    menus.forEach(({ label, items }) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'menu');
      const open = (keyboard) => {
        const r = button.getBoundingClientRect();
        button.classList.add('menu-active');
        this.showMenu(typeof items === 'function' ? items() : items, r.left, r.bottom, {
          owner: button,
          keyboard,
          label,
          onClose: () => button.classList.remove('menu-active'),
        });
      };
      button.onclick = () => {
        if (button.classList.contains('menu-active')) this.closeMenus();
        else open(false);
      };
      button.onpointerenter = () => {
        if ($('.menu-active', bar) && !button.classList.contains('menu-active')) open(false);
      };
      button.onkeydown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          open(true);
        }
      };
      bar.append(button);
    });
    win.body.append(bar);
    return bar;
  }
  dialog({
    title = 'Windows Vista',
    body = '',
    buttons = [{ label: 'Aceptar', value: 'ok', primary: true }],
    width = 410,
    icon: iconName,
    onMount,
    defaultValue,
  } = {}) {
    this.closeMenus();
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'system-dialog glass';
      dialog.style.width = `${width}px`;
      dialog.innerHTML = `<form method="dialog"><header class="dialog-titlebar"><span>${escapeHTML(title)}</span><button type="button" class="caption-button close" data-dialog-x aria-label="Cerrar">${glyph('close', 12)}</button></header><div class="dialog-content">${iconName ? `<div class="dialog-main-icon">${icon(iconName, '', 40)}</div>` : ''}<div class="dialog-message">${body}</div></div><footer class="dialog-buttons"></footer></form>`;
      let done = false;
      const finish = (action) => {
        if (done) return;
        done = true;
        const values = Object.fromEntries(new FormData($('form', dialog)).entries());
        dialog.close();
        dialog.remove();
        resolve({ action, values });
      };
      buttons.forEach((config) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `vista-button ${config.primary ? 'primary' : ''}`;
        button.textContent = config.label;
        button.disabled = !!config.disabled;
        if (config.primary) button.autofocus = true;
        button.onclick = () => {
          if (config.validate && !$('form', dialog).reportValidity()) return;
          finish(config.value);
        };
        $('.dialog-buttons', dialog).append(button);
      });
      $('[data-dialog-x]', dialog).onclick = () => finish('cancel');
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish('cancel');
      });
      $('form', dialog).addEventListener('submit', (event) => {
        event.preventDefault();
        const b = buttons.find((b) => b.primary) ?? buttons[0];
        if (b.validate && !$('form', dialog).reportValidity()) return;
        finish(b.value);
      });
      dialog.addEventListener('keydown', (event) => {
        if (
          event.key === 'Enter' &&
          event.target.matches('input:not([type=checkbox]):not([type=range]):not([type=color])')
        ) {
          event.preventDefault();
          const b = buttons.find((b) => b.primary) ?? buttons[0];
          if (b.validate && !$('form', dialog).reportValidity()) return;
          finish(b.value);
        }
      });
      document.body.append(dialog);
      dialog.showModal();
      onMount?.(dialog);
      const firstInput = $('input:not([type="checkbox"]), textarea, select', dialog);
      if (firstInput) {
        firstInput.focus();
        if (firstInput.tagName === 'INPUT') {
          if (defaultValue !== undefined) firstInput.value = defaultValue;
          firstInput.select();
        }
      }
    });
  }
  alert(message, title = 'Windows Vista', iconName = 'info') {
    return this.dialog({ title, icon: iconName, body: `<p>${escapeHTML(message)}</p>` });
  }
  async confirm(message, title = 'Windows Vista') {
    const { action } = await this.dialog({
      title,
      body: `<p>${escapeHTML(message)}</p>`,
      icon: 'warning',
      buttons: [
        { label: 'Aceptar', value: 'ok', primary: true },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    return action === 'ok';
  }
  async prompt(title, label, value = '') {
    const result = await this.dialog({
      title,
      body: `<label class="field-label">${escapeHTML(label)}<input class="vista-input" name="value" required maxlength="120" autocomplete="off" value="${escapeHTML(value)}"></label>`,
      buttons: [
        { label: 'Aceptar', value: 'ok', primary: true, validate: true },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    return result.action === 'ok' ? result.values.value : null;
  }
  balloon(title, message) {
    $('.notification-balloon')?.remove();
    const el = document.createElement('div');
    el.className = 'notification-balloon';
    el.setAttribute('role', 'status');
    el.innerHTML = `<button aria-label="Cerrar notificación">×</button><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p>`;
    el.querySelector('button').onclick = () => el.remove();
    $('#overlays').append(el);
    setTimeout(() => el.remove(), 5500);
    announce(message);
  }
  async openTextFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md,.csv,.json,.log,text/*';
      input.hidden = true;
      const finish = (result) => {
        input.remove();
        resolve(result);
      };
      input.addEventListener('cancel', () => finish(null), { once: true });
      input.addEventListener(
        'change',
        async () => {
          const file = input.files?.[0];
          if (!file) return finish(null);
          if (file.size > 1_000_000) {
            this.alert('El archivo supera el límite de 1 MB.');
            return finish(null);
          }
          try {
            finish({ name: file.name, content: await file.text() });
          } catch {
            this.alert('No se ha podido leer el archivo.');
            finish(null);
          }
        },
        { once: true },
      );
      document.body.append(input);
      input.click();
    });
  }
}
