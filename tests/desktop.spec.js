import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';

const errors = new WeakMap();
const windowFor = (page, app) => page.locator(`.aero-window[data-app="${app}"]`).last();
async function boot(page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}
async function launch(page, query, app) {
  await page.locator('#start-button').click();
  await page.getByRole('textbox', { name: 'Buscar programas y archivos', exact: true }).fill(query);
  await page.keyboard.press('Enter');
  const win = windowFor(page, app);
  await expect(win).toBeVisible();
  return win;
}
async function accept(page, name = 'Aceptar') {
  await page.locator('dialog[open]').getByRole('button', { name, exact: true }).click();
}
const approx = (actual, expected, tolerance = 3) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

test.beforeEach(async ({ page }) => {
  const issues = [];
  errors.set(page, issues);
  page.on('pageerror', (err) => issues.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') issues.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) issues.push(`${response.status()} ${response.url()}`);
  });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

test('arranque, recursos locales y escritorio completo', async ({ page, baseURL }) => {
  const origins = new Set();
  page.on('request', (r) => {
    if (r.url().startsWith('http')) origins.add(new URL(r.url()).origin);
  });
  await boot(page);
  await expect(windowFor(page, 'welcome')).toBeVisible();
  await expect(page.locator('.desktop-icon')).toHaveCount(6);
  await expect(page.locator('.gadget')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  const broken = await page
    .locator('img')
    .evaluateAll((images) => images.filter((i) => i.complete && !i.naturalWidth).map((i) => i.src));
  expect(broken).toEqual([]);
  expect([...origins]).toEqual([new URL(baseURL).origin]);
  expect(
    await page.locator('.welcome-scroll').evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
});

test('iconos: selección, doble clic, arrastre y persistencia', async ({ page }) => {
  await boot(page);
  const item = page.locator('[data-desktop-id="computer"]');
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await item.dblclick();
  await expect(windowFor(page, 'explorer')).toBeVisible();
  const user = page.locator('[data-desktop-id="user-home"]'),
    box = await user.boundingBox();
  await page.mouse.move(box.x + 35, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 132, box.y + 48, { steps: 10 });
  await page.mouse.up();
  const position = await user.boundingBox();
  expect(position.x).toBeGreaterThan(box.x + 90);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  approx((await page.locator('[data-desktop-id="user-home"]').boundingBox()).x, position.x);
});

test('ventanas: arrastre y redimensión con geometría real', async ({ page }) => {
  await boot(page);
  const win = windowFor(page, 'welcome'),
    before = await win.boundingBox();
  const title = await win.locator('.titlebar').boundingBox();
  await page.mouse.move(title.x + 200, title.y + 15);
  await page.mouse.down();
  await page.mouse.move(title.x + 305, title.y + 73, { steps: 16 });
  await page.mouse.up();
  const moved = await win.boundingBox();
  approx(moved.x, before.x + 105);
  approx(moved.y, before.y + 58);
  const handle = await win.locator('.resize-se').boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 4);
  await page.mouse.down();
  await page.mouse.move(handle.x + 91, handle.y + 40, { steps: 12 });
  await page.mouse.up();
  const resized = await win.boundingBox();
  expect(resized.width).toBeGreaterThan(moved.width + 80);
  expect(resized.height).toBeGreaterThan(moved.height + 30);
});

test('ventanas: maximizar, restaurar, minimizar, restaurar y cerrar', async ({ page }) => {
  await boot(page);
  const win = windowFor(page, 'welcome'),
    before = await win.boundingBox();
  await win.getByRole('button', { name: 'Maximizar', exact: true }).click();
  await expect(win).toHaveAttribute('data-state', 'maximized');
  await expect.poll(async () => Math.round((await win.boundingBox()).width)).toBe(1440);
  await win.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(win).toHaveAttribute('data-state', 'normal');
  await expect
    .poll(async () => Math.round((await win.boundingBox()).width))
    .toBe(Math.round(before.width));
  await win.getByRole('button', { name: 'Minimizar', exact: true }).click();
  await expect(win).toBeHidden();
  await page.locator('.task-button[data-app="welcome"]').click();
  await expect(win).toBeVisible();
  await expect(win).toHaveClass(/active/);
  await win.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(win).toHaveCount(0);
});

test('barra de tareas: agrupación y elección entre instancias', async ({ page }) => {
  await boot(page);
  await launch(page, 'bloc de notas', 'notepad');
  await launch(page, 'bloc de notas', 'notepad');
  await expect(page.locator('.aero-window[data-app="notepad"]')).toHaveCount(2);
  await expect(page.locator('.task-button[data-app="notepad"]')).toHaveCount(1);
  await expect(page.locator('.task-button[data-app="notepad"]')).toContainText('(2)');
  await page.locator('.task-button[data-app="notepad"]').click();
  await page.getByRole('menuitem', { name: 'Minimizar grupo', exact: true }).click();
  await expect(page.locator('.aero-window[data-app="notepad"]:visible')).toHaveCount(0);
  await page.locator('.task-button[data-app="notepad"]').click();
  await page.getByRole('menuitem', { name: 'Restaurar grupo', exact: true }).click();
  await expect(page.locator('.aero-window[data-app="notepad"]:visible')).toHaveCount(2);
});

test('Inicio: búsqueda sin acentos, teclado y lista de programas', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Control+Escape');
  await expect(page.locator('#start-menu')).toBeVisible();
  await page.locator('.start-search input').fill('GALERIA');
  await expect(page.locator('.start-program[data-program="photos"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#start-menu')).toBeHidden();
  await page.locator('#start-button').click();
  await page.getByRole('button', { name: 'Todos los programas', exact: false }).click();
  await expect(page.locator('.start-program')).toHaveCount(9);
  await page.locator('[data-program="calculator"]').click();
  await expect(windowFor(page, 'calculator')).toBeVisible();
});

test('Bloc de notas: guardar, recargar, buscar y reabrir Unicode', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'bloc de notas', 'notepad'),
    text = 'Hola, España.\nDiseño & software <script>alert(1)</script> ✓';
  await win.locator('textarea').fill(text);
  await page.keyboard.press('Control+s');
  await page.locator('dialog[open] input[name="name"]').fill('Prueba Unicode.txt');
  await accept(page, 'Guardar');
  await expect(win.locator('.window-title')).toHaveText('Prueba Unicode.txt - Bloc de notas');
  await win.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.locator('#start-button').click();
  await page.locator('.start-search input').fill('Prueba Unicode');
  await page.locator('[data-start-file]').click();
  await expect(windowFor(page, 'notepad').locator('textarea')).toHaveValue(text);
  expect(await page.locator('script:not([src])').count()).toBe(0);
});

