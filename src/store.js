export const DEFAULT_SETTINGS = Object.freeze({
  wallpaper: 'aurora',
  accent: '#85b9c9',
  glassOpacity: 65,
  transparency: true,
  sidebar: true,
  gadgets: ['clock', 'photos', 'calendar'],
  welcome: true,
  sound: false,
  volume: 65,
  userName: 'Usuario',
  iconSize: 'medium',
  reducedMotion: false,
  groupTasks: true,
  showClock: true,
});

export class SafeStorage {
  constructor(storage, prefix = 'vista.') {
    this.prefix = prefix;
    this.memory = new Map();
    this.available = true;
    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
      if (!this.storage) this.available = false;
    } catch {
      this.storage = null;
      this.available = false;
    }
  }
  get(key, fallback = null) {
    let raw = this.memory.get(key);
    try {
      raw = this.storage?.getItem(this.prefix + key) ?? raw;
    } catch {
      this.available = false;
    }
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  set(key, value) {
    const serialized = JSON.stringify(value);
    this.memory.set(key, serialized);
    try {
      if (!this.storage) {
        this.available = false;
        return false;
      }
      this.storage.setItem(this.prefix + key, serialized);
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }
  remove(key) {
    this.memory.delete(key);
    try {
      this.storage?.removeItem(this.prefix + key);
    } catch {
      /* Private browsing. */
    }
  }
}

export class Settings {
  constructor(storage) {
    this.storage = storage;
    this.listeners = new Set();
    const raw = storage.get('settings.v1', {});
    this.value = { ...DEFAULT_SETTINGS };
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
        if (typeof raw[key] === typeof defaultValue) this.value[key] = raw[key];
      }
    }
    if (
      !['aurora', 'leaf', 'lake', 'night', 'landscape', 'mountain'].includes(this.value.wallpaper)
    )
      this.value.wallpaper = 'aurora';
    if (!/^#[\da-f]{6}$/i.test(this.value.accent)) this.value.accent = DEFAULT_SETTINGS.accent;
    if (!Array.isArray(this.value.gadgets)) this.value.gadgets = [...DEFAULT_SETTINGS.gadgets];
    this.value.gadgets = [
      ...new Set(
        this.value.gadgets.filter((x) => ['clock', 'photos', 'calendar', 'notes'].includes(x)),
      ),
    ];
    this.value.volume = Math.max(0, Math.min(100, Number(this.value.volume) || 0));
    this.value.glassOpacity = Math.max(25, Math.min(95, Number(this.value.glassOpacity) || 65));
    this.value.userName = String(this.value.userName).slice(0, 40) || 'Usuario';
    if (!['small', 'medium', 'large'].includes(this.value.iconSize)) this.value.iconSize = 'medium';
  }
  get(key) {
    return this.value[key];
  }
  set(key, value) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) return;
    this.value[key] = value;
    this.storage.set('settings.v1', this.value);
    this.listeners.forEach((listener) => listener(key, value));
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
