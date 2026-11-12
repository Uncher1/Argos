const EMBED_URL = 'https://player.twitch.tv/js/embed/v1.js';
const EVENTS = {
  ready: 'READY',
  play: 'PLAY',
  playing: 'PLAYING',
  pause: 'PAUSE',
  online: 'ONLINE',
  offline: 'OFFLINE',
  blocked: 'PLAYBACK_BLOCKED',
};

let embedPromise = null;

export function loadTwitchEmbed() {
  if (window.Twitch?.Player) return Promise.resolve();
  embedPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = EMBED_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      embedPromise = null;
      reject(new Error('Twitch player unavailable'));
    };
    document.head.append(script);
  });
  return embedPromise;
}

let nextId = 0;

// Thin wrapper around Twitch.Player. Calls made before the embed script is
// loaded fall back to sensible values; listeners are attached once it is.
export function createTwitchPlayer(container, { channel, muted }) {
  const listeners = [];
  let player = null;
  let destroyed = false;
  container.id ||= `twitch-player-${nextId++}`;

  const attach = (event, cb) => player.addEventListener(window.Twitch.Player[EVENTS[event]], cb);

  loadTwitchEmbed().then(() => {
    if (destroyed) return;
    player = new window.Twitch.Player(container.id, {
      channel,
      parent: ['localhost'],
      width: '100%',
      height: '100%',
      autoplay: true,
      muted,
    });
    for (const [event, cb] of listeners) attach(event, cb);
  }).catch(() => {});

  const call = (fn, fallback) => (player ? fn(player) : fallback);

  return {
    play: () => call((p) => p.play()),
    pause: () => call((p) => p.pause()),
    isPaused: () => call((p) => p.isPaused(), false),
    setVolume: (v) => call((p) => p.setVolume(v)),
    getVolume: () => call((p) => p.getVolume(), 0.5),
    setMuted: (b) => call((p) => p.setMuted(b)),
    getMuted: () => call((p) => p.getMuted(), muted),
    getQualities: () => call((p) => p.getQualities(), []),
    setQuality: (q) => call((p) => p.setQuality(q)),
    getQuality: () => call((p) => p.getQuality(), 'auto'),
    on(event, cb) {
      listeners.push([event, cb]);
      if (player) attach(event, cb);
    },
    destroy() {
      destroyed = true;
      container.replaceChildren();
    },
  };
}
