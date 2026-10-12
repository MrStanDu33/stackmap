import core from '@stackmap/extension-core';

import type { ExtensionManifest } from '@stackmap/extension-sdk';

/** The extensions shipped in the image: every package of extensions/. */
export const BUILTIN_EXTENSIONS: readonly ExtensionManifest[] = [core];
