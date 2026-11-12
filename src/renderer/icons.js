const svg = (body, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export function logoSvg(size = 32) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" rx="3" fill="#b98cff"/>
    <rect x="17" y="1" width="14" height="14" rx="3" fill="#9147ff"/>
    <rect x="1" y="17" width="14" height="14" rx="3" fill="#9147ff"/>
    <rect x="17" y="17" width="14" height="14" rx="3" fill="#6a2fd6"/>
  </svg>`;
}

export const iconPlay = svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>');
export const iconPause = svg('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>');
export const iconVolume = svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>');
export const iconMuted = svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>');
export const iconClose = svg('<path d="M6 6l12 12M18 6L6 18"/>', 16);
export const iconMinimize = svg('<path d="M5 12h14"/>', 16);
export const iconMaximize = svg('<rect x="5" y="5" width="14" height="14" rx="1"/>', 16);
export const iconRestore = svg('<rect x="5" y="8" width="11" height="11" rx="1"/><path d="M8 8V5h11v11h-3"/>', 16);
