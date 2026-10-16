export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const escapeHTML = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const asset = (path) => new URL(`assets/${path}`, document.baseURI).href;
export const iconURL = (name, size = 64) => {
  if (name === 'calculator') return asset('icons/calculator.svg');
  const resolution =
    size <= 16 ? 16 : size <= 24 ? 24 : size <= 32 ? 32 : size <= 48 ? 48 : size <= 64 ? 64 : 128;
  return asset(`icons/${name}${resolution === 64 ? '' : `-${resolution}`}.png`);
};
export const icon = (name, className = '', size = 32) =>
  `<img class="app-icon ${className}" src="${iconURL(name, size)}" alt="" width="${size}" height="${size}" draggable="false">`;
export const prettyBytes = (n) =>
  n < 1024
    ? `${n} bytes`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
export const download = (name, data, type = 'text/plain;charset=utf-8') => {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};
export const announce = (message) => {
  const el = $('#announcer');
  if (el) el.textContent = message;
};
export const isTyping = (target) =>
  target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"]');
export const formatDate = (date) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' }).format(date);

const paths = {
  back: '<path d="m13 5-7 7 7 7M6 12h14"/>',
  forward: '<path d="m11 5 7 7-7 7M18 12H4"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  up: '<path d="m7 14 5-5 5 5"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  min: '<path d="M6 16h12"/>',
  max: '<rect x="6" y="6" width="12" height="12"/><path d="M6 8h12"/>',
  restore: '<path d="M9 8V5h11v11h-3M5 9h11v11H5zM5 11h11M9 7h11"/>',
  refresh: '<path d="M19 8a8 8 0 1 0 1 8M19 3v6h-6"/>',
  home: '<path d="m3 11 9-8 9 8M6 10v11h5v-7h4v7h4V10"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  sound: '<path d="M3 9h4l5-5v16l-5-5H3zM16 7q7 5 0 10M15 10q2 2 0 4"/>',
  mute: '<path d="M3 9h4l5-5v16l-5-5H3zM16 9l5 6M21 9l-5 6"/>',
  power: '<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  play: '<path d="m8 5 12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  network: '<path d="M2 4h13v10H2zM8 14v4M5 18h6M14 11h8v8h-8zM17 19v3M15 22h5"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3M12 17v1"/>',
  fullscreen: '<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/>',
};
export const glyph = (name, size = 16) =>
  `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.help}</svg>`;
export const on = (el, type, handler, signal) =>
  el.addEventListener(type, handler, signal ? { signal } : undefined);
export function debounce(fn, wait = 180) {
  let timer;
  const run = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  run.cancel = () => clearTimeout(timer);
  return run;
}
