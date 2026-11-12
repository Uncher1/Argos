// The embedded Twitch players live in a third-party iframe: they only see the
// Twitch session if its cookies are SameSite=None.

const isTwitch = (domain) => {
  const host = String(domain ?? '').replace(/^\./, '');
  return host === 'twitch.tv' || host.endsWith('.twitch.tv');
};

export function needsSameSiteFix(cookie) {
  return isTwitch(cookie.domain) && cookie.sameSite !== 'no_restriction';
}

export function toSetDetails(cookie) {
  const host = cookie.domain.replace(/^\./, '');
  const details = {
    url: `https://${host}${cookie.path}`,
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: true,
    httpOnly: cookie.httpOnly,
    sameSite: 'no_restriction',
  };
  if (!cookie.hostOnly) details.domain = cookie.domain;
  if (cookie.expirationDate !== undefined) details.expirationDate = cookie.expirationDate;
  return details;
}

export function shareTwitchCookies(ses) {
  const fix = (cookie) => {
    if (needsSameSiteFix(cookie)) ses.cookies.set(toSetDetails(cookie)).catch(() => {});
  };
  ses.cookies.get({}).then((all) => all.forEach(fix)).catch(() => {});
  ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (!removed) fix(cookie);
  });
}
