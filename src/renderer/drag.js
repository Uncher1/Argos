import { dropLabel, hitTestDrop } from './drop.js';
import { columnRect } from './layout.js';
import { resolveDrop } from './state.js';

const THRESHOLD = 6;

const place = (el, r) => {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
};

// Left button held on a stream + move = drag. A plain click does nothing.
export function attachDrag({ stage, getState, setState, overlayRoot }) {
  let drag = null;

  function begin(index) {
    const view = stage.viewOf(index);
    if (!view) return;
    view.el.classList.add('dragging');
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = view.login;
    const highlight = document.createElement('div');
    highlight.className = 'drop-highlight';
    highlight.hidden = true;
    const label = document.createElement('span');
    highlight.append(label);
    overlayRoot.append(highlight, ghost);
    drag = { index, view, ghost, highlight, label, target: null };
  }

  function update(event) {
    const point = { x: event.clientX, y: event.clientY };
    drag.ghost.style.transform = `translate(${point.x + 14}px, ${point.y + 14}px)`;
    const state = getState();
    const rects = stage.rects();
    const target = hitTestDrop(state, rects, point, drag.index);
    drag.target = target;
    drag.highlight.hidden = !target;
    if (!target) return;
    place(drag.highlight, target.kind === 'column' ? columnRect(state, rects) : rects[target.index].cell);
    drag.label.textContent = dropLabel(state, target);
  }

  function end(apply) {
    if (!drag) return;
    const { index, target, view, ghost, highlight } = drag;
    drag = null;
    view.el.classList.remove('dragging');
    ghost.remove();
    highlight.remove();
    if (apply && target) setState(resolveDrop(getState(), index, target));
  }

  function onPointerDown(index, event) {
    if (index < 0) return;
    const source = event.target;
    const start = { x: event.clientX, y: event.clientY };
    try {
      source.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already released pointer: dragging still works without capture.
    }
    const onMove = (e) => {
      if (!drag) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < THRESHOLD) return;
        begin(index);
        if (!drag) return;
      }
      update(e);
    };
    const stop = (apply) => () => {
      source.removeEventListener('pointermove', onMove);
      source.removeEventListener('pointerup', onUp);
      source.removeEventListener('pointercancel', onCancel);
      end(apply);
    };
    const onUp = stop(true);
    const onCancel = stop(false);
    source.addEventListener('pointermove', onMove);
    source.addEventListener('pointerup', onUp);
    source.addEventListener('pointercancel', onCancel);
  }

  return { onPointerDown };
}
