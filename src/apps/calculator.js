import { $, $$ } from '../utils.js';
import { Calculator } from '../calculator-model.js';

export function openCalculator(ctx) {
  const { wm, ui } = ctx;
  const model = new Calculator();
  let scientific = false;
  const win = wm.create('calculator', {
    title: 'Calculadora',
    icon: 'calculator',
    width: 286,
    height: 323,
    minWidth: 270,
    minHeight: 300,
    resizable: false,
    maximizable: false,
    className: 'calculator-app',
  });
  if (!win) return;
  const toggle = (value) => {
    scientific = value;
    win.el.classList.toggle('scientific', value);
    $('.calculator-scientific', win.body).hidden = !value;
    win.setSize(value ? 448 : 286, 323);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(model.display);
    } catch {
      ui.alert('Selecciona el resultado y usa Ctrl+C para copiarlo.', 'Calculadora');
    }
  };
  const paste = async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim().replace(',', '.');
      if (!/^-?\d+(\.\d+)?$/.test(value)) return;
      model.press('CE');
      for (const digit of value.replace('-', '')) model.press(digit);
      if (value.startsWith('-')) model.press('sign');
      render();
    } catch {
      ui.alert('No se permite el acceso al portapapeles en este navegador.', 'Calculadora');
    }
  };
  ui.menubar(win, [
    {
      label: 'Ver',
      items: () => [
        { label: 'Estándar', checked: !scientific, action: () => toggle(false) },
        { label: 'Científica', checked: scientific, action: () => toggle(true) },
      ],
    },
    {
      label: 'Edición',
      items: [
        { label: 'Copiar', shortcut: 'Ctrl+C', action: copy },
        { label: 'Pegar', shortcut: 'Ctrl+V', action: paste },
      ],
    },
    {
      label: 'Ayuda',
      items: [
        {
          label: 'Acerca de la Calculadora',
          action: () =>
            ui.alert(
              'Calculadora estándar. Admite operaciones encadenadas, porcentajes, raíz cuadrada, memoria y funciones científicas (ángulos en grados). Recreación de Windows Vista.',
              'Calculadora',
            ),
        },
      ],
    },
  ]);
  const wrapper = document.createElement('div');
  wrapper.className = 'calculator-content';
  const labels = {
    '/': '/',
    '*': '*',
    '-': '−',
    '+': '+',
    '=': '=',
    sign: '+/−',
    sqrt: '√',
    inv: '1/x',
    '.': ',',
    pi: 'π',
    square: 'x²',
    '^': 'xʸ',
  };
  const aria = {
    '/': 'Dividir',
    '*': 'Multiplicar',
    '-': 'Restar',
    '+': 'Sumar',
    '=': 'Igual',
    sign: 'Cambiar signo',
    sqrt: 'Raíz cuadrada',
    inv: 'Inverso',
    '.': 'Separador decimal',
    '%': 'Porcentaje',
  };
  const key = (value, className = '') =>
    `<button class="calc-key ${className}" data-key="${value}" aria-label="${aria[value] || value}">${labels[value] || value}</button>`;
  wrapper.innerHTML = `<input class="calculator-display" aria-label="Pantalla de la calculadora" value="0" readonly><div class="calculator-lower"><div class="calculator-scientific" hidden><div class="calc-degrees">● Grados</div><div class="scientific-keys">${['sin', 'cos', 'tan', 'log', 'ln', 'pi', 'square', '^', 'inv'].map((v) => key(v)).join('')}</div><small>Ángulos en grados</small></div><div class="calculator-standard"><div class="calculator-clear-row"><span class="memory-indicator" aria-label="Memoria"></span>${key('Backspace', 'backspace')}${key('CE', 'clear')}${key('C', 'clear')}</div><div class="calculator-keys">${[
    ['MC', '7', '8', '9', '/', 'sqrt'],
    ['MR', '4', '5', '6', '*', '%'],
    ['MS', '1', '2', '3', '-', 'inv'],
    ['M+', '0', 'sign', '.', '+', '='],
  ]
    .map((row) =>
      row.map((v, i) => key(v, i === 0 ? 'memory' : i > 3 ? 'operation' : 'digit')).join(''),
    )
    .join('')}</div></div></div>`;
  win.body.append(wrapper);
  $('[data-key="Backspace"]', wrapper).textContent = 'Retroceso';
  $('[data-key="Backspace"]', wrapper).setAttribute('aria-label', 'Retroceso');
  function render() {
    const display = $('.calculator-display', wrapper);
    display.value = model.display;
    display.style.fontSize =
      model.display.length > 22 ? '11px' : model.display.length > 16 ? '14px' : '18px';
    $('.memory-indicator', wrapper).textContent = model.memory !== 0 ? 'M' : '';
  }
  $$('[data-key]', wrapper).forEach(
    (button) =>
      (button.onclick = () => {
        model.press(button.dataset.key);
        render();
      }),
  );
  win.onKeydown = (event) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copy();
      } else if (event.key.toLowerCase() === 'v') {
        event.preventDefault();
        paste();
      }
      return;
    }
    const mapped = { Enter: '=', Escape: 'C', Delete: 'CE', ',': '.' }[event.key] || event.key;
    if (/^[\d.+\-*/=%]$/.test(mapped) || ['Backspace', 'C', 'CE'].includes(mapped)) {
      event.preventDefault();
      model.press(mapped);
      render();
      const button = $$('[data-key]', wrapper).find((b) => b.dataset.key === mapped);
      button?.classList.add('pressed');
      setTimeout(() => button?.classList.remove('pressed'), 100);
    }
  };
  render();
  return win;
}
