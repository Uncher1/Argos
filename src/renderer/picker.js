import { formatViewers, thumbnailUrl } from './format.js';
import { getLanguage, t } from './i18n/index.js';
import { LANGUAGES, localeTag, streamLanguage } from './i18n/languages.js';
import { offlineFollows } from './follows.js';
import { iconClose } from './icons.js';
import { createSearch, rankSections } from './search.js';
import { MAX_STREAMS, count, indexOf, isFull } from './state.js';

const SEARCH_DELAY = 250;
const OTHERS_SHOWN = 8;

const searchIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';

const markup = `
  <div class="picker" role="dialog">
    <button class="corner-x picker-x" type="button">${iconClose}</button>
    <div class="picker-search">
      ${searchIcon}
      <input type="text" spellcheck="false">
      <div class="search-dropdown" hidden></div>
    </div>
    <div class="picker-head"></div>
    <div class="picker-body">
      <div class="picker-content"></div>
      <p class="picker-message" hidden></p>
    </div>
    <div class="picker-foot">
      <span class="count-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="picker-count"></span>
    </div>
    <div class="replace-backdrop" hidden>
      <div class="replace-dialog" role="dialog">
        <button class="corner-x replace-x" type="button">${iconClose}</button>
        <b class="replace-title"></b>
        <div class="replace-grid"></div>
      </div>
    </div>
  </div>`;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const img = (className, src) => {
  const node = el('img', className);
  node.alt = '';
  node.loading = 'lazy';
  node.src = src;
  return node;
};

