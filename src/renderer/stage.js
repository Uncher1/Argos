import { t } from './i18n/index.js';
import { logoSvg } from './icons.js';
import { computeRects } from './layout.js';
import { createStreamView } from './stream-view.js';

// The streams on screen. Stream elements are created once per channel and
// never moved in the DOM afterwards (that would reload the Twitch player):
// only their position changes. With no stream, a discreet prompt is shown.
export function createStage(root, {
  playerFactory, onEmptyClick, onStreamContextMenu, onStreamPointerDown, nameOf = (login) => login,
}) {
  const views = new Map();
  let state = null;
  let rects = [];

  const empty = document.createElement('div');
  empty.className = 'stage-empty';
  empty.innerHTML = `${logoSvg(40)}<p></p><button type="button"></button>`;
  empty.querySelector('p').textContent = t('stage.empty');
  empty.querySelector('button').textContent = t('stage.choose');
  empty.querySelector('button').addEventListener('click', onEmptyClick);
  root.append(empty);

  const indexOfView = (view) => state.channels.indexOf(view.login);

  function layout() {
    if (!state) return;
    rects = computeRects(state, { width: root.clientWidth, height: root.clientHeight });
    empty.hidden = state.channels.length > 0;
    state.channels.forEach((login, i) => views.get(login)?.setRect(rects[i].video));
  }

  function render(next) {
    state = next;
    for (const [login, view] of views) {
      if (!next.channels.includes(login)) {
        view.destroy();
        views.delete(login);
      }
    }
    for (const login of next.channels) {
      if (views.has(login)) continue;
      // Only one stream starts with sound: the first one when none is audible.
      const startMuted = [...views.values()].some((v) => !v.isMuted());
      const view = createStreamView({
        login,
        label: nameOf(login),
        startMuted,
        playerFactory,
        onContextMenu: (v, x, y) => onStreamContextMenu(indexOfView(v), x, y),
        onPointerDown: (v, event) => onStreamPointerDown(indexOfView(v), event),
      });
      views.set(login, view);
      root.append(view.el);
    }
    layout();
  }

  const observer = new ResizeObserver(layout);
  observer.observe(root);

  return {
    el: root,
    render,
    rects: () => rects,
    viewOf: (index) => (state?.channels[index] ? views.get(state.channels[index]) ?? null : null),
    destroy() {
      observer.disconnect();
      for (const view of views.values()) view.destroy();
      views.clear();
      empty.remove();
    },
  };
}
