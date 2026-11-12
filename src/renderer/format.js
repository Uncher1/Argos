// Short viewer counts in the local format: 12.4K, 12,4 k, 1.2万...
export function formatViewers(n, tag = 'en') {
  return new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function thumbnailUrl(template, w, h) {
  return template.replace('{width}', String(w)).replace('{height}', String(h));
}
