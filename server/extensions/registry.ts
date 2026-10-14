import { EXTENSION_API_VERSION, extensionTablePrefix, KIND_ENTITIES, manifestProblems } from '@stackmap/extension-sdk';

import type { ExtensionManifest, ExtensionServer, Kind, KindEntity, LocaleDeclaration } from '@stackmap/extension-sdk';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';

export interface RegisteredKind extends Kind {
  /** Id of the extension that contributes it. */
  extension: string;
}

export interface RegisteredLocale extends LocaleDeclaration {
  extension: string;
}

export type ExtensionState = 'active' | 'failed';

/** A repository definition, with the table prefixes its extension may refer to: its own and its dependencies'. */
export type RegisteredRepository = EntityRepositoryDefinition & { tablePrefixes: readonly string[] };

export interface RegisteredExtension {
  manifest: ExtensionManifest;
  state: ExtensionState;
  /** Why it failed, for logs and diagnostics. */
  errors: readonly string[];
  server?: ExtensionServer;
}

/** The installed extensions, checked against each other. */
export interface ExtensionRegistry {
  /** Every installed extension, dependencies first, then by id; failed ones included. */
  extensions: readonly RegisteredExtension[];
  /** The active extensions' manifests, in registry order. */
  active: readonly ExtensionManifest[];
  get: (id: string) => RegisteredExtension | undefined;
  /** Kinds of the active extensions. */
  kinds: (entity: KindEntity) => readonly RegisteredKind[];
  hasKind: (entity: KindEntity, id: string) => boolean;
  /** Languages the active extensions add. */
  locales: () => readonly RegisteredLocale[];
  /** Marks an extension failed at runtime (its setup threw), with its dependents. Throws for an always-on one. */
  fail: (id: string, error: string) => void;
  /** The repository definitions of the active extensions, in registry order. */
  repositories: () => readonly RegisteredRepository[];
}

export interface ExtensionRegistryOptions {
  /** Server code of the extensions that ship some. */
  servers?: readonly ExtensionServer[];
  /** The app's own languages, which locale packs must declare the same way. */
  appLocales?: readonly LocaleDeclaration[];
}

/** Thrown when an always-on extension (the core) fails: the app cannot run without it. */
export class ExtensionRegistryError extends Error {
  override name = 'ExtensionRegistryError';

  constructor(readonly problems: readonly string[]) {
    super(`The installed extensions do not fit together:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
}

interface Entry {
  manifest: ExtensionManifest;
  errors: string[];
  server?: ExtensionServer;
}

const byId = (a: ExtensionManifest, b: ExtensionManifest) => a.id.localeCompare(b.id);

const isFailed = (entry: Entry) => entry.errors.length > 0;

/** Errors of an extension on its own: its API version, its dependencies and the code it ships. */
function ownErrors(entry: Entry, installed: ReadonlyMap<string, Entry>): string[] {
  const { manifest, server } = entry;
  const errors = manifest.apiVersion === EXTENSION_API_VERSION
    ? []
    : [`targets extension API ${String(manifest.apiVersion)}; this Stackmap supports ${String(EXTENSION_API_VERSION)}`];
  for (const dependencyId of manifest.dependsOn) {
    const dependency = installed.get(dependencyId);
    if (!dependency) {
      errors.push(`depends on "${dependencyId}", which is not installed`);
    } else if (manifest.alwaysOn && !dependency.manifest.alwaysOn) {
      errors.push(`is always on but depends on "${dependencyId}", which can be turned off`);
    }
  }
  if (manifest.code?.server && !server) {
    errors.push('declares code.server but ships no server code');
  }
  if (server && !manifest.code?.server) {
    errors.push('ships server code but does not declare code.server');
  }
  // Manifests that did not go through defineExtension (custom ones, later) get the same checks.
  return [...manifestProblems(manifest), ...errors, ...entityErrors(entry)];
}

const REPOSITORY_KEY = /^[a-z][a-zA-Z0-9]{0,39}$/;
/** Set by the repository for every entity; a definition may not store, filter or own them. */
const SET_BY_THE_REPOSITORY = ['id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt'];

/** An extension may use its own tables and those of the extensions it depends on. */
const tablePrefixesOf = (manifest: ExtensionManifest) =>
  [manifest.id, ...manifest.dependsOn].map((id) => `${extensionTablePrefix(id)}_`);

/** The manifest declares the entities and their tables; the server code defines one repository for each. */
function entityErrors({ manifest, server }: Entry): string[] {
  const errors: string[] = [];
  const prefixes = tablePrefixesOf(manifest);
  for (const { key, columns, filters = [], ownedFields = [], dependents = [] } of server?.repositories ?? []) {
    if (!REPOSITORY_KEY.test(key) || key === 'transaction') {
      errors.push(`defines repository "${key}", whose key must be camelCase, at most 40 characters, and not transaction`);
      continue;
    }
    const fields = [...columns, ...filters, ...ownedFields];
    for (const field of fields.filter((name) => SET_BY_THE_REPOSITORY.includes(name))) {
      errors.push(`repository "${key}" cannot store, filter or own ${field}: the repository sets it`);
    }
    const outside = dependents.filter((dependent) => !prefixes.some((prefix) => dependent.table.startsWith(prefix)));
    for (const { table } of outside) {
      errors.push(`repository "${key}" counts dependents in "${table}", which is neither its table nor a dependency's`);
    }
  }
  const declared = new Map((manifest.contributes.entities ?? []).map(({ id, table }) => [id, table]));
  const defined = server?.repositories ?? [];
  for (const { entity, table } of defined) {
    const declaredTable = declared.get(entity);
    if (declaredTable === undefined) {
      errors.push(`defines a repository for entity "${entity}", which its manifest does not declare`);
    } else if (table !== declaredTable) {
      errors.push(`stores entity "${entity}" in table "${table}", but its manifest declares "${declaredTable}"`);
    }
  }
  for (const id of declared.keys()) {
    if (!defined.some(({ entity }) => entity === id)) {
      errors.push(`declares entity "${id}" but defines no repository for it`);
    }
  }
  return errors;
}

