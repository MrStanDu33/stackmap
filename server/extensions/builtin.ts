import core from '@stackmap/extension-core';
import coreServer from '@stackmap/extension-core/server';
import nat from '@stackmap/extension-nat';
import natServer from '@stackmap/extension-nat/server';
import reverseProxy from '@stackmap/extension-reverse-proxy';
import reverseProxyServer from '@stackmap/extension-reverse-proxy/server';

import type { ExtensionManifest, ExtensionServer } from '@stackmap/extension-sdk';

/** The extensions shipped in the image: every package of extensions/. */
export const BUILTIN_EXTENSIONS: readonly ExtensionManifest[] = [core, reverseProxy, nat];

/** The server code of the built-in extensions that ship some (`extensions/<id>/server.ts`). */
export const BUILTIN_EXTENSION_SERVERS: readonly ExtensionServer[] = [coreServer, reverseProxyServer, natServer];
