import { $, $$ } from '../utils.js';
import { Minesweeper } from '../minesweeper-model.js';

export function openGames(ctx) {
  const { wm, ui, storage } = ctx;
  const win = wm.create('games', {
    title: 'Buscaminas',
    icon: 'games',
    width: 342,
    height: 421,
    minWidth: 310,
    minHeight: 390,
    resizable: false,
    maximizable: false,
    className: 'mines-app',
  });
  if (!win) return;
  let model = new Minesweeper(),
    recorded = false;
  const stats = () => {
    const saved = storage.get('mines-stats.v1', {});
    return { played: Number(saved?.played) || 0, won: Number(saved?.won) || 0 };
  };
  const newGame = () => {
    model = new Minesweeper();
    recorded = false;
    render();
  };
  ui.menubar(win, [
    {
      label: 'Juego',
      items: [
        { label: 'Nueva partida', shortcut: 'F2', action: newGame },
        { label: 'Principiante · 9 × 9 · 10 minas', checked: true, action: newGame },
        { separator: true },
        {
          label: 'Estadísticas',
          action: () => {
            const s = stats();
            ui.alert(
              `Partidas terminadas: ${s.played}\nPartidas ganadas: ${s.won}\nPorcentaje de victorias: ${s.played ? Math.round((s.won / s.played) * 100) : 0}%`,
              'Estadísticas de Buscaminas',
            );
          },
        },
        { separator: true },
        { label: 'Salir', action: () => win.close() },
      ],
    },
    {
      label: 'Ayuda',
      items: [
        {
          label: 'Cómo jugar',
          action: () =>
            ui.alert(
              'Descubre todas las casillas que no contienen minas. Cada número indica cuántas minas hay en las ocho casillas contiguas. Haz clic con el botón derecho para poner o quitar una bandera. La primera casilla y sus vecinas son seguras. Usa las flechas y la tecla F para jugar con el teclado.',
              'Buscaminas',
            ),
        },
      ],
    },
  ]);
  const content = document.createElement('div');
  content.className = 'mines-content';
  content.innerHTML =
    '<div class="mines-counters"><output class="mines-remaining" aria-label="Minas restantes">010</output><button class="mines-face" aria-label="Nueva partida" title="Nueva partida"><i></i><span>◡</span></button><output class="mines-timer" aria-label="Tiempo">000</output></div><div class="mines-board" role="grid" aria-label="Tablero de Buscaminas"></div><p class="mines-tip">Clic derecho para marcar una mina.</p>';
  win.body.append(content);
  $('.mines-face', content).onclick = newGame;
  function render() {
    const oldFocus = document.activeElement?.dataset?.cell;
    const board = $('.mines-board', content);
    board.innerHTML = model.cells
      .map((cell, i) => {
        const mine = cell.mine && model.state === 'lost';
        const label = cell.flag
          ? 'Bandera'
          : mine
            ? 'Mina'
            : cell.open
              ? cell.adjacent
                ? `${cell.adjacent} minas adyacentes`
                : 'Vacía'
              : 'Casilla cerrada';
        return `<button data-cell="${i}" class="mines-cell ${cell.open ? 'open' : ''} ${cell.flag ? 'flagged' : ''} ${mine ? 'mine' : ''}" data-number="${cell.adjacent}" role="gridcell" aria-label="Fila ${Math.floor(i / 9) + 1}, columna ${(i % 9) + 1}: ${label}">${cell.flag ? '⚑' : mine ? '✹' : cell.open && cell.adjacent ? cell.adjacent : ''}</button>`;
      })
      .join('');
    $$('[data-cell]', board).forEach((b) => {
      b.onclick = () => {
        model.reveal(Number(b.dataset.cell));
        render();
      };
      b.oncontextmenu = (event) => {
        event.preventDefault();
        model.flag(Number(b.dataset.cell));
        render();
      };
      b.onkeydown = (event) => {
        const i = Number(b.dataset.cell),
          step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[event.key];
        if (step) {
          event.preventDefault();
          $$('[data-cell]', board)[Math.max(0, Math.min(80, i + step))].focus();
        } else if (event.key.toLowerCase() === 'f') {
          event.preventDefault();
          model.flag(i);
          render();
          $$('[data-cell]', board)[i].focus();
        }
      };
    });
    if (oldFocus !== undefined) $$('[data-cell]', board)[Number(oldFocus)]?.focus();
    $('.mines-remaining', content).textContent = String(model.mineCount - model.flags).padStart(
      3,
      '0',
    );
    $('.mines-timer', content).textContent = String(model.seconds).padStart(3, '0');
    $('.mines-face span', content).textContent =
      model.state === 'lost' ? '⌢' : model.state === 'won' ? '▿' : '◡';
    $('.mines-tip', content).textContent =
      model.state === 'won'
        ? '¡Enhorabuena! Has encontrado todas las minas.'
        : model.state === 'lost'
          ? 'Has encontrado una mina. Inténtalo otra vez.'
          : 'Clic derecho para marcar una mina.';
    if (!recorded && ['won', 'lost'].includes(model.state)) {
      recorded = true;
      const s = stats();
      storage.set('mines-stats.v1', {
        played: s.played + 1,
        won: s.won + (model.state === 'won' ? 1 : 0),
      });
    }
  }
  const timer = setInterval(() => {
    if (!document.hidden && !win.minimized)
      $('.mines-timer', content).textContent = String(model.seconds).padStart(3, '0');
  }, 1000);
  win.cleanup.push(() => clearInterval(timer));
  win.onKeydown = (event) => {
    if (event.key === 'F2') {
      event.preventDefault();
      newGame();
    }
  };
  render();
  return win;
}