/**
 * Orders extensions so that dependencies come first, picking the smallest id whenever several are ready. Returns the
 * extensions that could not be ordered, and the cycles they are in.
 */
function sortByDependencies(installed: ReadonlyMap<string, Entry>) {
  const sorted: Entry[] = [];
  const remaining = new Map(installed);
  const nextReady = () => [...remaining.values()]
    .filter(({ manifest }) => manifest.dependsOn.every((dependency) => !remaining.has(dependency)))
    .sort((a, b) => byId(a.manifest, b.manifest))[0];
  for (let ready = nextReady(); ready; ready = nextReady()) {
    sorted.push(ready);
    remaining.delete(ready.manifest.id);
  }

  const cycles = new Map<string, string>();
  for (const start of [...remaining.values()].sort((a, b) => byId(a.manifest, b.manifest))) {
    // Follow dependencies that are still waiting until one comes back: that loop is a cycle.
    const path: string[] = [];
    let current: Entry | undefined = start;
    while (current && !path.includes(current.manifest.id) && !cycles.has(current.manifest.id)) {
      path.push(current.manifest.id);
      current = [...current.manifest.dependsOn].sort().map((id) => remaining.get(id)).find(Boolean);
    }
    if (current && path.includes(current.manifest.id)) {
      const cycle = [...path.slice(path.indexOf(current.manifest.id)), current.manifest.id];
      for (const id of cycle) {
        cycles.set(id, cycle.join(' → '));
      }
    }
  }
  const unordered = [...remaining.values()].sort((a, b) => byId(a.manifest, b.manifest));
  return { sorted, unordered, cycles };
}

/**
 * Kinds, locales, tables and repository keys are shared: the later extension in registry order fails when it clashes
 * with an earlier one.
 */
function contributionErrors(ordered: readonly Entry[], appLocales: readonly LocaleDeclaration[]) {
  const describe = ({ name, language }: LocaleDeclaration) => `${name} (${language})`;
  const locales = new Map(appLocales.map((locale) => [locale.code, { locale, by: 'the app' }]));
  const kinds = new Map(KIND_ENTITIES.map((entity) => [entity, new Map<string, string>()]));
  const tables = new Map<string, string>();
  const repositoryKeys = new Map<string, string>();
  for (const entry of ordered.filter((candidate) => !isFailed(candidate))) {
    const errors: string[] = [];
    for (const { table } of entry.manifest.contributes.entities ?? []) {
      const owner = tables.get(table);
      if (owner === undefined) {
        tables.set(table, entry.manifest.id);
      } else {
        errors.push(`declares table "${table}", which "${owner}" already declares`);
      }
    }
    for (const { key } of entry.server?.repositories ?? []) {
      const owner = repositoryKeys.get(key);
      if (owner === undefined) {
        repositoryKeys.set(key, entry.manifest.id);
      } else {
        errors.push(`defines repository "${key}", which "${owner}" already defines`);
      }
    }
    for (const entity of KIND_ENTITIES) {
      const owners = kinds.get(entity) ?? new Map<string, string>();
      for (const { id } of entry.manifest.contributes.kinds[entity] ?? []) {
        const owner = owners.get(id);
        if (owner === undefined) {
          owners.set(id, entry.manifest.id);
        } else {
          errors.push(`adds ${entity} kind "${id}", which "${owner}" already adds`);
        }
      }
    }
    for (const locale of entry.manifest.contributes.locales ?? []) {
      const declared = locales.get(locale.code);
      if (!declared) {
        locales.set(locale.code, { locale, by: `"${entry.manifest.id}"` });
      } else if (declared.locale.name !== locale.name || declared.locale.language !== locale.language) {
        errors.push(`declares locale "${locale.code}" as ${describe(locale)}, `
          + `which ${declared.by} declares as ${describe(declared.locale)}`);
      }
    }
    entry.errors.push(...errors);
  }
}

