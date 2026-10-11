import type { ExtensionManifest, Kind, KindEntity } from '@stackmap/extension-sdk';

export interface RegisteredKind extends Kind {
  /** Id of the extension that contributes it. */
  extension: string;
}

/** The installed extensions, checked against each other. */
export interface ExtensionRegistry {
  /** Dependencies first, then by id. */
  extensions: readonly ExtensionManifest[];
  get: (id: string) => ExtensionManifest | undefined;
  kinds: (entity: KindEntity) => readonly RegisteredKind[];
  hasKind: (entity: KindEntity, id: string) => boolean;
}

export class ExtensionRegistryError extends Error {
  override name = 'ExtensionRegistryError';

  constructor(readonly problems: readonly string[]) {
    super(`The installed extensions do not fit together:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
}

export function createExtensionRegistry(_manifests: readonly ExtensionManifest[]): ExtensionRegistry {
  throw new Error('Not implemented');
}
