/** Version of the extension API; a manifest declares the one it targets. */
export const EXTENSION_API_VERSION = 1;

/** Core entities whose kinds (host kinds, network kinds…) extensions can add to. */
export const KIND_ENTITIES = ['host', 'network', 'service', 'protocol'] as const;
export type KindEntity = (typeof KIND_ENTITIES)[number];

/** A Lucide icon name, or an image the extension ships in its public/extensions/<id>/ directory. Never a remote URL. */
export type ExtensionIcon = `i-lucide-${string}` | `/extensions/${string}`;

export interface Kind {
  /** Stored in the database: kebab-case, unique per entity across all extensions. */
  id: string;
  /** i18n key, under extensions.<id>. */
  label: string;
  icon?: ExtensionIcon;
}

export type KindContributions = Partial<Record<KindEntity, readonly Kind[]>>;

export interface ExtensionManifest {
  id: string;
  version: string;
  apiVersion: number;
  name: string;
  description: string;
  icon?: ExtensionIcon;
  /** Cannot be turned off (the core). */
  alwaysOn: boolean;
  dependsOn: readonly string[];
  contributes: { kinds: KindContributions };
}

/** What an extension declares; defineExtension fills in the defaults. */
export type ExtensionManifestInput = Omit<ExtensionManifest, 'alwaysOn' | 'dependsOn' | 'contributes'> & {
  alwaysOn?: boolean;
  dependsOn?: readonly string[];
  contributes?: { kinds?: KindContributions };
};

export class ExtensionManifestError extends Error {
  override name = 'ExtensionManifestError';

  constructor(readonly extensionId: string, readonly problems: readonly string[]) {
    super(`Extension "${extensionId}" has an invalid manifest:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
}

/** Validates an extension manifest when it is defined and returns it with its defaults. */
export function defineExtension(_manifest: ExtensionManifestInput): ExtensionManifest {
  throw new Error('Not implemented');
}
