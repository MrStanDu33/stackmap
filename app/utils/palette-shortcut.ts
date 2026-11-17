/** Whether a key press opens the command palette: Cmd+K on macOS, Ctrl+K elsewhere, and no other dialog open. */
export function isPaletteShortcut(
  _event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  _context: { mac: boolean; dialogOpen?: boolean },
): boolean {
  throw new Error('Not implemented');
}

/** The shortcut as the platform writes it. */
export function paletteShortcutLabel(_mac: boolean): string {
  throw new Error('Not implemented');
}

/** Whether the browser runs on macOS (or iOS), where the shortcut uses Cmd. */
export function isMac(): boolean {
  throw new Error('Not implemented');
}
