import { showContextMenu } from './context-menu.js';
import { t } from './i18n/index.js';
import { iconClose, iconMaximize, iconMinimize, iconRestore } from './icons.js';

const markup = `
  <div class="topband-drag"></div>
  <button class="topband-tab" type="button">▾ <span class="topband-label"></span> · <span class="topband-count">…</span></button>
  <div class="win-buttons">
    <button class="win-btn win-min" type="button">${iconMinimize}</button>
    <button class="win-btn win-max" type="button">${iconMaximize}</button>
    <button class="win-btn win-close" type="button">${iconClose}</button>
  </div>`;

// Invisible until the cursor touches the top edge of the window (the main
// process watches the cursor). Holds the follows tab and the window buttons.
export function createTopBand(root, { argos, onOpenPicker, onLogout, onLanguage }) {
  const band = document.createElement('div');
  band.className = 'topband';
  band.innerHTML = markup;
  root.append(band);

  const count = band.querySelector('.topband-count');
  const tab = band.querySelector('.topband-tab');
  const maxBtn = band.querySelector('.win-max');
  band.querySelector('.topband-label').textContent = t('band.follows');
  band.querySelector('.win-min').setAttribute('aria-label', t('window.minimize'));
  band.querySelector('.win-close').setAttribute('aria-label', t('common.close'));

  const setMaximized = (maximized) => {
    maxBtn.innerHTML = maximized ? iconRestore : iconMaximize;
    maxBtn.setAttribute('aria-label', maximized ? t('window.restore') : t('window.maximize'));
  };
  setMaximized(false);
  argos.window.isMaximized().then(setMaximized);
  const stopMax = argos.window.onMaximized(setMaximized);
  const stopBand = argos.onTopBand((visible) => band.classList.toggle('visible', visible));

  tab.addEventListener('click', onOpenPicker);
  tab.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: `🌐 ${t('language.menu')}`, onSelect: onLanguage },
        { label: t('band.logout'), onSelect: onLogout },
      ],
    });
  });
  band.querySelector('.win-min').addEventListener('click', () => argos.window.minimize());
  maxBtn.addEventListener('click', () => argos.window.toggleMaximize());
  band.querySelector('.win-close').addEventListener('click', () => argos.window.close());

  return {
    setCount(n) {
      count.textContent = String(n);
    },
    destroy() {
      stopMax();
      stopBand();
      band.remove();
    },
  };
}