/** Marks failed every extension that depends on a failed one; the order has dependencies first. */
function failDependents(ordered: readonly Entry[], installed: ReadonlyMap<string, Entry>) {
  for (const entry of ordered.filter((candidate) => !isFailed(candidate))) {
    const failed = entry.manifest.dependsOn.find((id) => {
      const dependency = installed.get(id);
      return dependency !== undefined && isFailed(dependency);
    });
    if (failed !== undefined) {
      entry.errors.push(`needs "${failed}", which failed`);
    }
  }
}

/** An always-on extension cannot be turned off, so its failure stops the app, with every problem. */
function throwIfAlwaysOnFailed(ordered: readonly Entry[]) {
  if (ordered.some((entry) => entry.manifest.alwaysOn && isFailed(entry))) {
    throw new ExtensionRegistryError(ordered.flatMap(({ manifest, errors }) =>
      errors.map((error) => `"${manifest.id}" ${error}`)));
  }
}

/** Checks the installed extensions against each other: those that do not fit are marked failed. */
export function createExtensionRegistry(
  manifests: readonly ExtensionManifest[],
  { servers = [], appLocales = [] }: ExtensionRegistryOptions = {},
): ExtensionRegistry {
  const installed = new Map<string, Entry>();
  const duplicates: Entry[] = [];
  for (const manifest of manifests) {
    if (installed.has(manifest.id)) {
      duplicates.push({ manifest, errors: ['is installed twice'] });
    } else {
      const server = servers.find(({ extension }) => extension === manifest.id);
      installed.set(manifest.id, { manifest, errors: [], ...(server ? { server } : {}) });
    }
  }
  for (const entry of installed.values()) {
    entry.errors.push(...ownErrors(entry, installed));
  }
  const { sorted, unordered, cycles } = sortByDependencies(installed);
  const waiting = new Set(unordered.map(({ manifest }) => manifest.id));
  for (const entry of unordered) {
    const cycle = cycles.get(entry.manifest.id);
    // Not in a cycle itself: it waits on an extension that is (directly or further down).
    entry.errors.push(cycle === undefined
      ? `needs "${entry.manifest.dependsOn.find((id) => waiting.has(id)) ?? ''}", which failed`
      : `is in a dependency cycle: ${cycle}`);
  }
  contributionErrors(sorted, appLocales);
  failDependents(sorted, installed);
  const ordered = [...sorted, ...unordered, ...duplicates];
  throwIfAlwaysOnFailed(ordered);

  const view = ({ manifest, errors, server }: Entry): RegisteredExtension => ({
    manifest,
    state: errors.length > 0 ? 'failed' : 'active',
    errors: [...errors],
    ...(server ? { server } : {}),
  });
  const active = () => ordered.filter((entry) => !isFailed(entry)).map(({ manifest }) => manifest);
  const kinds = (entity: KindEntity) => active().flatMap((manifest) =>
    (manifest.contributes.kinds[entity] ?? []).map((kind) => ({ ...kind, extension: manifest.id })));

  return {
    get extensions() {
      return ordered.map(view);
    },
    get active() {
      return active();
    },
    get: (id) => {
      const entry = installed.get(id);
      return entry ? view(entry) : undefined;
    },
    kinds,
    hasKind: (entity, id) => kinds(entity).some((kind) => kind.id === id),
    locales: () => active().flatMap((manifest) =>
      (manifest.contributes.locales ?? []).map((locale) => ({ ...locale, extension: manifest.id }))),
    fail: (id, error) => {
      const entry = installed.get(id);
      if (!entry) {
        return;
      }
      entry.errors.push(error);
      failDependents(ordered, installed);
      throwIfAlwaysOnFailed(ordered);
    },
    // Each with the table prefixes it may refer to, which the repositories enforce at runtime.
    repositories: () => ordered.filter((entry) => !isFailed(entry)).flatMap(({ manifest, server }) =>
      (server?.repositories ?? []).map((definition) => ({ ...definition, tablePrefixes: tablePrefixesOf(manifest) }))),
  };
}
