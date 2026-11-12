// The streams on screen (1 to 4, in display order) and whether the first one
// is featured. Every function returns a new state and never mutates its input.
//
// Rules: under 3 streams nothing is featured; with 3 one stream is always
// featured (by default the earliest chosen); with 4 only if the user chose it
// ("Spotlight"), the automatic one of 3 streams goes back to 4 equal cells.

export const MAX_STREAMS = 4;

const norm = (login) => String(login).trim().toLowerCase();

export function createState() {
  return { channels: [], featured: false, featuredByUser: false, featuredSide: 'left', picked: {}, seq: 0 };
}

export const count = (state) => state.channels.length;
export const isFull = (state) => count(state) === MAX_STREAMS;
export const indexOf = (state, login) => state.channels.indexOf(norm(login));
export const canFeature = (state) => count(state) >= 3;

const earliest = (state) => state.channels.reduce(
  (best, login, i) => (state.picked[login] < state.picked[state.channels[best]] ? i : best),
  0,
);

const moveToFront = (channels, index) => [channels[index], ...channels.filter((_, i) => i !== index)];

function normalize(state) {
  const n = count(state);
  if (n < 3) return { ...state, featured: false, featuredByUser: false };
  if (n === 3 && !state.featured) {
    return { ...state, featured: true, featuredByUser: false, channels: moveToFront(state.channels, earliest(state)) };
  }
  if (n === MAX_STREAMS && state.featured && !state.featuredByUser) return { ...state, featured: false };
  return state;
}

export function addChannel(state, login) {
  const existing = indexOf(state, login);
  if (existing !== -1) return { state, index: existing };
  if (isFull(state)) return { state, full: true };
  const name = norm(login);
  const seq = state.seq + 1;
  const next = normalize({
    ...state,
    seq,
    channels: [...state.channels, name],
    picked: { ...state.picked, [name]: seq },
  });
  return { state: next, index: next.channels.indexOf(name) };
}

export function removeAt(state, index) {
  const login = state.channels[index];
  if (login === undefined) return state;
  const { [login]: _, ...picked } = state.picked;
  // Removing the featured stream: the next featured one is chosen again.
  const featured = state.featured && index !== 0;
  return normalize({ ...state, featured, picked, channels: state.channels.filter((_, i) => i !== index) });
}

export function replaceAt(state, index, login) {
  const name = norm(login);
  if (indexOf(state, name) !== -1 || state.channels[index] === undefined) return state;
  const { [state.channels[index]]: _, ...picked } = state.picked;
  const seq = state.seq + 1;
  const channels = [...state.channels];
  channels[index] = name;
  return normalize({ ...state, seq, channels, picked: { ...picked, [name]: seq } });
}

export function toggleChannel(state, login) {
  const existing = indexOf(state, login);
  if (existing !== -1) return { state: removeAt(state, existing), action: 'removed', index: existing };
  const result = addChannel(state, login);
  if (result.full) return { state, action: 'full' };
  return { state: result.state, action: 'added', index: result.index };
}

export function swap(state, a, b) {
  if (a === b) return state;
  const channels = [...state.channels];
  [channels[a], channels[b]] = [channels[b], channels[a]];
  return { ...state, channels };
}

export function feature(state, index) {
  if (!canFeature(state) || state.channels[index] === undefined) return state;
  const side = state.featured ? state.featuredSide : 'left';
  return { ...state, featured: true, featuredByUser: true, featuredSide: side, channels: moveToFront(state.channels, index) };
}

export function unfeature(state) {
  return count(state) === MAX_STREAMS ? { ...state, featured: false, featuredByUser: false } : state;
}

export function flipFeaturedSide(state) {
  return { ...state, featuredSide: state.featuredSide === 'left' ? 'right' : 'left' };
}

export function resolveDrop(state, from, target) {
  if (target.kind === 'column') return flipFeaturedSide(state);
  return swap(state, from, target.index);
}

// A state saved as JSON (kept while the page reloads in another language),
// checked and completed; null if there is nothing usable.
export function restoreState(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return null;
  }
  const channels = saved?.channels;
  const valid = Array.isArray(channels) && channels.length <= MAX_STREAMS
    && channels.every((c) => typeof c === 'string' && c.trim());
  if (!valid) return null;
  const names = channels.map(norm);
  const known = saved.picked && typeof saved.picked === 'object' ? saved.picked : {};
  const picked = Object.fromEntries(names.map((name, i) => [name, Number(known[name]) || i + 1]));
  return normalize({
    channels: names,
    featured: Boolean(saved.featured),
    featuredByUser: Boolean(saved.featuredByUser),
    featuredSide: saved.featuredSide === 'right' ? 'right' : 'left',
    picked,
    seq: Math.max(Number(saved.seq) || 0, ...Object.values(picked)),
  });
}
