/** Whether a key press opens the command palette: Cmd+K on macOS, Ctrl+K elsewhere, and no other dialog open. */
export function isPaletteShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  { mac, dialogOpen = false }: { mac: boolean; dialogOpen?: boolean },
): boolean {
  const modifier = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return !dialogOpen && modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
}

/** The shortcut as the platform writes it. */
export function paletteShortcutLabel(mac: boolean): string {
  return mac ? '⌘K' : 'Ctrl+K';
}

/** Whether the browser runs on macOS (or iOS), where the shortcut uses Cmd. */
export function isMac(): boolean {
  // navigator.platform is deprecated, but the one signal every browser still gives; no browser: not a Mac.
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