test('Bloc de notas: descarga real del archivo', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'bloc de notas', 'notepad');
  await win.locator('textarea').fill('Un documento descargado.');
  await win.locator('.menubar').getByRole('button', { name: 'Archivo', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Descargar archivo .txt', exact: true }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe('Documento.txt');
  expect(await readFile(await downloaded.path(), 'utf8')).toBe('Un documento descargado.');
});

test('Bloc de notas: cierre cancelable y recuperación de borradores', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'bloc de notas', 'notepad');
  await win.locator('textarea').fill('Este borrador no se debe perder.');
  await win.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await accept(page, 'Cancelar');
  await expect(win).toBeVisible();
  await page.reload();
  await expect(windowFor(page, 'notepad').locator('textarea')).toHaveValue(
    'Este borrador no se debe perder.',
  );
  await windowFor(page, 'notepad').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await accept(page, 'No guardar');
  await expect(page.locator('.notepad-app')).toHaveCount(0);
});

test('Explorador: crear, cambiar nombre, eliminar y restaurar carpeta', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'explorador', 'explorer');
  await win.locator('.explorer-sidebar>button[data-path="documents"]').click();
  await win.getByRole('button', { name: 'Nueva carpeta', exact: true }).click();
  await page.locator('dialog[open] input').fill('Mi carpeta de prueba');
  await accept(page);
  const item = win.locator('.file-item').filter({ hasText: 'Mi carpeta de prueba' });
  await expect(item).toBeVisible();
  await item.click();
  await page.keyboard.press('F2');
  await page.locator('dialog[open] input').fill('Carpeta renombrada');
  await accept(page);
  const renamed = win.locator('.file-item').filter({ hasText: 'Carpeta renombrada' });
  await renamed.click();
  await page.keyboard.press('Delete');
  await accept(page);
  await expect(renamed).toHaveCount(0);
  await win.locator('.explorer-sidebar [data-path="recycle"]').click();
  const trashed = win.locator('.file-item').filter({ hasText: 'Carpeta renombrada' });
  await trashed.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Restaurar', exact: true }).click();
  await win.locator('.explorer-sidebar>button[data-path="documents"]').click();
  await expect(win.locator('.file-item').filter({ hasText: 'Carpeta renombrada' })).toBeVisible();
});

