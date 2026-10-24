import { icons as lucide } from '@iconify-json/lucide';
import { z } from 'zod';

import { KEBAB_CASE, LANGUAGE_TAG, LOCALE_CODE, SEMVER } from './formats';

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

/** An entity type an extension adds, stored in a table of its own. */
export interface EntityDeclaration {
  /** Kebab-case, unique in the extension. */
  id: string;
  /** `<snake_case extension id>_<camelCase name>`: `core_host`, `reverse_proxy_route`. */
  table: string;
  /** i18n key, under extensions.<id>. */
  label: string;
}

/** A hook an extension declares; others call it `<extension id>:<name>`. */
export interface HookDeclaration {
  name: string;
  side: 'server' | 'client';
  description: string;
}

/** A language an extension adds (a locale pack). */
export interface LocaleDeclaration {
  /** As used in URLs and settings: `de`, `pt-BR`. */
  code: string;
  /** BCP 47 language tag: `de-DE`. */
  language: string;
  /** The language's name in that language: "Deutsch". */
  name: string;
}

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
  /** Optional dependencies: extensions this one extends when they are there. */
  enhances?: readonly string[];
  /** Whether the extension runs code; users are warned before installing one that does. */
  code?: { server?: boolean; client?: boolean };
  contributes: {
    kinds: KindContributions;
    entities?: readonly EntityDeclaration[];
    hooks?: readonly HookDeclaration[];
    locales?: readonly LocaleDeclaration[];
  };
}

/** What an extension declares; defineExtension fills in the defaults. */
export type ExtensionManifestInput = Omit<ExtensionManifest, 'alwaysOn' | 'dependsOn' | 'contributes'> & {
  alwaysOn?: boolean;
  dependsOn?: readonly string[];
  contributes?: Partial<ExtensionManifest['contributes']>;
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

/** Prefixes of the app's own hooks (`app:ready`, `route:changed`…): no extension may take them as its id. */
export const RESERVED_EXTENSION_IDS: readonly string[] = ['app', 'route', 'locale', 'extension'];

const LUCIDE_ICON = /^i-lucide-[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An image path inside the extension's own directory: no `..`, no other extension, local formats only. */
const IMAGE_PATH = /^[\w-]+(?:\/[\w-]+)*\.(?:svg|png|webp)$/;

const kebabCase = z.string().regex(KEBAB_CASE, 'must be kebab-case (lowercase letters, digits and single dashes)');

/** Ids are stored and named in tables and constraints: bounded so that every derived name fits Postgres' 63. */
const MAX_ID = 40;
const MAX_LABEL = 200;
const MAX_TABLE = 43;

const kinds = z.array(z.strictObject({
  id: kebabCase.max(MAX_ID),
  label: z.string().max(MAX_LABEL),
  icon: z.string().max(MAX_LABEL).optional(),
})).optional();

const hooks = z.array(z.strictObject({
  name: kebabCase,
  side: z.enum(['server', 'client']),
  description: z.string().trim().min(1, 'must not be empty'),
})).optional();

/** At most this many entity types per extension. */
const MAX_ENTITIES = 50;

const entities = z.array(z.strictObject({
  id: kebabCase.max(MAX_ID),
  // `<table>_workspace_id_unique` and the other derived constraint names must fit in 63 characters.
  table: z.string().max(MAX_TABLE),
  label: z.string().max(MAX_LABEL),
})).max(MAX_ENTITIES);

const locales = z.array(z.strictObject({
  code: z.string().regex(LOCALE_CODE, 'must be a locale code, such as de or pt-BR'),
  language: z.string().regex(LANGUAGE_TAG, 'must be a BCP 47 language tag, such as de-DE'),
  name: z.string().trim().min(1, 'must be the language\'s name, in that language'),
})).optional();

const manifestSchema = z.strictObject({
  id: kebabCase
    .max(40, 'must be at most 40 characters')
    .refine((id) => !RESERVED_EXTENSION_IDS.includes(id), 'is reserved for the app\'s own hooks')
    // Its table prefix would name the migration history tables (`kysely_migration…`).
    .refine((id) => id !== 'kysely' && !id.startsWith('kysely-'), 'is reserved for the migration history tables'),
  version: z.string().regex(SEMVER, 'must be a semantic version, such as 1.2.0'),
  apiVersion: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  alwaysOn: z.boolean().default(false),
  dependsOn: z.array(kebabCase).default([]),
  enhances: z.array(kebabCase).optional(),
  code: z.strictObject({ server: z.boolean().optional(), client: z.boolean().optional() }).optional(),
  contributes: z.strictObject({
    kinds: z.strictObject({ host: kinds, network: kinds, service: kinds, protocol: kinds }).default({}),
    entities: entities.optional(),
    hooks,
    locales,
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
  const tablePrefix = extensionTablePrefix(manifest.id);
  const seenEntities = new Set<string>();
  for (const [index, entity] of (manifest.contributes.entities ?? []).entries()) {
    const path = ['contributes', 'entities', index];
    if (seenEntities.has(entity.id)) {
      context.addIssue({ code: 'custom', path: [...path, 'id'], message: `declares entity "${entity.id}" more than once` });
    }
    seenEntities.add(entity.id);
    // The extension's prefix keeps two extensions' tables apart; the name is camelCase, like every table and column.
    if (!isExtensionTable(manifest.id, entity.table)) {
      context.addIssue({
        code: 'custom',
        path: [...path, 'table'],
        message: `must be ${tablePrefix}_ followed by a camelCase name, such as ${tablePrefix}_peer`,
      });
    }
    checkKey(entity.label, [...path, 'label']);
  }
});

/** Validates an extension manifest when it is defined and returns it with its defaults. */
/** What is wrong with a manifest, one problem per line (`contributes.entities.0.table: …`); empty when it is valid. */
export function manifestProblems(manifest: unknown): string[] {
  const result = manifestSchema.safeParse(manifest);
  return result.success
    ? []
    : result.error.issues.map(({ path, message }) => `${path.length > 0 ? path.join('.') : 'manifest'}: ${message}`);
}

/** Freezes plain data, deeply. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Validates an extension manifest when it is defined and returns it with its defaults, frozen: nothing can change it
 * after the registry checked it.
 */
export function defineExtension(manifest: ExtensionManifestInput): ExtensionManifest {
  const result = manifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new ExtensionManifestError(manifest.id, manifestProblems(manifest));
  }
  // The refinement checked the icons, which the schema can only type as strings.
  return deepFreeze(result.data as ExtensionManifest);
}

/** The prefix of an extension's tables and migration history: its id in snake case, `reverse_proxy`. */
export function extensionTablePrefix(id: string): string {
  return id.replaceAll('-', '_');
}

/** Whether a table belongs to the extension: `<snake_case id>_<camelCaseName>`, so `vpn` never owns `vpn_x_peer`. */
export function isExtensionTable(id: string, table: string): boolean {
  // No pattern built from the id: it may not be validated yet.
  const prefix = `${extensionTablePrefix(id)}_`;
  return table.startsWith(prefix) && /^[a-z][a-zA-Z0-9]*$/.test(table.slice(prefix.length));
}
