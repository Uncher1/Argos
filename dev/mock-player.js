// Fake Twitch player for the browser test bench.
// Channels starting with "off" are offline, with "gate" never start playing.
const GRADIENTS = [
  ['#2b2350', '#141220'], ['#1f3a2e', '#0f1a15'], ['#3a2a1a', '#1a130c'],
  ['#1c2c44', '#0d1420'], ['#44203a', '#1d0d18'], ['#2d3a16', '#141a0a'],
];

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function createMockPlayer(container, { channel, muted }) {
  const [a, b] = GRADIENTS[hash(channel) % GRADIENTS.length];
  const video = document.createElement('div');
  video.className = 'mock-video';
  video.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font:600 20px system-ui,sans-serif;color:rgba(255,255,255,.55);background:linear-gradient(135deg,${a},${b})`;
  video.textContent = channel;
  container.append(video);

  const handlers = {};
  const emit = (event) => (handlers[event] ?? []).forEach((cb) => cb());
  const state = { paused: false, muted, volume: 0.5, quality: 'auto' };
  video.dataset.muted = String(state.muted);

  setTimeout(() => {
    emit('ready');
    if (channel.startsWith('off')) {
      emit('offline');
    } else {
      emit('online');
      if (!channel.startsWith('gate')) emit('playing');
    }
  }, 300);

  return {
    play() { state.paused = false; emit('play'); emit('playing'); },
    pause() { state.paused = true; emit('pause'); },
    isPaused: () => state.paused,
    setVolume(v) { state.volume = v; },
    getVolume: () => state.volume,
    setMuted(m) { state.muted = m; video.dataset.muted = String(m); },
    getMuted: () => state.muted,
    getQualities: () => [
      { group: 'auto', name: 'Auto' },
      { group: 'chunked', name: '1080p60' },
      { group: '720p60', name: '720p60' },
      { group: '480p30', name: '480p' },
    ],
    setQuality(q) { state.quality = q; },
    getQuality: () => state.quality,
    on(event, cb) { (handlers[event] ??= []).push(cb); },
    destroy() { container.replaceChildren(); },
  };
}