test('Explorador: navegación, búsqueda y vista de detalles', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'explorador', 'explorer');
  await win.locator('.drive-item[data-node="c"]').dblclick();
  await expect(win.locator('.breadcrumb')).toContainText('Disco local');
  await win.getByRole('button', { name: 'Atrás', exact: true }).click();
  await expect(win.locator('.drive-item[data-node="c"]')).toBeVisible();
  await win.locator('.explorer-sidebar>button[data-path="documents"]').click();
  await win.locator('.shell-search input').fill('Cosas');
  await expect(win.locator('.file-item')).toHaveCount(1);
  await win.locator('.shell-search input').fill('');
  await win.locator('.views').click();
  await page.getByRole('menuitemcheckbox', { name: 'Detalles', exact: true }).click();
  await expect(win.locator('.explorer-view')).toHaveClass(/view-details/);
  await win.locator('.file-item').filter({ hasText: 'Bienvenido a Vista.txt' }).dblclick();
  await expect(windowFor(page, 'notepad').locator('textarea')).toHaveValue(
    /Bienvenido a Windows Vista/,
  );
});

test('Calculadora: teclado, porcentajes, memoria y error recuperable', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'calculadora', 'calculator'),
    display = win.locator('.calculator-display');
  await page.keyboard.type('0.1+0.2');
  await page.keyboard.press('Enter');
  await expect(display).toHaveValue('0,3');
  await page.keyboard.press('Escape');
  await page.keyboard.type('200+10%');
  await page.keyboard.press('Enter');
  await expect(display).toHaveValue('220');
  await win.getByRole('button', { name: 'MS', exact: true }).click();
  await win.getByRole('button', { name: 'C', exact: true }).click();
  await win.getByRole('button', { name: 'MR', exact: true }).click();
  await expect(display).toHaveValue('220');
  await page.keyboard.press('Escape');
  await page.keyboard.type('5/0');
  await page.keyboard.press('Enter');
  await expect(display).toHaveValue('No se puede dividir entre cero');
  await page.keyboard.type('7');
  await expect(display).toHaveValue('7');
});

test('Internet Explorer: historial, pestañas, búsqueda y bloqueo de esquemas', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'internet explorer', 'browser');
  await win.locator('.ie-help').click();
  await expect(win.locator('.browser-document')).toContainText('Atajos de teclado');
  await win.locator('.ie-back').click();
  await expect(win.locator('.live-header')).toBeVisible();
  await win.locator('.ie-new-tab').click();
  await expect(win.locator('.browser-tab')).toHaveCount(2);
  const address = win.getByRole('textbox', { name: 'Dirección web', exact: true });
  await address.fill('https://example.com/');
  await address.press('Enter');
  await expect(win.locator('[data-external]')).toBeVisible();
  await address.fill('javascript:alert(1)');
  await address.press('Enter');
  await expect(page.locator('dialog[open]')).toContainText('no está permitida');
  await accept(page);
  await address.fill('calculadora');
  await address.press('Enter');
  await expect(win.locator('.web-result[data-app="calculator"]')).toBeVisible();
});

