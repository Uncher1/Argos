// Google refuses sign-in from embedded apps; present a plain Chrome user agent.
export function chromeUserAgent(ua) {
  return ua.replace(/\s(?:Electron|argos)\/\S+/gi, '');
}
