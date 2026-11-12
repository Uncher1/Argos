// Tolerance to typos in the search: how close a name is to what was typed.

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Edit distance counting insertions, deletions, substitutions and swaps of
// two neighbouring letters (the most common typos).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// 1 = same name, 0 = nothing in common. People often type only the start of
// a name, so the beginning of the candidate counts as much as the whole of it.
export function similarity(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.startsWith(q)) return 0.9 + 0.1 * (q.length / c.length);
  if (c.includes(q)) return 0.85;
  const targets = new Set([c, c.slice(0, q.length - 1), c.slice(0, q.length), c.slice(0, q.length + 1)]);
  let best = 0;
  for (const t of targets) {
    if (!t) continue;
    best = Math.max(best, 1 - distance(q, t) / Math.max(q.length, t.length));
  }
  return best;
}

export function rankByName(query, items, namesOf, threshold = 0.6) {
  return items
    .map((item) => ({ item, score: Math.max(...namesOf(item).map((n) => similarity(query, n))) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

// Shorter searches sent to Twitch when what was typed finds nothing close:
// one of them usually stops before the typo.
export function typoQueries(query) {
  const q = query.trim().toLowerCase();
  const n = q.length;
  const lengths = [n - 1, n - 2, Math.ceil(n / 2), 3].filter((l) => l >= 2 && l < n);
  const queries = lengths.map((l) => q.slice(0, l));
  if (n > 3) queries.push(q.slice(1));
  return [...new Set(queries)];
}
