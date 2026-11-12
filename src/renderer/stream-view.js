import { t } from './i18n/index.js';
import { iconMuted, iconPause, iconPlay, iconVolume } from './icons.js';

const HIDE_DELAY = 2500;
const HINT_DELAY = 15000;

const markup = `
  <div class="stream-player"></div>
  <div class="stream-offline" hidden><span class="stream-offline-name"></span><span class="stream-offline-text"></span></div>
  <div class="stream-paused" hidden><span class="stream-paused-name"></span><span class="stream-paused-text"></span></div>
  <div class="stream-overlay"></div>
  <div class="stream-hint" hidden></div>
  <div class="stream-controls">
    <button class="ctl-play" type="button">${iconPause}</button>
    <button class="ctl-mute" type="button">${iconVolume}</button>
    <input class="ctl-volume" type="range" min="0" max="100" value="50">
    <span class="ctl-spacer"></span>
    <select class="ctl-quality"><option value="auto"></option></select>
  </div>`;

// One stream: the Twitch player, a transparent layer that catches the mouse
// (so Twitch's own controls never show), and Argos' bottom bar.
export function createStreamView({ login, label = login, startMuted, playerFactory, onContextMenu, onPointerDown }) {
  const el = document.createElement('div');
  el.className = 'stream';
  el.dataset.login = login;
  el.innerHTML = markup;
  el.querySelector('.stream-offline-name').textContent = label;
  el.querySelector('.stream-paused-name').textContent = label;
  el.querySelector('.stream-offline-text').textContent = t('stream.offline');
  el.querySelector('.stream-paused-text').textContent = t('stream.paused');
  el.querySelector('.stream-hint').textContent = t('stream.clickToStart');
  el.querySelector('.ctl-play').setAttribute('aria-label', t('stream.pause'));
  el.querySelector('.ctl-mute').setAttribute('aria-label', t('stream.mute'));
  el.querySelector('.ctl-volume').setAttribute('aria-label', t('stream.volume'));
  el.querySelector('.ctl-quality').setAttribute('aria-label', t('stream.quality'));
  el.querySelector('.ctl-quality option').textContent = t('stream.auto');

  const $ = (sel) => el.querySelector(sel);
  const offline = $('.stream-offline');
  const pausedCover = $('.stream-paused');
  const overlay = $('.stream-overlay');
  const hint = $('.stream-hint');
  const controls = $('.stream-controls');
  const playBtn = $('.ctl-play');
  const muteBtn = $('.ctl-mute');
  const volume = $('.ctl-volume');
  const quality = $('.ctl-quality');

  const player = playerFactory($('.stream-player'), { channel: login, muted: startMuted });
  let muted = startMuted;
  let hideTimer = null;
  let hintTimer = null;
  let qualitiesLoaded = false;

  const view = {
    el,
    login,
    setRect(r) {
      el.style.left = `${r.x}px`;
      el.style.top = `${r.y}px`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
    },
    isMuted: () => muted,
    destroy() {
      clearTimeout(hideTimer);
      clearTimeout(hintTimer);
      player.destroy();
      el.remove();
    },
  };

  // Twitch shows its own card (title, Follow, Sub) on a paused player: cover it.
  const refreshPlay = () => {
    const paused = player.isPaused();
    playBtn.innerHTML = paused ? iconPlay : iconPause;
    playBtn.setAttribute('aria-label', paused ? t('stream.play') : t('stream.pause'));
    pausedCover.hidden = !paused || el.classList.contains('passthrough');
  };
  const refreshSound = () => {
    muteBtn.innerHTML = muted ? iconMuted : iconVolume;
    muteBtn.setAttribute('aria-label', muted ? t('stream.unmute') : t('stream.mute'));
    volume.value = muted ? 0 : Math.round(player.getVolume() * 100);
  };
  const setMuted = (value) => {
    muted = value;
    player.setMuted(value);
    refreshSound();
  };

  const loadQualities = () => {
    const list = player.getQualities();
    if (qualitiesLoaded || list.length === 0) return;
    qualitiesLoaded = true;
    quality.replaceChildren();
    const options = list.some((q) => q.group === 'auto') ? list : [{ group: 'auto', name: t('stream.auto') }, ...list];
    for (const q of options) {
      const option = document.createElement('option');
      option.value = q.group;
      option.textContent = q.group === 'auto' ? t('stream.auto') : q.name;
      quality.append(option);
    }
    quality.value = player.getQuality() || 'auto';
  };

  // Until the stream really plays, clicks go to the Twitch player itself: some
  // Twitch screens need one (mature content warning, blocked playback).
  const setPassthrough = (on) => {
    el.classList.toggle('passthrough', on);
    clearTimeout(hintTimer);
    hint.hidden = true;
    if (on) hintTimer = setTimeout(() => { hint.hidden = false; }, HINT_DELAY);
  };
  setPassthrough(true);

  player.on('ready', refreshSound);
  player.on('online', () => {
    offline.hidden = true;
  });
  player.on('offline', () => {
    setPassthrough(false);
    pausedCover.hidden = true;
    offline.hidden = false;
  });
  player.on('playing', () => {
    setPassthrough(false);
    offline.hidden = true;
    muted = player.getMuted();
    refreshPlay();
    refreshSound();
    loadQualities();
  });
  player.on('blocked', () => setPassthrough(true));
  player.on('play', refreshPlay);
  player.on('pause', refreshPlay);

  // Bottom bar: visible while the mouse moves over the stream.
  const hide = () => {
    if (controls.matches(':hover') || quality.matches(':focus')) {
      hideTimer = setTimeout(hide, HIDE_DELAY);
      return;
    }
    el.classList.remove('show-controls');
  };
  el.addEventListener('pointermove', () => {
    el.classList.add('show-controls');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY);
  });
  el.addEventListener('pointerleave', () => {
    clearTimeout(hideTimer);
    el.classList.remove('show-controls');
  });

  playBtn.addEventListener('click', () => {
    if (player.isPaused()) player.play();
    else player.pause();
    setTimeout(refreshPlay, 50);
  });
  muteBtn.addEventListener('click', () => setMuted(!muted));
  volume.addEventListener('input', () => {
    player.setVolume(Number(volume.value) / 100);
    if (muted) {
      muted = false;
      player.setMuted(false);
      muteBtn.innerHTML = iconVolume;
    }
  });
  quality.addEventListener('change', () => player.setQuality(quality.value));

  overlay.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    onContextMenu(view, event.clientX, event.clientY);
  });
  overlay.addEventListener('pointerdown', (event) => {
    if (event.button === 0) onPointerDown(view, event);
  });

  return view;
}
