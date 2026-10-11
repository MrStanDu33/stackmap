import type { ExtensionManifest } from './manifest';

export interface Messages { [key: string]: string | Messages }

export interface ExtensionFiles {
  /** The extension's locale files, by locale code. */
  messages: Readonly<Record<string, Messages>>;
  /** Files of the extension's public/ directory, relative to it (`extensions/<id>/icon.svg`). */
  publicFiles: readonly string[];
}

/** Checks what a manifest refers to: its strings in English and French, and its icons. Returns the problems found. */
export function checkExtension(_manifest: ExtensionManifest, _files: ExtensionFiles): string[] {
  throw new Error('Not implemented');
}