test('Personalización: cristal, fondo y nombre persisten', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'personalizar', 'settings');
  await win.locator('[data-goto="color"]').click();
  await win.getByRole('button', { name: 'Hoja', exact: true }).click();
  await win.locator('.color-transparency').uncheck();
  await win.locator('.color-save').click();
  await expect(page.locator('body')).toHaveClass(/no-transparency/);
  await win.locator('[data-goto="wallpaper"]').click();
  await win.locator('input[value="night"]').check();
  await win.locator('.wallpaper-save').click();
  await expect(page.locator('#wallpaper')).toHaveAttribute('src', /night\.webp/);
  await win.locator('[data-goto="user"]').click();
  await win.locator('.account-name').fill('Ana & diseño');
  await win.locator('.account-save').click();
  await page.reload();
  await expect(page.locator('[data-desktop-id="user-home"]')).toHaveAttribute(
    'aria-label',
    'Ana & diseño',
  );
  await expect(page.locator('#wallpaper')).toHaveAttribute('src', /night\.webp/);
  await expect(page.locator('body')).toHaveClass(/no-transparency/);
});

test('Sidebar: reloj vivo, presentación, quitar y agregar gadgets', async ({ page }) => {
  await boot(page);
  const hand = page.locator('#sidebar .clock-second'),
    before = await hand.getAttribute('transform');
  await expect.poll(() => hand.getAttribute('transform')).not.toBe(before);
  const photo = page.locator('.sidebar-photo-open img'),
    src = await photo.getAttribute('src');
  await page.locator('.slideshow-frame').hover();
  await page.locator('.sidebar-photo-next').click();
  await expect(photo).not.toHaveAttribute('src', src);
  await page.locator('.gadget-clock').hover();
  await page.getByRole('button', { name: 'Cerrar gadget Reloj', exact: true }).click();
  await expect(page.locator('.gadget-clock')).toHaveCount(0);
  await page.locator('.sidebar-add').click();
  await page.locator('[data-add-gadget="clock"]').click();
  await page.locator('[data-add-gadget="notes"]').click();
  await accept(page);
  await expect(page.locator('.gadget-clock')).toBeVisible();
  await page.locator('.gadget-note-text').fill('Recordar el viaje a 2007.');
  await page.reload();
  await expect(page.locator('.gadget-note-text')).toHaveValue('Recordar el viaje a 2007.');
});

test('área de notificación: calendario, volumen y red', async ({ page }) => {
  await boot(page);
  await page.locator('.tray-clock').click();
  await expect(page.locator('.calendar-days>button')).toHaveCount(42);
  const month = await page.locator('.month-label').textContent();
  await page.locator('.calendar-next').click();
  await expect(page.locator('.month-label')).not.toHaveText(month);
  await page.locator('.calendar-today').click();
  await expect(page.locator('.month-label')).toHaveText(month);
  await page.locator('.tray-volume').click();
  const range = page.locator('.volume-range');
  await range.focus();
  await page.keyboard.press('Home');
  await expect(range).toHaveValue('0');
  await page.locator('.volume-mute').click();
  await expect(range).not.toHaveValue('0');
  await page.locator('.tray-network').click();
  await expect(page.locator('.network-flyout')).toContainText('Conectividad del navegador');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tray-flyout')).toHaveCount(0);
});

test('menús contextuales y teclado', async ({ page }) => {
  await boot(page);
  await page.mouse.click(1130, 600, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Personalizar', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.context-menu')).toHaveCount(0);
  await page.mouse.click(1130, 600, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Personalizar', exact: true }).click();
  await expect(windowFor(page, 'settings')).toBeVisible();
});

