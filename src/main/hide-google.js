// Google refuses to sign in inside an app, so its button on Twitch's login
// page can only fail: it is hidden, now and whenever the page changes.
// Injected into the page as is, so it must not use anything from outside.
export function hideGoogleButtons(doc = document, Observer = MutationObserver) {
  const hide = () => {
    for (const button of doc.querySelectorAll('button')) {
      if (/google/i.test(button.textContent) && button.style.display !== 'none') button.style.display = 'none';
    }
  };
  hide();
  new Observer(hide).observe(doc.documentElement, { childList: true, subtree: true });
}

export const HIDE_GOOGLE_SCRIPT = `(${hideGoogleButtons.toString()})();`;
