let closeCurrent = null;

export function isContextMenuOpen() {
  return closeCurrent !== null;
}

export function closeContextMenu() {
  closeCurrent?.();
}

// Small dark menu at the cursor. Closed by a choice, a click elsewhere or Escape.
export function showContextMenu({ x, y, items }) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = item.danger ? 'ctx-item danger' : 'ctx-item';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.addEventListener('click', () => {
      close();
      item.onSelect();
    });
    menu.append(button);
  }
  document.body.append(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, innerWidth - width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, innerHeight - height - 4))}px`;

  const onPointerDown = (event) => {
    if (!menu.contains(event.target)) close();
  };
  const onKey = (event) => {
    if (event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    close();
  };
  addEventListener('pointerdown', onPointerDown, true);
  addEventListener('keydown', onKey, true);
  addEventListener('blur', close);

  function close() {
    removeEventListener('pointerdown', onPointerDown, true);
    removeEventListener('keydown', onKey, true);
    removeEventListener('blur', close);
    menu.remove();
    closeCurrent = null;
  }
  closeCurrent = close;
  return close;
}