test('Paint: dibujar, deshacer, rehacer y descargar PNG', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'paint', 'paint'),
    canvas = win.locator('canvas'),
    box = await canvas.boundingBox();
  await page.mouse.move(box.x + 65, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 105, box.y + 60, { steps: 15 });
  await page.mouse.up();
  const pixel = () =>
    canvas.evaluate((c) => [...c.getContext('2d').getImageData(85, 60, 1, 1).data]);
  expect(await pixel()).not.toEqual([255, 255, 255, 255]);
  await page.keyboard.press('Control+z');
  expect(await pixel()).toEqual([255, 255, 255, 255]);
  await page.keyboard.press('Control+y');
  expect(await pixel()).not.toEqual([255, 255, 255, 255]);
  const pending = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const file = await pending;
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});

test('Buscaminas: primera jugada segura, banderas y reinicio', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'buscaminas', 'games');
  await win.locator('[data-cell="40"]').click();
  await expect(win.locator('.mines-cell.open')).not.toHaveCount(0);
  await expect(win.locator('.mines-cell.mine')).toHaveCount(0);
  const closed = win.locator('.mines-cell:not(.open)').first();
  await closed.click({ button: 'right' });
  await expect(win.locator('.mines-cell.flagged')).toHaveCount(1);
  await page.keyboard.press('F2');
  await expect(win.locator('.mines-cell.open')).toHaveCount(0);
  await expect(win.locator('.mines-remaining')).toHaveText('010');
});

test('mostrar escritorio, cambio de foco y bloqueo de sesión', async ({ page }) => {
  await boot(page);
  await launch(page, 'bloc', 'notepad');
  await page.locator('[data-quick="desktop"]').click();
  await expect(page.locator('.aero-window:visible')).toHaveCount(0);
  await page.locator('[data-quick="desktop"]').click();
  await expect(page.locator('.aero-window:visible')).toHaveCount(2);
  await page.locator('#start-button').click();
  await page.locator('.start-lock').click();
  await expect(page.locator('#session-screen')).toBeVisible();
  await page.locator('.unlock-button').click();
  await expect(page.locator('#session-screen')).toBeHidden();
  await expect(page.locator('.aero-window:visible')).toHaveCount(2);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`viewport ${viewport.width}×${viewport.height}: escritorio sin desbordamiento`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await boot(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const win = await launch(page, 'calculadora', 'calculator'),
      box = await win.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThan(viewport.height);
  });
}

test('almacenamiento bloqueado: no rompe el arranque', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await boot(page);
  await expect(windowFor(page, 'welcome')).toBeVisible();
  await expect(page.locator('.notification-balloon')).toContainText('restringido');
  const win = await launch(page, 'bloc', 'notepad');
  await win.locator('textarea').fill('Texto que se puede descargar.');
  await expect(win.locator('textarea')).toHaveValue('Texto que se puede descargar.');
});

