import { iconClose, logoSvg } from './icons.js';
import { createTranslator } from './i18n/index.js';
import { LANGUAGES } from './i18n/languages.js';

const CARD_WIDTH = 440;

// The list of languages, each written in its own language. At first launch it
// is a small window of its own, like the welcome card; from the menu, a dialog
// over the streams. Resolves with the code chosen, or null if closed.
export function chooseLanguage(root, argos, { selected, asDialog = false }) {
  const tr = createTranslator(selected);
  const el = document.createElement('div');
  el.className = asDialog ? 'lang-backdrop' : 'login';
  el.innerHTML = `
    <div class="lang-card" role="dialog">
      ${asDialog ? '' : '<div class="drag-strip"></div>'}
      <button class="${asDialog ? 'corner-x lang-x' : 'login-quit'}" type="button">${iconClose}</button>
      ${logoSvg(32)}
      <h1 class="lang-title"></h1>
      <div class="lang-grid"></div>
      <p class="lang-hint"></p>
    </div>`;
  root.append(el);

  const card = el.querySelector('.lang-card');
  const close = el.querySelector(asDialog ? '.lang-x' : '.login-quit');
  card.setAttribute('aria-label', tr('language.title'));
  close.setAttribute('aria-label', asDialog ? tr('common.close') : tr('welcome.quit'));
  el.querySelector('.lang-title').textContent = tr('language.title');
  const hint = el.querySelector('.lang-hint');
  hint.textContent = tr('language.hint');
  hint.hidden = asDialog;

  const grid = el.querySelector('.lang-grid');
  const buttons = LANGUAGES.map(({ code, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = code === selected ? 'lang-btn on' : 'lang-btn';
    button.lang = code;
    button.textContent = name;
    button.dataset.code = code;
    return button;
  });
  grid.append(...buttons);

  let stopBand = () => {};
  if (!asDialog) {
    stopBand = argos.onTopBand((visible) => el.classList.toggle('band-visible', visible));
    argos.window.setMode('login', { width: CARD_WIDTH, height: card.offsetHeight });
  }
  requestAnimationFrame(() => (buttons.find((b) => b.dataset.code === selected) ?? buttons[0]).focus());

  return new Promise((resolve) => {
    const done = (code) => {
      stopBand();
      removeEventListener('keydown', onKey, true);
      el.remove();
      resolve(code);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape' || !asDialog) return;
      event.stopImmediatePropagation();
      done(null);
    };
    addEventListener('keydown', onKey, true);
    grid.addEventListener('click', (event) => {
      const code = event.target.closest('.lang-btn')?.dataset.code;
      if (code) done(code);
    });
    close.addEventListener('click', () => {
      if (asDialog) done(null);
      else argos.window.close();
    });
    if (asDialog) {
      el.addEventListener('click', (event) => {
        if (event.target === el) done(null);
      });
    }
  });
}
