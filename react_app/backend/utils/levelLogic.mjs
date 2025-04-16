// backend/utils/levelLogic.mjs
/**
 * Набор функций, повторяющих фронтовую логику переливания.
 * Используется на сервере, чтобы гарантировать корректность хода.
 */

export function findTop(tube) {
  for (let i = 0; i < tube.length; i++) {
    if (tube[i] !== -1) return i;
  }
  return -1;
}

export function canPour(source, target) {
  const fromTop = findTop(source);
  if (fromTop === -1) return false;          // источник пуст
  const toTop = findTop(target);
  if (toTop === 0) return false;             // приёмник заполнен
  const fromColor = source[fromTop];
  if (toTop === -1) return true;             // приёмник пуст
  return fromColor === target[toTop];        // цвета совпадают
}

export function pour(source, target) {
  const newSource = [...source];
  const newTarget = [...target];

  let fromTop = findTop(newSource);
  if (fromTop === -1) return { newSource, newTarget, moved: false };

  const color = newSource[fromTop];

  // сколько одинаковых сверху
  let count = 1;
  let idx = fromTop + 1;
  while (idx < newSource.length && newSource[idx] === color) {
    count++; idx++;
  }

  // куда льём
  let toTop = findTop(newTarget);
  toTop = toTop === -1 ? newTarget.length - 1 : toTop - 1;

  let moved = false;
  while (count > 0 && toTop >= 0) {
    if (newTarget[toTop] === -1) {
      newTarget[toTop] = color;
      newSource[fromTop] = -1;
      fromTop++; toTop--; count--; moved = true;
    } else break;
  }
  return { newSource, newTarget, moved };
}

export function isSolved(state) {
  for (const tube of state) {
    if (tube.every(c => c === -1)) continue; // пустая
    const first = tube[0];
    if (first === -1) return false;
    if (!tube.every(c => c === first)) return false;
  }
  return true;
}