// Twitch caches live previews; a per-minute suffix keeps them fresh.
const fresh = (url) => (url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}`);

export function createPicker({ api, getUserId, getState, onToggle, onReplace, onOpenTwitchPage }) {
  const root = el('div', 'picker-backdrop');
  root.innerHTML = markup;
  root.hidden = true;
  document.getElementById('ui').append(root);

  const $ = (sel) => root.querySelector(sel);
  const input = $('.picker-search input');
  const dropdown = $('.search-dropdown');
  const head = $('.picker-head');
  const content = $('.picker-content');
  const message = $('.picker-message');
  const countText = $('.picker-count');
  const bars = [...root.querySelectorAll('.count-bars i')];
  const replaceBackdrop = $('.replace-backdrop');
  const replaceGrid = $('.replace-grid');
  $('.picker').setAttribute('aria-label', t('picker.label'));
  $('.picker-x').setAttribute('aria-label', t('common.close'));
  $('.replace-x').setAttribute('aria-label', t('common.close'));
  $('.replace-dialog').setAttribute('aria-label', t('picker.replaceTitle'));
  $('.replace-title').textContent = t('picker.replaceTitle');
  input.placeholder = t('picker.searchPlaceholder');
  input.setAttribute('aria-label', t('picker.searchLabel'));

  let follows = [];
  let cards = [];
  let followButtons = [];
  let followed = null;
  let followedSet = new Set();
  let viewKind = 'follows';
  let searchTimer = null;
  let searchSeq = 0;
  let loadSeq = 0;
  const countListeners = new Set();
  // Display names seen in Twitch answers, so the app never shows a bare login.
  const names = new Map();
  // Profile pictures of followed channels, fetched once.
  const avatars = new Map();
  const remember = (login, name) => {
    if (login && name) names.set(login.toLowerCase(), name);
  };
  const nameOf = (login) => names.get(login) ?? login;

  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };

  // Every followed channel (live or not), used for the follow buttons and to
  // recognise a followed name typed with a mistake.
  async function loadFollowed(force = false) {
    if (followed && !force) return followed;
    try {
      followed = await api.getFollowedChannels(getUserId());
    } catch {
      followed = followed ?? [];
    }
    followedSet = new Set(followed.map((f) => f.login));
    followed.forEach((f) => remember(f.login, f.name));
    return followed;
  }

  const search = createSearch({
    api,
    getFollowed: () => loadFollowed(),
    getLiveLogins: () => new Set(follows.map((s) => s.login)),
  });

  // After a visit to a Twitch page, the follow buttons, the list of follows
  // and the counter are brought up to date; Twitch can take a few seconds to
  // count a new follow, hence a second check.
  async function syncAfterFollowChange() {
    await refreshFollows().catch(() => {});
    refreshFollowButtons();
  }

  function refreshFollowButtons() {
    followButtons = followButtons.filter((b) => b.isConnected);
    for (const button of followButtons) {
      const on = followedSet.has(button.dataset.login);
      button.classList.toggle('on', on);
      button.textContent = on ? t('picker.following') : t('picker.follow');
      button.title = on ? t('picker.unfollowTitle') : t('picker.followTitle');
    }
  }

  function followButton(login, name) {
    const button = el('button', 'follow-btn');
    button.type = 'button';
    button.dataset.login = login.toLowerCase();
    button.addEventListener('pointerdown', (e) => e.preventDefault());
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      hideDropdown();
      await onOpenTwitchPage(login, name);
      await syncAfterFollowChange();
      setTimeout(syncAfterFollowChange, 5000);
    });
    followButtons.push(button);
    return button;
  }

  function card(stream, subtitle, withFollow = false) {
    const item = el('div', 'pick-item');
    const button = el('button', 'pick-card');
    button.type = 'button';
    button.dataset.login = stream.login.toLowerCase();
    const thumb = el('div', 'pick-thumb');
    thumb.append(
      img(null, fresh(thumbnailUrl(stream.thumbnail, 440, 248))),
      el('span', 'badge-live', 'LIVE'),
      el('span', 'badge-viewers', formatViewers(stream.viewers, localeTag(getLanguage()))),
      el('span', 'badge-slot'),
    );
    button.append(thumb, el('span', 'pick-name', stream.name), el('span', 'pick-sub', subtitle));
    button.addEventListener('click', () => pick(stream.login));
    item.append(button);
    if (withFollow) item.append(followButton(stream.login, stream.name));
    cards.push(button);
    return item;
  }

  // A channel on one line (avatar, name), for offline channels.
  function channelRow(channel, { status = true, follow = true } = {}) {
    remember(channel.login, channel.name);
    const row = el('div', `result-channel${channel.isLive ? '' : ' offline'}`);
    const main = el('button', 'result-channel-main');
    main.type = 'button';
    main.dataset.login = channel.login.toLowerCase();
    main.append(img(null, channel.avatar), el('span', 'result-name', channel.name));
    if (status) main.append(el('span', 'search-off', channel.isLive ? `● ${t('picker.live')}` : t('picker.offlineStatus')));
    main.append(el('span', 'badge-slot'));
    main.addEventListener('click', () => pick(channel.login));
    row.append(main);
    if (follow) row.append(followButton(channel.login, channel.name));
    cards.push(main);
    return row;
  }

  function grid(streams, subtitleOf, withFollow = false) {
    streams.forEach((s) => remember(s.login, s.name));
    const g = el('div', 'picker-grid');
    g.append(...streams.map((s) => card(s, subtitleOf(s), withFollow)));
    return g;
  }

  function startView() {
    cards = [];
    followButtons = [];
    content.replaceChildren();
    return ++loadSeq;
  }

  const backButton = () => {
    const back = el('button', 'picker-back', t('picker.back'));
    back.type = 'button';
    back.addEventListener('click', showFollows);
    return back;
  };

  async function loadAvatars(channels) {
    const missing = channels.filter((c) => !avatars.has(c.login)).map((c) => c.login);
    if (!missing.length) return;
    const users = await api.getUsers(missing).catch(() => []);
    missing.forEach((login) => avatars.set(login, ''));
    users.forEach((u) => avatars.set(u.login, u.avatar));
  }

  const offlineNow = () => offlineFollows(followed ?? [], new Set(follows.map((s) => s.login)));

  // Live follows, and every other followed channel (with its picture).
  async function fetchFollows() {
    const [list] = await Promise.all([api.getFollowedStreams(getUserId()), loadFollowed(true)]);
    list.forEach((s) => remember(s.login, s.name));
    follows = list;
    countListeners.forEach((cb) => cb(list.length));
    await loadAvatars(offlineNow());
    return list.length;
  }

  function renderFollows() {
    startView();
    const offline = offlineNow();
    head.replaceChildren(el('span', 'picker-title', t('picker.followsTitleCount', { count: follows.length })));
    const sections = [];
    if (follows.length) sections.push(grid(follows, (s) => s.game));
    else if (offline.length) sections.push(el('p', 'follows-empty', t('picker.noLiveFollows')));
    if (offline.length) {
      const list = el('div', 'result-channels follows-offline-list');
      list.append(...offline.map((c) => channelRow({ ...c, isLive: false, avatar: avatars.get(c.login) ?? '' }, { status: false, follow: false })));
      sections.push(el('h4', 'result-title follows-offline', t('picker.offline', { count: offline.length })), list);
    }
    showMessage(sections.length ? '' : t('picker.noLiveFollows'));
    content.replaceChildren(...sections);
    update();
  }

  // Background refresh (every 2 minutes, after a follow): the list on screen
  // is redrawn only if it changed.
  const followsKey = () => `${follows.map((s) => s.login).join(',')}|${(followed ?? []).map((f) => f.login).join(',')}`;

  async function refreshFollows() {
    const before = followsKey();
    const n = await fetchFollows();
    const changed = followsKey() !== before;
    if (changed && !root.hidden && viewKind === 'follows') renderFollows();
    return n;
  }

  async function showFollows() {
    viewKind = 'follows';
    const seq = startView();
    head.replaceChildren(el('span', 'picker-title', t('picker.followsTitle')));
    showMessage(t('common.loading'));
    try {
      await fetchFollows();
    } catch {
      if (seq === loadSeq) showMessage(t('common.twitchError'));
      return;
    }
    if (seq !== loadSeq) return;
    renderFollows();
  }

  async function showCategory(category, language = streamLanguage(getLanguage())) {
    viewKind = 'category';
    const seq = startView();
    const titles = el('span', 'picker-game');
    const sub = el('small', null, t('common.loading'));
    titles.append(el('b', null, category.name), sub);
    const select = el('select', 'picker-lang');
    select.setAttribute('aria-label', t('picker.languageLabel'));
    const choices = [
      ...LANGUAGES.map((l) => ({ value: streamLanguage(l.code), label: t('picker.languageOption', { name: l.name }) })),
      { value: '', label: t('picker.allLanguages') },
    ];
    for (const choice of choices) {
      const option = el('option', null, choice.label);
      option.value = choice.value;
      select.append(option);
    }
    select.value = language ?? '';
    select.addEventListener('change', () => showCategory(category, select.value || null));
    head.replaceChildren(backButton(), img('picker-box', thumbnailUrl(category.boxArt, 52, 72)), titles, select);
    showMessage(t('common.loading'));
    try {
      const { streams, capped } = await api.getStreamsByGame(category.id, language);
      if (seq !== loadSeq) return;
      sub.textContent = t('picker.liveCount', { count: streams.length, plus: capped ? '+' : '' });
      showMessage(streams.length ? '' : t('picker.noStreamsInLanguage'));
      content.replaceChildren(grid(streams, (s) => s.title));
      update();
    } catch {
      if (seq === loadSeq) showMessage(t('common.twitchError'));
    }
  }

  // Full results page, like Twitch's: games, live channels, other channels.
  async function showResults(query) {
    hideDropdown();
    viewKind = 'results';
    const seq = startView();
    const title = el('span', 'picker-title');
    title.textContent = t('picker.resultsFor', { query });
    head.replaceChildren(backButton(), title);
    showMessage(t('common.loading'));
    let channels;
    let categories;
    let approximate;
    let live;
    try {
      ({ channels, categories, approximate } = await search.run(query, { channels: 100, categories: 50 }));
      live = await api.getStreamsByLogins(channels.filter((c) => c.isLive).map((c) => c.login));
    } catch {
      if (seq === loadSeq) showMessage(t('common.twitchError'));
      return;
    }
    if (seq !== loadSeq) return;
    if (approximate) title.textContent = t('picker.approximateResults', { query });
    channels.forEach((c) => remember(c.login, c.name));
    const groups = [];
    if (categories.length) {
      const row = el('div', 'result-games');
      for (const cat of categories) {
        const tile = el('button', 'result-game');
        tile.type = 'button';
        tile.append(img(null, thumbnailUrl(cat.boxArt, 104, 144)), el('span', null, cat.name));
        tile.addEventListener('click', () => showCategory(cat));
        row.append(tile);
      }
      groups.push({ key: 'games', names: categories.map((c) => c.name), nodes: [el('h4', 'result-title', t('picker.games')), row] });
    }
    if (live.length) {
      groups.push({
        key: 'live',
        names: live.flatMap((s) => [s.login, s.name]),
        nodes: [el('h4', 'result-title', t('picker.liveChannels')), grid(live, (s) => s.game, true)],
      });
    }
    const others = channels.filter((c) => !live.some((s) => s.login === c.login));
    if (others.length) {
      // The best few, the rest on demand: the other sections stay in sight.
      const list = el('div', 'result-channels');
      list.append(...others.slice(0, OTHERS_SHOWN).map((c) => channelRow(c)));
      const nodes = [el('h4', 'result-title', t('picker.channels')), list];
      const rest = others.slice(OTHERS_SHOWN);
      if (rest.length) {
        const more = el('button', 'result-more', t('picker.showMore', { count: rest.length }));
        more.type = 'button';
        more.addEventListener('click', () => {
          list.append(...rest.map((c) => channelRow(c)));
          more.remove();
          refreshFollowButtons();
          update();
        });
        nodes.push(more);
      }
      groups.push({ key: 'channels', names: others.flatMap((c) => [c.login, c.name]), nodes });
    }
    // The section holding the name typed comes first.
    const order = rankSections(query, groups);
    const sections = order.flatMap((key) => groups.find((g) => g.key === key).nodes);
    showMessage(sections.length ? '' : t('picker.noResults'));
    content.replaceChildren(...sections);
    refreshFollowButtons();
    update();
  }

  // Badges, counter bars and text follow the streams on screen.
  function update() {
    const state = getState();
    for (const c of cards) {
      const index = indexOf(state, c.dataset.login);
      c.classList.toggle('picked', index !== -1);
      c.querySelector('.badge-slot').textContent = index === -1 ? '' : t('picker.slot', { n: index + 1 });
    }
    bars.forEach((bar, i) => bar.classList.toggle('filled', i < count(state)));
    countText.textContent = `${count(state)} / ${MAX_STREAMS}`;
  }

  function pick(login) {
    hideDropdown();
    const state = getState();
    const present = indexOf(state, login) !== -1;
    if (!present && isFull(state)) {
      openReplace(login);
      return;
    }
    onToggle(login);
    update();
    if (!present && isFull(getState())) close();
  }

  function openReplace(login) {
    const state = getState();
    replaceGrid.replaceChildren(...state.channels.map((current, index) => {
      const button = el('button', 'replace-cell');
      button.type = 'button';
      button.append(el('span', 'replace-case', t('picker.slot', { n: index + 1 })), el('span', 'replace-name', nameOf(current)));
      button.addEventListener('click', () => {
        replaceBackdrop.hidden = true;
        onReplace(index, login);
        close();
      });
      return button;
    }));
    replaceBackdrop.hidden = false;
  }

  const closeReplace = () => {
    replaceBackdrop.hidden = true;
  };

  // Search: channels (live ones also match on their game) and games, like on Twitch.
  function hideDropdown() {
    dropdown.hidden = true;
  }

  function dropdownItem(className, imgSrc, label, extras, onPick) {
    const row = el('div', `search-row ${className}`);
    const item = el('button', 'search-item');
    item.type = 'button';
    item.append(img(null, imgSrc), el('span', 'search-label', label), ...extras.filter(Boolean));
    item.addEventListener('pointerdown', (e) => e.preventDefault());
    item.addEventListener('click', onPick);
    row.append(item);
    return row;
  }

  async function runSearch(query) {
    const seq = ++searchSeq;
    let channels;
    let categories;
    let approximate;
    try {
      ({ channels, categories, approximate } = await search.run(query));
    } catch {
      if (seq !== searchSeq) return;
      dropdown.replaceChildren(el('p', 'search-empty', t('common.twitchError')));
      dropdown.hidden = false;
      return;
    }
    if (seq !== searchSeq || input.value.trim() !== query) return;
    followButtons = followButtons.filter((b) => !dropdown.contains(b));
    const parts = [];
    if (approximate && (channels.length || categories.length)) {
      parts.push(el('p', 'search-hint', t('picker.didYouMean', { query })));
    }
    if (channels.length) {
      parts.push(el('span', 'search-section', t('picker.channels')));
      for (const c of channels.slice(0, 8)) {
        remember(c.login, c.name);
        const status = el('span', c.isLive ? 'search-live' : 'search-off', c.isLive ? `● ${c.game || t('picker.live')}` : t('picker.offlineStatus'));
        const row = dropdownItem(c.isLive ? 'channel' : 'channel offline', c.avatar, c.name, [status], () => {
          input.value = '';
          pick(c.login);
        });
        row.append(followButton(c.login, c.name));
        parts.push(row);
      }
    }
    if (categories.length) {
      parts.push(el('span', 'search-section', t('picker.games')));
      for (const cat of categories) {
        parts.push(dropdownItem('category', thumbnailUrl(cat.boxArt, 52, 72), cat.name, [], () => {
          input.value = '';
          hideDropdown();
          showCategory(cat);
        }));
      }
    }
    if (!parts.length) parts.push(el('p', 'search-empty', t('picker.noResultsEvenClose')));
    const all = el('button', 'search-all', t('picker.seeAll', { query }));
    all.type = 'button';
    all.addEventListener('pointerdown', (e) => e.preventDefault());
    all.addEventListener('click', () => showResults(query));
    parts.push(all);
    dropdown.replaceChildren(...parts);
    refreshFollowButtons();
    dropdown.hidden = false;
  }

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const query = input.value.trim();
    if (!query) {
      searchSeq += 1;
      hideDropdown();
      return;
    }
    searchTimer = setTimeout(() => runSearch(query), SEARCH_DELAY);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    clearTimeout(searchTimer);
    searchSeq += 1;
    showResults(input.value.trim());
  });
  input.addEventListener('blur', () => setTimeout(hideDropdown, 120));
  input.addEventListener('focus', () => {
    if (input.value.trim() && dropdown.childElementCount) dropdown.hidden = false;
  });

  $('.picker-x').addEventListener('click', () => close());
  $('.replace-x').addEventListener('click', closeReplace);
  replaceBackdrop.addEventListener('click', (e) => {
    if (e.target === replaceBackdrop) closeReplace();
  });
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });

  function open() {
    input.value = '';
    hideDropdown();
    closeReplace();
    root.hidden = false;
    update();
    showFollows();
  }

  function close() {
    root.hidden = true;
    hideDropdown();
    closeReplace();
    loadSeq += 1;
  }

  return {
    open,
    close,
    update,
    nameOf,
    isOpen: () => !root.hidden,
    isReplaceOpen: () => !root.hidden && !replaceBackdrop.hidden,
    closeReplace,
    refreshFollows,
    onCountChange(cb) {
      countListeners.add(cb);
      return () => countListeners.delete(cb);
    },
    destroy() {
      root.remove();
    },
  };
}

