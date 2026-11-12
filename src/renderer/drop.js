import { t } from './i18n/index.js';
import { columnRect } from './layout.js';

const contains = (r, p) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

// Where a dragged stream would land. When the featured stream is dragged,
// the column of small streams behaves as one single target.
export function hitTestDrop(state, rects, point, from) {
  if (state.featured && from === 0) {
    const column = columnRect(state, rects);
    return column && contains(column, point) ? { kind: 'column' } : null;
  }
  const index = rects.findIndex(({ cell }) => contains(cell, point));
  if (index === -1 || index === from) return null;
  return { kind: 'slot', index };
}

export function dropLabel(state, target) {
  if (target.kind === 'column') {
    return state.featuredSide === 'left' ? t('drop.moveRight') : t('drop.moveLeft');
  }
  return t('drop.swap');
}
