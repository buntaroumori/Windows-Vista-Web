import './theme.css';
import './shell.css';
import './apps.css';
import { SafeStorage, Settings } from './store.js';
import { FileSystem } from './filesystem.js';
import { UI } from './ui.js';
import { WindowManager } from './window-manager.js';
import { Sidebar } from './sidebar.js';
import { Shell } from './shell.js';
import { registerApps } from './app-registry.js';
import { $, asset } from './utils.js';

const storage = new SafeStorage();
const settings = new Settings(storage);
const fs = new FileSystem(storage);
const ui = new UI();
const wm = new WindowManager(ui, settings);
const ctx = { storage, settings, fs, ui, wm };

function applySettings() {
  const color = settings.get('accent');
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)).join(' ');
  document.documentElement.style.setProperty('--glass-rgb', rgb);
  document.documentElement.style.setProperty(
    '--glass-opacity',
    clampOpacity(settings.get('glassOpacity')),
  );
  document.body.classList.toggle('no-transparency', !settings.get('transparency'));
  document.body.classList.toggle('reduced-motion', settings.get('reducedMotion'));
  const wallpaper = $('#wallpaper'),
    src = asset(`wallpapers/${settings.get('wallpaper')}.webp`);
  if (wallpaper.src !== src) wallpaper.src = src;
  document.documentElement.style.setProperty('--wallpaper-url', `url("${src}")`);
}
const clampOpacity = (n) => Math.max(0.25, Math.min(0.95, Number(n) / 100 || 0.65));
applySettings();
settings.subscribe(applySettings);

// Audio is opt-in and is created only in response to a user interaction.
let audioContext, gain;
ctx.audio = {
  setVolume(volume) {
    if (gain && audioContext)
      gain.gain.setTargetAtTime((volume / 100) * 0.06, audioContext.currentTime, 0.04);
  },
  play() {
    if (
      !settings.get('sound') ||
      !settings.get('volume') ||
      !navigator.userActivation?.hasBeenActive
    )
      return;
    try {
      if (!audioContext) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        audioContext = new Audio();
        gain = audioContext.createGain();
        gain.gain.value = (settings.get('volume') / 100) * 0.06;
        gain.connect(audioContext.destination);
      }
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      [659.25, 783.99, 987.77].forEach((frequency, i) => {
        const oscillator = audioContext.createOscillator(),
          envelope = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, now + i * 0.035);
        envelope.gain.linearRampToValueAtTime(0.25, now + i * 0.035 + 0.015);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + i * 0.035);
        oscillator.connect(envelope);
        envelope.connect(gain);
        oscillator.start(now + i * 0.035);
        oscillator.stop(now + 0.3 + i * 0.035);
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
        };
      });
    } catch {
      /* Audio may be disabled by browser policy. Visual interaction remains available. */
    }
  },
};
registerApps(ctx);
ctx.sidebar = new Sidebar(ctx);
ctx.shell = new Shell(ctx);

if (settings.get('welcome')) ctx.launch('welcome', { startup: true });
const drafts = storage.get('drafts.v1', {});
if (drafts && typeof drafts === 'object' && !Array.isArray(drafts)) {
  Object.values(drafts)
    .filter(
      (d) =>
        d &&
        typeof d.id === 'string' &&
        typeof d.text === 'string' &&
        typeof d.name === 'string' &&
        d.text.length <= 1_000_000,
    )
    .sort((a, b) => (a.updated || 0) - (b.updated || 0))
    .slice(-10)
    .forEach((draft) => ctx.launch('notepad', { draft, startup: true }));
}
if (!storage.available)
  ui.balloon(
    'Almacenamiento no disponible',
    'El navegador ha restringido el almacenamiento local. Descarga una copia de tus documentos antes de salir.',
  );

let tickTimer;
function tick() {
  clearTimeout(tickTimer);
  if (document.hidden) return;
  const now = new Date();
  ctx.shell.tick(now);
  ctx.sidebar.tick(now);
  tickTimer = setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
}
document.addEventListener('visibilitychange', tick);
tick();
window.addEventListener('beforeunload', () => wm.windows.forEach((win) => win.flushDraft?.()));
// A stable, non-privileged readiness signal for automation. No application internals are exposed.
document.documentElement.dataset.ready = 'true';
window.dispatchEvent(new Event('vista-ready'));
