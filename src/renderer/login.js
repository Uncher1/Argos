import { getLanguage, t } from './i18n/index.js';
import { LANGUAGES } from './i18n/languages.js';
import { iconClose, logoSvg } from './icons.js';

const CARD_WIDTH = 440;

const html = `
  <div class="login-card">
    <div class="drag-strip"></div>
    <button class="login-quit" type="button">${iconClose}</button>
    ${logoSvg(40)}
    <h1 class="login-title"></h1>
    <p class="login-text"></p>
    <button class="login-btn" type="button"></button>
    <p class="login-error" hidden></p>
    <button class="login-lang" type="button"></button>
  </div>
  <div class="auth-panel" hidden>
    <div class="auth-head">
      ${logoSvg(16)}<span class="auth-name">Argos</span>
      <button class="auth-close" type="button">${iconClose}</button>
    </div>
    <div class="auth-consent" hidden>
      <div class="auth-link">${logoSvg(28)}<span class="auth-dots"><i>✓</i></span><span class="auth-account"></span></div>
      <b class="consent-title"></b>
      <p><span class="consent-text"></span><br><span class="consent-safe"></span></p>
    </div>
    <div class="auth-google" hidden>
      <b class="google-title"></b>
      <p><span class="google-text"></span><br><span class="google-password"></span></p>
    </div>
    <div class="auth-slot"></div>
  </div>`;

// "Welcome to {app}" with the app name highlighted, wherever the language puts it.
function fillTitle(h1) {
  const [before, after = ''] = t('welcome.title', { app: '\u0000' }).split('\u0000');
  const name = document.createElement('span');
  name.textContent = 'Argos';
  h1.replaceChildren(before, name, after);
}

function fillTexts(el) {
  const set = (sel, text) => {
    el.querySelector(sel).textContent = text;
  };
  fillTitle(el.querySelector('.login-title'));
  set('.login-text', t('welcome.text'));
  set('.login-btn', t('welcome.login'));
  set('.login-error', t('welcome.missingClientId'));
  set('.login-lang', `🌐 ${LANGUAGES.find((l) => l.code === getLanguage())?.name ?? 'English'}`);
  set('.consent-title', t('auth.consentTitle'));
  set('.consent-text', t('auth.consentText'));
  set('.consent-safe', t('auth.consentSafe'));
  set('.google-title', t('auth.googleTitle'));
  set('.google-text', t('auth.googleText'));
  set('.google-password', t('auth.googleNoPassword', { link: t('auth.troubleLink') }));
  el.querySelector('.login-quit').setAttribute('aria-label', t('welcome.quit'));
  el.querySelector('.auth-close').setAttribute('aria-label', t('common.cancel'));
  el.querySelector('.login-lang').setAttribute('aria-label', t('language.menu'));
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// The welcome card (4a) is a small window of its own; the Twitch sign-in
// panel (4b, 4c) too. Resolves with the session once the user is signed in.
// The language button hands over to onChangeLanguage (the page then reloads).
export function showLogin(root, argos, { onChangeLanguage = () => {} } = {}) {
  const el = document.createElement('div');
  el.className = 'login';
  el.innerHTML = html;
  fillTexts(el);
  root.append(el);

  const $ = (sel) => el.querySelector(sel);
  const card = $('.login-card');
  const button = $('.login-btn');
  const error = $('.login-error');
  const panel = $('.auth-panel');
  const consent = $('.auth-consent');
  const google = $('.auth-google');
  const slot = $('.auth-slot');

  const showCard = async () => {
    panel.hidden = true;
    card.hidden = false;
    await argos.window.setMode('login', { width: CARD_WIDTH, height: card.offsetHeight });
  };
  const slotBounds = () => {
    const r = slot.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  };
  const onResize = () => {
    if (!panel.hidden) argos.login.setBounds(slotBounds());
  };
  // The window takes the height of the Twitch page plus everything around it
  // (header, notices, border).
  let pageHeight = 0;
  const fitToPage = () => {
    if (!panel.hidden && pageHeight) argos.window.fitHeight(Math.ceil(innerHeight - slot.getBoundingClientRect().height + pageHeight));
  };
  const stopHeight = argos.login.onContentHeight((height) => {
    pageHeight = height;
    fitToPage();
  });
  const stopStage = argos.login.onStage((stage) => {
    consent.hidden = stage !== 'consent';
    if (stage === 'google-blocked') google.hidden = false;
    if (stage === 'consent') google.hidden = true;
    requestAnimationFrame(() => {
      onResize();
      fitToPage();
    });
  });
  const stopBand = argos.onTopBand((visible) => el.classList.toggle('band-visible', visible));
  addEventListener('resize', onResize);
  $('.login-quit').addEventListener('click', () => argos.window.close());
  $('.auth-close').addEventListener('click', () => argos.login.cancel());
  $('.login-lang').addEventListener('click', () => {
    stopStage();
    stopHeight();
    stopBand();
    removeEventListener('resize', onResize);
    el.remove();
    onChangeLanguage();
  });

  showCard();

  return new Promise((resolve) => {
    button.addEventListener('click', async () => {
      error.hidden = true;
      card.hidden = true;
      consent.hidden = true;
      google.hidden = true;
      pageHeight = 0;
      panel.hidden = false;
      await argos.window.setMode('auth');
      await nextFrame();
      const result = await argos.login.start(slotBounds());
      if (result?.token) {
        stopStage();
        stopHeight();
        stopBand();
        removeEventListener('resize', onResize);
        el.remove();
        resolve(result);
        return;
      }
      error.hidden = result?.error !== 'missing-client-id';
      await showCard();
    });
  });
}
