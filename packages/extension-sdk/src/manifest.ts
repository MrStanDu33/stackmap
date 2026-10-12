import { icons as lucide } from '@iconify-json/lucide';
import { z } from 'zod';

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

/** Whether the bundled Lucide collection has this icon (`i-lucide-<name>`). */
export const lucideIconExists = (icon: string): boolean => {
  const name = icon.replace(/^i-lucide-/, '');
  return icon.startsWith('i-lucide-') && (name in lucide.icons || name in (lucide.aliases ?? {}));
};

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const LUCIDE_ICON = /^i-lucide-[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An image path inside the extension's own directory: no `..`, no other extension, local formats only. */
const IMAGE_PATH = /^[\w-]+(?:\/[\w-]+)*\.(?:svg|png|webp)$/;

const kebabCase = z.string().regex(KEBAB_CASE, 'must be kebab-case (lowercase letters, digits and single dashes)');

const kinds = z.array(z.strictObject({ id: kebabCase, label: z.string(), icon: z.string().optional() })).optional();

const manifestSchema = z.strictObject({
  id: kebabCase.max(40, 'must be at most 40 characters'),
  version: z.string().regex(SEMVER, 'must be a semantic version, such as 1.2.0'),
  apiVersion: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  alwaysOn: z.boolean().default(false),
  dependsOn: z.array(kebabCase).default([]),
  contributes: z.strictObject({
    kinds: z.strictObject({ host: kinds, network: kinds, service: kinds, protocol: kinds }).default({}),
  }).default({ kinds: {} }),
}).superRefine((manifest, context) => {
  // Checks that depend on the extension's id: its namespace for strings and its directory for images.
  const keyPrefix = `extensions.${manifest.id}.`;
  const checkKey = (key: string, path: PropertyKey[]) => {
    if (!key.startsWith(keyPrefix) || !/^[\w-]+(?:\.[\w-]+)*$/.test(key.slice(keyPrefix.length))) {
      context.addIssue({ code: 'custom', path, message: `must be an i18n key under ${keyPrefix}` });
    }
  };
  const checkIcon = (icon: string | undefined, path: PropertyKey[]) => {
    const imagePrefix = `/extensions/${manifest.id}/`;
    const valid = icon === undefined
      || LUCIDE_ICON.test(icon)
      || (icon.startsWith(imagePrefix) && IMAGE_PATH.test(icon.slice(imagePrefix.length)));
    if (!valid) {
      context.addIssue({
        code: 'custom',
        path,
        message: `must be a Lucide icon (i-lucide-…) or an image in ${imagePrefix} (svg, png or webp)`,
      });
    }
  };

  checkKey(manifest.name, ['name']);
  checkKey(manifest.description, ['description']);
  checkIcon(manifest.icon, ['icon']);
  for (const entity of KIND_ENTITIES) {
    const seen = new Set<string>();
    for (const [index, kind] of (manifest.contributes.kinds[entity] ?? []).entries()) {
      const path = ['contributes', 'kinds', entity, index];
      if (seen.has(kind.id)) {
        context.addIssue({ code: 'custom', path: [...path, 'id'], message: `duplicate ${entity} kind "${kind.id}"` });
      }
      seen.add(kind.id);
      checkKey(kind.label, [...path, 'label']);
      checkIcon(kind.icon, [...path, 'icon']);
    }
  }
});

/** Validates an extension manifest when it is defined and returns it with its defaults. */
export function defineExtension(manifest: ExtensionManifestInput): ExtensionManifest {
  const result = manifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new ExtensionManifestError(manifest.id, result.error.issues.map(({ path, message }) =>
      `${path.length > 0 ? path.join('.') : 'manifest'}: ${message}`));
  }
  // The refinement checked the icons, which the schema can only type as strings.
  return result.data as ExtensionManifest;
}
