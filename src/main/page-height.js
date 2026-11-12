// Height a Twitch page needs: the bottom of its lowest visible element,
// scrolled content included, plus a margin. 0 while nothing is displayed.
// Injected into the page as is, so it must not use anything from outside.
export function measurePageHeight(doc = document, win = window) {
  let bottom = 0;
  for (const el of doc.body.querySelectorAll('*')) {
    if (el.children.length && !/^(button|input|a|svg|img|label|select|textarea)$/i.test(el.tagName)) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || win.getComputedStyle(el).visibility === 'hidden') continue;
    let scrolled = 0;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) scrolled += parent.scrollTop;
    bottom = Math.max(bottom, rect.bottom + scrolled);
  }
  return bottom ? Math.ceil(bottom) + 16 : 0;
}

export const MEASURE_PAGE_SCRIPT = `(${measurePageHeight.toString()})();`;

// A page that is loading or changing gives passing values: a height is only
// kept once two measures in a row agree, and only when it really changed.
export function createHeightSettler({ minimum = 160, tolerance = 4 } = {}) {
  let previous = null;
  let applied = null;
  return (height) => {
    const steady = previous !== null && Math.abs(height - previous) <= tolerance;
    previous = height;
    if (!steady || height < minimum) return null;
    if (applied !== null && Math.abs(height - applied) <= tolerance) return null;
    applied = height;
    return height;
  };
}