test('GitHub Pages: compilación bajo una subruta de repositorio', async ({ page }) => {
  const root = resolve('dist');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.cur': 'image/x-icon',
  };
  const server = createServer(async (req, res) => {
    try {
      const relative =
        decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(
          /^\/vista-test\//,
          '',
        ) || 'index.html';
      const file = resolve(root, relative);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/vista-test/`);
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(windowFor(page, 'welcome')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator('#wallpaper').evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(
      true,
    );
    await page.locator('#start-button').click();
    await expect(page.locator('#start-menu img').first()).toHaveJSProperty('complete', true);
  } finally {
    await page.goto('about:blank');
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ventanas: borde noroeste y tamaño mínimo', async ({ page }) => {
  await boot(page);
  const win = windowFor(page, 'welcome'),
    before = await win.boundingBox(),
    handle = await win.locator('.resize-nw').boundingBox();
  await page.mouse.move(handle.x + 3, handle.y + 3);
  await page.mouse.down();
  await page.mouse.move(handle.x + 600, handle.y + 450, { steps: 20 });
  await page.mouse.up();
  const after = await win.boundingBox();
  expect(Math.round(after.width)).toBe(550);
  expect(Math.round(after.height)).toBe(390);
  approx(after.x + after.width, before.x + before.width);
  approx(after.y + after.height, before.y + before.height);
});

test('barra de tareas: previsualización y opción de desagrupar', async ({ page }) => {
  await boot(page);
  await launch(page, 'bloc', 'notepad');
  await launch(page, 'bloc', 'notepad');
  await page.locator('.task-button[data-app="notepad"]').hover();
  await expect(page.locator('.task-preview .preview-card')).toHaveCount(2);
  await page.mouse.move(1130, 720);
  await expect(page.locator('.task-preview')).toHaveCount(0);
  await page.locator('#taskbar').click({ position: { x: 900, y: 15 }, button: 'right' });
  await page.getByRole('menuitem', { name: 'Propiedades', exact: true }).click();
  await page.locator('dialog[open] input[name="groupTasks"]').uncheck();
  await accept(page);
  await expect(page.locator('.task-button[data-app="notepad"]')).toHaveCount(2);
});

test('Galería: abrir fotografía, avanzar y girar', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'galeria', 'photos');
  await win.locator('[data-index="0"]').dblclick();
  await expect(win.locator('.photo-main')).toBeVisible();
  const src = await win.locator('.photo-main').getAttribute('src');
  await win.locator('.photo-next').click();
  await expect(win.locator('.photo-main')).not.toHaveAttribute('src', src);
  await win.locator('.photo-rotate').click();
  await expect(win.locator('.photo-main')).toHaveAttribute('style', /rotate\(90deg\)/);
  await win.locator('.photo-gallery').click();
  await expect(win.locator('.photo-grid')).toBeVisible();
});

test('Internet Explorer: sitio externo solo tras acción explícita', async ({ page, context }) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Example Domain</title><h1>External test page</h1>',
    }),
  );
  await boot(page);
  const win = await launch(page, 'internet', 'browser'),
    address = win.locator('.browser-address');
  await address.fill('https://example.com/');
  await address.press('Enter');
  expect(context.pages().length).toBe(1);
  const pending = context.waitForEvent('page');
  await win.locator('[data-external]').click();
  const popup = await pending;
  await expect(popup).toHaveURL('https://example.com/');
  await popup.close();
});

test('cuadros de diálogo: Enter guarda y el foco queda contenido', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'bloc', 'notepad');
  await win.locator('textarea').fill('Guardado con el teclado.');
  await page.keyboard.press('Control+s');
  const input = page.locator('dialog[open] input[name="name"]');
  await expect(input).toBeFocused();
  await input.fill('Teclado.txt');
  await input.press('Enter');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(win.locator('.window-title')).toContainText('Teclado.txt');
});

test('escritorio: selección rectangular de varios iconos', async ({ page }) => {
  await boot(page);
  await page.mouse.move(2, 2);
  await page.mouse.down();
  await page.mouse.move(101, 245, { steps: 16 });
  await page.mouse.up();
  await expect(page.locator('.desktop-icon.selected')).toHaveCount(3);
  await expect(page.locator('#selection-box')).toBeHidden();
});

test('Internet Explorer: enlaces a archivos y programas locales', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'internet', 'browser'),
    address = win.locator('.browser-address');
  await address.fill('vista://fotos');
  await address.press('Enter');
  await win.locator('[data-file]').first().click();
  await expect(windowFor(page, 'photos')).toBeVisible();
  await expect(page.locator('.browser-app')).toHaveCount(1);
});

test('administrador: cancelar el cierre conserva la ventana y su fila', async ({ page }) => {
  await boot(page);
  const win = await launch(page, 'bloc', 'notepad');
  await win.locator('textarea').fill('Aún no guardado.');
  await page.locator('#taskbar').click({ position: { x: 900, y: 15 }, button: 'right' });
  await page.getByRole('menuitem', { name: 'Administrador de tareas' }).click();
  const manager = page.locator('dialog[open]').first();
  const end = manager.locator('[data-end-task]').last();
  await end.click();
  await page
    .locator('dialog[open]')
    .last()
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(end).toBeVisible();
  await expect(win).toBeVisible();
  await manager.locator('.dialog-buttons button').click();
  await win.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await accept(page, 'No guardar');
  await expect(page.locator('.notepad-app')).toHaveCount(0);
});
