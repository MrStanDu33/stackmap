import { EXTENSION_API_VERSION, KIND_ENTITIES } from '@stackmap/extension-sdk';

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

const byId = (a: ExtensionManifest, b: ExtensionManifest) => a.id.localeCompare(b.id);

/** Problems with a single extension's dependencies and API version. */
function dependencyProblems(extension: ExtensionManifest, installed: ReadonlyMap<string, ExtensionManifest>): string[] {
  const problems = extension.apiVersion === EXTENSION_API_VERSION
    ? []
    : [`"${extension.id}" targets extension API ${String(extension.apiVersion)}; `
      + `this Stackmap supports ${String(EXTENSION_API_VERSION)}`];
  for (const dependencyId of extension.dependsOn) {
    const dependency = installed.get(dependencyId);
    if (!dependency) {
      problems.push(`"${extension.id}" depends on "${dependencyId}", which is not installed`);
    } else if (extension.alwaysOn && !dependency.alwaysOn) {
      problems.push(`"${extension.id}" is always on but depends on "${dependencyId}", which can be turned off`);
    }
  }
  return problems;
}

/** Two extensions must not add the same kind to the same entity: kinds are stored by id. */
function kindConflicts(extensions: readonly ExtensionManifest[]): string[] {
  const problems: string[] = [];
  for (const entity of KIND_ENTITIES) {
    const owners = new Map<string, string>();
    for (const extension of extensions) {
      for (const { id } of extension.contributes.kinds[entity] ?? []) {
        const owner = owners.get(id);
        if (owner === undefined) {
          owners.set(id, extension.id);
        } else {
          problems.push(`${entity} kind "${id}" is contributed by both "${owner}" and "${extension.id}"`);
        }
      }
    }
  }
  return problems;
}

/**
 * Orders extensions so that dependencies come first, picking the smallest id whenever several are ready. Extensions
 * caught in a cycle are left out and reported.
 */
function sortByDependencies(installed: ReadonlyMap<string, ExtensionManifest>) {
  const sorted: ExtensionManifest[] = [];
  const remaining = new Map(installed);
  const nextReady = () => [...remaining.values()]
    .filter((extension) => extension.dependsOn.every((dependency) => !remaining.has(dependency)))
    .sort(byId)[0];
  for (let ready = nextReady(); ready; ready = nextReady()) {
    sorted.push(ready);
    remaining.delete(ready.id);
  }

  const cycles: string[] = [];
  const reported = new Set<string>();
  for (const start of [...remaining.values()].sort(byId)) {
    if (reported.has(start.id)) {
      continue;
    }
    // Follow dependencies that are still waiting until one comes back: that loop is a cycle.
    const path: string[] = [];
    let current: ExtensionManifest | undefined = start;
    while (current && !path.includes(current.id)) {
      path.push(current.id);
      current = [...current.dependsOn].sort().map((id) => remaining.get(id)).find(Boolean);
    }
    if (current) {
      const cycle = [...path.slice(path.indexOf(current.id)), current.id];
      cycle.forEach((id) => reported.add(id));
      cycles.push(`dependency cycle: ${cycle.join(' → ')}`);
    }
  }
  return { sorted, cycles };
}

/** Checks the installed extensions against each other and indexes what they contribute. */
export function createExtensionRegistry(manifests: readonly ExtensionManifest[]): ExtensionRegistry {
  const problems: string[] = [];
  const installed = new Map<string, ExtensionManifest>();
  for (const manifest of manifests) {
    if (!installed.has(manifest.id)) {
      installed.set(manifest.id, manifest);
    } else if (!problems.includes(`extension "${manifest.id}" is installed twice`)) {
      problems.push(`extension "${manifest.id}" is installed twice`);
    }
  }
  for (const extension of installed.values()) {
    problems.push(...dependencyProblems(extension, installed));
  }
  const { sorted, cycles } = sortByDependencies(installed);
  problems.push(...cycles, ...kindConflicts([...installed.values()]));
  if (problems.length > 0) {
    throw new ExtensionRegistryError(problems);
  }

  const kinds = new Map(KIND_ENTITIES.map((entity) => [
    entity,
    sorted.flatMap((extension) => (extension.contributes.kinds[entity] ?? []).map((kind) => ({
      ...kind,
      extension: extension.id,
    }))),
  ]));
  const kindIds = new Map(KIND_ENTITIES.map((entity) => [entity, new Set(kinds.get(entity)?.map(({ id }) => id))]));

  return {
    extensions: sorted,
    get: (id) => installed.get(id),
    kinds: (entity) => kinds.get(entity) ?? [],
    hasKind: (entity, id) => kindIds.get(entity)?.has(id) ?? false,
  };
}
