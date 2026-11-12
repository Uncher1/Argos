// Twitch logins are 1 to 25 letters, digits or underscores.
const LOGIN = /^[a-z0-9_]{1,25}$/;

export function twitchChannelUrl(login) {
  const name = String(login ?? '').toLowerCase();
  return LOGIN.test(name) ? `https://www.twitch.tv/${name}/about` : null;
}
