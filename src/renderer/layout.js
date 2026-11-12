export const ASPECT = 16 / 9;
export const GAP = 2;

const pos = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const rect = (x, y, w, h) => ({ x: pos(x), y: pos(y), w: pos(w), h: pos(h) });

// Largest rectangle of the given aspect ratio, centered inside `r`.
export function fitAspect(r, aspect) {
  if (r.w <= 0 || r.h <= 0) return rect(r.x, r.y, 0, 0);
  let w = r.w;
  let h = w / aspect;
  if (h > r.h) {
    h = r.h;
    w = h * aspect;
  }
  return rect(r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

function sideBySide(n, width, height, gap) {
  const w = pos((width - gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => rect(i * (w + gap), 0, w, height));
}

function grid(width, height, gap) {
  const cw = pos((width - gap) / 2);
  const ch = pos((height - gap) / 2);
  return [rect(0, 0, cw, ch), rect(cw + gap, 0, cw, ch), rect(0, ch + gap, cw, ch), rect(cw + gap, ch + gap, cw, ch)];
}

// The featured stream (index 0) on one side, the others stacked on the other.
function featuredCells(state, width, height, gap) {
  const rows = state.channels.length - 1;
  const rowH = pos((height - gap * (rows - 1)) / rows);
  const colW = pos(Math.min((width - gap) / 3, rowH * ASPECT));
  const bigW = pos(width - colW - gap);
  const left = state.featuredSide !== 'right';
  const cells = [rect(left ? 0 : colW + gap, 0, bigW, height)];
  for (let row = 0; row < rows; row += 1) {
    cells.push(rect(left ? bigW + gap : 0, row * (rowH + gap), colW, rowH));
  }
  return cells;
}

// One {cell, video} per stream, in the order of state.channels.
export function computeRects(state, size, gap = GAP) {
  const width = pos(size.width);
  const height = pos(size.height);
  const n = state.channels.length;
  let cells;
  if (n === 0) return [];
  if (n <= 2) cells = sideBySide(n, width, height, gap);
  else if (state.featured || n === 3) return stackColumn(featuredCells(state, width, height, gap), height, gap);
  else cells = grid(width, height, gap);
  return cells.map((cell) => ({ cell, video: fitAspect(cell, ASPECT) }));
}

// The small videos are stacked against each other and centered as a block,
// instead of each floating in the middle of its own cell.
function stackColumn(cells, height, gap) {
  const rects = cells.map((cell) => ({ cell, video: fitAspect(cell, ASPECT) }));
  const small = rects.slice(1);
  const h = small[0].video.h;
  let y = pos((height - (small.length * h + (small.length - 1) * gap)) / 2);
  for (const r of small) {
    r.video = rect(r.video.x, y, r.video.w, h);
    y += h + gap;
  }
  return rects;
}

// The column of small streams, used as a single drop zone for the featured one.
export function columnRect(state, rects) {
  if (!state.featured || rects.length < 3) return null;
  const cells = rects.slice(1).map((r) => r.cell);
  const top = Math.min(...cells.map((c) => c.y));
  const bottom = Math.max(...cells.map((c) => c.y + c.h));
  return rect(cells[0].x, top, cells[0].w, bottom - top);
}
