import { $, $$, escapeHTML, download, glyph } from '../utils.js';

const PALETTE = [
  '#000000',
  '#808080',
  '#800000',
  '#808000',
  '#008000',
  '#008080',
  '#000080',
  '#800080',
  '#808040',
  '#004040',
  '#0080ff',
  '#004080',
  '#8000ff',
  '#804000',
  '#ffffff',
  '#c0c0c0',
  '#ff0000',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#0000ff',
  '#ff00ff',
  '#ffff80',
  '#00ff80',
  '#80ffff',
  '#8080ff',
  '#ff0080',
  '#ff8040',
];
const TOOLS = [
  ['pencil', 'Lápiz', '<path d="m5 17 11-12 4 4L8 21l-4 1zM14 7l4 4"/>'],
  ['brush', 'Pincel', '<path d="m9 14 9-11 3 3-10 10zM10 15c2 4-2 7-7 6 3-2-1-7 7-6z"/>'],
  ['eraser', 'Borrador', '<path d="m3 15 11-12 8 8-10 11H9zM7 11l9 8M12 22h10"/>'],
  [
    'fill',
    'Relleno con color',
    '<path d="m3 12 9-9 9 9-9 9zM2 13h19M8 2l7 9M21 15q-4 5 0 6 4-1 0-6"/>',
  ],
  ['picker', 'Seleccionar color', '<path d="m4 16 12-12 4 4L8 20H4zM14 6l4 4M4 20l-2 2"/>'],
  ['text', 'Texto', '<path d="M5 5V3h14v2M12 3v18M7 21h10"/>'],
  ['line', 'Línea', '<path d="m3 21 18-18"/>'],
  ['rect', 'Rectángulo', '<rect x="3" y="5" width="18" height="15"/>'],
  ['ellipse', 'Elipse', '<ellipse cx="12" cy="12" rx="9" ry="7"/>'],
  ['round', 'Rectángulo redondeado', '<rect x="3" y="5" width="18" height="15" rx="4"/>'],
];
export function openPaint(ctx) {
  const { wm, ui } = ctx;
  const win = wm.create('paint', {
    title: 'Sin título - Paint',
    icon: 'paint',
    width: 820,
    height: 564,
    minWidth: 420,
    minHeight: 320,
    className: 'paint-app',
  });
  if (!win) return;
  let tool = 'pencil',
    color = '#000000',
    thickness = 2,
    dirty = false,
    history = [],
    redoHistory = [];
  ui.menubar(win, [
    {
      label: 'Archivo',
      items: [
        { label: 'Nuevo', shortcut: 'Ctrl+N', action: clear },
        { label: 'Abrir imagen…', action: openImage },
        { label: 'Guardar como PNG…', shortcut: 'Ctrl+S', action: save },
        { separator: true },
        { label: 'Salir', action: () => win.close() },
      ],
    },
    {
      label: 'Edición',
      items: () => [
        { label: 'Deshacer', shortcut: 'Ctrl+Z', disabled: !history.length, action: undo },
        { label: 'Rehacer', shortcut: 'Ctrl+Y', disabled: !redoHistory.length, action: redo },
      ],
    },
    {
      label: 'Imagen',
      items: [
        { label: 'Borrar imagen', action: clear },
        { label: 'Invertir colores', action: invert },
      ],
    },
    {
      label: 'Colores',
      items: [
        { label: 'Modificar colores…', action: () => $('.paint-custom-color', win.body).click() },
      ],
    },
    {
      label: 'Ayuda',
      items: [
        {
          label: 'Acerca de Paint',
          action: () =>
            ui.alert(
              'Dibuja con el lápiz o el pincel, rellena áreas y crea formas. Elige un color en la paleta. Guarda tu dibujo como una imagen PNG en tu dispositivo. Esta es una recreación web de Paint.',
              'Paint',
            ),
        },
      ],
    },
  ]);
  const body = document.createElement('div');
  body.className = 'paint-workspace';
  body.innerHTML = `<div class="paint-toolbox">${TOOLS.map(([id, label, path]) => `<button data-tool="${id}" title="${label}" aria-label="${label}" aria-pressed="${id === tool}" class="${id === tool ? 'selected' : ''}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${path}</svg></button>`).join('')}<div class="paint-sizes">${[1, 2, 5, 10].map((n) => `<button data-thickness="${n}" aria-label="Grosor ${n}" title="Grosor ${n}" class="${n === thickness ? 'selected' : ''}"><i style="height:${n}px"></i></button>`).join('')}</div></div><div class="paint-canvas-scroll"><canvas class="paint-canvas" width="800" height="480" aria-label="Lienzo de dibujo. Elija una herramienta y arrastre para dibujar." role="img"></canvas></div>`;
  const colors = document.createElement('div');
  colors.className = 'paint-colors';
  colors.innerHTML = `<div class="paint-current-color"><i style="background:${color}"></i></div><div class="paint-palette">${PALETTE.map((c) => `<button data-color="${c}" style="background:${c}" title="${c}" aria-label="Color ${c}"></button>`).join('')}</div><input type="color" class="paint-custom-color" aria-label="Color personalizado" value="${color}">`;
  const status = document.createElement('footer');
  status.className = 'app-status';
  status.innerHTML =
    '<span class="paint-tip">Lápiz</span><span class="status-spacer"></span><span class="paint-position">800 × 480 píxeles</span>';
  win.body.append(body, colors, status);
  const canvas = $('canvas', body),
    drawing = canvas.getContext('2d', { willReadFrequently: true });
  drawing.fillStyle = '#fff';
  drawing.fillRect(0, 0, canvas.width, canvas.height);
  const snapshot = () => drawing.getImageData(0, 0, canvas.width, canvas.height);
  const push = () => {
    history.push(snapshot());
    if (history.length > 10) history.shift();
    redoHistory = [];
    dirty = true;
  };
  function undo() {
    if (!history.length) return;
    redoHistory.push(snapshot());
    drawing.putImageData(history.pop(), 0, 0);
    dirty = true;
  }
  function redo() {
    if (!redoHistory.length) return;
    history.push(snapshot());
    drawing.putImageData(redoHistory.pop(), 0, 0);
    dirty = true;
  }
  async function clear() {
    if (dirty && !(await ui.confirm('¿Desea borrar el dibujo actual?', 'Paint'))) return;
    push();
    drawing.fillStyle = '#fff';
    drawing.fillRect(0, 0, canvas.width, canvas.height);
  }
  function invert() {
    push();
    const image = snapshot();
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = 255 - image.data[i];
      image.data[i + 1] = 255 - image.data[i + 1];
      image.data[i + 2] = 255 - image.data[i + 2];
    }
    drawing.putImageData(image, 0, 0);
  }
  function save() {
    return new Promise((resolve) =>
      canvas.toBlob((blob) => {
        if (blob) {
          download('Dibujo.png', blob);
          dirty = false;
        }
        resolve(!!blob);
      }, 'image/png'),
    );
  }
  function setColor(value) {
    color = value;
    $('.paint-current-color i', colors).style.background = value;
    $('.paint-custom-color', colors).value = value;
  }
  $$('[data-color]', colors).forEach((b) => (b.onclick = () => setColor(b.dataset.color)));
  $('.paint-custom-color', colors).oninput = (e) => setColor(e.target.value);
  $$('[data-tool]', body).forEach(
    (b) =>
      (b.onclick = () => {
        tool = b.dataset.tool;
        $$('[data-tool]', body).forEach((x) => {
          x.classList.toggle('selected', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        $('.paint-tip', status).textContent = TOOLS.find((t) => t[0] === tool)[1];
        canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
      }),
  );
  $$('[data-thickness]', body).forEach(
    (b) =>
      (b.onclick = () => {
        thickness = Number(b.dataset.thickness);
        $$('[data-thickness]', body).forEach((x) => x.classList.toggle('selected', x === b));
      }),
  );
  const coords = (event) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(canvas.width - 1, Math.floor(((event.clientX - r.left) * canvas.width) / r.width)),
      ),
      y: Math.max(
        0,
        Math.min(
          canvas.height - 1,
          Math.floor(((event.clientY - r.top) * canvas.height) / r.height),
        ),
      ),
    };
  };
  function flood(x, y) {
    const image = snapshot(),
      { data } = image,
      width = canvas.width,
      total = width * canvas.height,
      start = y * width + x;
    const original = [...data.slice(start * 4, start * 4 + 4)],
      replacement = [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
        255,
      ];
    if (original.every((n, i) => n === replacement[i])) return;
    const queue = new Uint32Array(total);
    let head = 0,
      tail = 1;
    queue[0] = start;
    const match = (index) => original.every((n, i) => data[index * 4 + i] === n);
    const mark = (index) => {
      for (let i = 0; i < 4; i++) data[index * 4 + i] = replacement[i];
    };
    mark(start);
    while (head < tail) {
      const p = queue[head++];
      const neighbors = [];
      if (p % width) neighbors.push(p - 1);
      if (p % width < width - 1) neighbors.push(p + 1);
      if (p >= width) neighbors.push(p - width);
      if (p < total - width) neighbors.push(p + width);
      for (const n of neighbors)
        if (match(n)) {
          mark(n);
          queue[tail++] = n;
        }
    }
    drawing.putImageData(image, 0, 0);
  }
  let operation = null;
  canvas.onpointerdown = async (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const point = coords(event);
    if (tool === 'picker') {
      const d = drawing.getImageData(point.x, point.y, 1, 1).data;
      setColor('#' + [...d.slice(0, 3)].map((n) => n.toString(16).padStart(2, '0')).join(''));
      return;
    }
    if (tool === 'text') {
      const text = await ui.prompt('Texto', 'Escriba el texto:');
      if (text) {
        push();
        drawing.font = `${Math.max(14, thickness * 5)}px Arial`;
        drawing.fillStyle = color;
        drawing.fillText(text, point.x, point.y + Math.max(14, thickness * 5));
      }
      return;
    }
    push();
    if (tool === 'fill') {
      flood(point.x, point.y);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    operation = { start: point, last: point, snapshot: snapshot(), tool, id: event.pointerId };
    drawing.strokeStyle = tool === 'eraser' ? '#fff' : color;
    drawing.lineWidth =
      tool === 'eraser' ? thickness * 6 : tool === 'brush' ? thickness * 3 : thickness;
    drawing.lineCap = 'round';
    drawing.lineJoin = 'round';
    if (['pencil', 'brush', 'eraser'].includes(tool)) {
      drawing.beginPath();
      drawing.moveTo(point.x, point.y);
      drawing.lineTo(point.x + 0.1, point.y + 0.1);
      drawing.stroke();
    }
  };
  canvas.onpointermove = (event) => {
    const point = coords(event);
    $('.paint-position', status).textContent = `${point.x}, ${point.y} px`;
    if (!operation || operation.id !== event.pointerId) return;
    const { start, last } = operation;
    if (['pencil', 'brush', 'eraser'].includes(operation.tool)) {
      drawing.beginPath();
      drawing.moveTo(last.x, last.y);
      drawing.lineTo(point.x, point.y);
      drawing.stroke();
    } else {
      drawing.putImageData(operation.snapshot, 0, 0);
      drawing.beginPath();
      const x = Math.min(start.x, point.x),
        y = Math.min(start.y, point.y),
        w = Math.abs(point.x - start.x),
        h = Math.abs(point.y - start.y);
      if (operation.tool === 'line') {
        drawing.moveTo(start.x, start.y);
        drawing.lineTo(point.x, point.y);
      } else if (operation.tool === 'ellipse')
        drawing.ellipse(
          x + w / 2,
          y + h / 2,
          Math.max(0.1, w / 2),
          Math.max(0.1, h / 2),
          0,
          0,
          Math.PI * 2,
        );
      else if (operation.tool === 'round')
        drawing.roundRect(x, y, w, h, Math.min(12, w / 2, h / 2));
      else drawing.rect(x, y, w, h);
      drawing.stroke();
    }
    operation.last = point;
  };
  const finish = (event) => {
    if (!operation || operation.id !== event.pointerId) return;
    operation = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.onpointerup = finish;
  canvas.onpointercancel = finish;
  canvas.onlostpointercapture = finish;
  async function openImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10_000_000) return ui.alert('La imagen supera el límite de 10 MB.', 'Paint');
      try {
        const image = await createImageBitmap(file);
        push();
        drawing.fillStyle = '#fff';
        drawing.fillRect(0, 0, canvas.width, canvas.height);
        const factor = Math.min(canvas.width / image.width, canvas.height / image.height, 1);
        drawing.drawImage(image, 0, 0, image.width * factor, image.height * factor);
        image.close();
      } catch {
        ui.alert('No se ha podido abrir la imagen.', 'Paint');
      }
    };
    input.click();
  }
  win.onBeforeClose = async () => {
    if (!dirty) return true;
    const { action } = await ui.dialog({
      title: 'Paint',
      body: '<p>¿Desea guardar los cambios en Sin título?</p>',
      buttons: [
        { label: 'Guardar', value: 'save', primary: true },
        { label: 'No guardar', value: 'discard' },
        { label: 'Cancelar', value: 'cancel' },
      ],
    });
    return action === 'save' ? save() : action === 'discard';
  };
  win.onKeydown = (event) => {
    if (!event.ctrlKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if (key === 'y') {
      event.preventDefault();
      redo();
    } else if (key === 's') {
      event.preventDefault();
      save();
    } else if (key === 'n') {
      event.preventDefault();
      clear();
    }
  };
  win.cleanup.push(() => {
    history = [];
    redoHistory = [];
    canvas.width = 0;
    canvas.height = 0;
  });
  return win;
}
