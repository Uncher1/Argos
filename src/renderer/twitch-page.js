import { t } from './i18n/index.js';
import { iconClose, logoSvg } from './icons.js';

let closeCurrent = null;

export const isTwitchPageOpen = () => closeCurrent !== null;
export const closeTwitchPage = () => closeCurrent?.();

// Panel showing a channel's real Twitch page (sound off), so the user can use
// Twitch's own Follow button. Resolves once the panel is closed.
export function showTwitchPage({ argos, login, name }) {
  closeTwitchPage();
  const backdrop = document.createElement('div');
  backdrop.className = 'tp-backdrop';
  backdrop.innerHTML = `
    <div class="tp-panel" role="dialog">
      <div class="tp-head">
        ${logoSvg(16)}<span class="tp-app">Argos</span><span class="tp-title"></span>
        <button class="tp-close" type="button">${iconClose}</button>
      </div>
      <div class="tp-slot"></div>
    </div>`;
  backdrop.querySelector('.tp-title').textContent = t('twitchPage.title', { name });
  backdrop.querySelector('.tp-close').setAttribute('aria-label', t('common.close'));
  document.body.append(backdrop);
  const slot = backdrop.querySelector('.tp-slot');

  const bounds = () => {
    const r = slot.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  };
  const onResize = () => argos.twitchPage.setBounds(bounds());

  return new Promise((resolve) => {
    const close = () => {
      removeEventListener('resize', onResize);
      argos.twitchPage.close();
      backdrop.remove();
      closeCurrent = null;
      resolve();
    };
    closeCurrent = close;
    backdrop.querySelector('.tp-close').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    addEventListener('resize', onResize);
    requestAnimationFrame(() => argos.twitchPage.open(login, bounds()));
  });
}
