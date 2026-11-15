import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { problem } from './auth';
import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { HOOK, i18nKey, icon, kebabId, LANGUAGE_TAG, LOCALE_CODE, semver, text } from './formats';

/** Longest hook name: `<id>:<name>`, each at most 40 characters. */
export const MAX_HOOK = 81;

const hook = () => z.string().max(MAX_HOOK).regex(HOOK);

const iconDescription = 'A Lucide icon name (`i-lucide-…`) or the path of an image the extension ships; absent when '
  + 'there is none or the app cannot show it (the interface then shows a generic icon)';

const lan = { id: 'lan', label: 'extensions.core.kinds.network.lan', icon: 'i-lucide-network' };
const german = { code: 'de', language: 'de-DE', name: 'Deutsch' };

export const ExtensionKind = z.object({
  id: kebabId().meta({ description: 'Stored in the database; unique per entity', examples: ['lan'] }),
  label: i18nKey().meta({ description: 'i18n key of its name', examples: [lan.label] }),
  icon: icon().optional().meta({ description: iconDescription, examples: [lan.icon] }),
}).meta({ id: 'ExtensionKind', description: 'A kind an extension adds to a core entity', examples: [lan] });

const kindsOf = (entity: string) => z.array(ExtensionKind).max(200).meta({ description: `Kinds it adds to ${entity}` });

const host = { id: 'host', label: 'extensions.core.entities.host' };

export const ExtensionEntity = z.object({
  id: kebabId().meta({ description: 'Unique in the extension', examples: ['host'] }),
  label: i18nKey().meta({ description: 'i18n key of its name', examples: [host.label] }),
}).meta({ id: 'ExtensionEntity', description: 'An entity type an extension adds', examples: [host] });

export const ExtensionLocale = z.object({
  code: z.string().max(12).regex(LOCALE_CODE).meta({ description: 'Locale code, as in settings', examples: ['de'] }),
  language: z.string().max(35).regex(LANGUAGE_TAG).meta({ description: 'BCP 47 language tag', examples: ['de-DE'] }),
  name: text(100).min(1).meta({ description: 'The language\'s name, in that language', examples: ['Deutsch'] }),
}).meta({ id: 'ExtensionLocale', description: 'A language an extension adds', examples: [german] });

const state = z.enum(['active', 'failed']).meta({
  description: '`failed` when it does not fit with the others or its setup failed: it then contributes nothing',
  examples: ['active'],
});

const core = {
  id: 'core',
  version: '1.4.0',
  name: 'extensions.core.name',
  description: 'extensions.core.description',
  icon: 'i-lucide-layers',
  alwaysOn: true,
  dependsOn: [],
  state: 'active',
  kinds: { host: [], network: [lan], service: [], protocol: [] },
  entities: [host],
  locales: [],
};

export const Extension = z.object({
  id: kebabId().meta({ description: 'Unique, kebab-case', examples: ['core'] }),
  version: semver().meta({ description: 'Its semantic version', examples: ['1.4.0'] }),
  name: i18nKey().meta({ description: 'i18n key of its name', examples: [core.name] }),
  description: i18nKey().meta({ description: 'i18n key of what it adds', examples: [core.description] }),
  icon: icon().optional().meta({ description: iconDescription, examples: [core.icon] }),
  alwaysOn: z.boolean().meta({ description: 'Whether it can never be turned off (the core)', examples: [true] }),
  dependsOn: z.array(kebabId()).max(50).meta({ description: 'Ids of the extensions it needs' }),
  state,
  kinds: z.object({
    host: kindsOf('hosts'),
    network: kindsOf('networks'),
    service: kindsOf('services'),
    protocol: kindsOf('flows (protocols)'),
  }).meta({ description: 'Kinds it adds, by core entity; empty when it failed' }),
  entities: z.array(ExtensionEntity).max(50).meta({ description: 'Entity types it adds; empty when it failed' }),
  locales: z.array(ExtensionLocale).max(50).meta({ description: 'Languages it adds; empty when it failed' }),
}).meta({ id: 'Extension', description: 'An installed extension', examples: [core] });

/** An installed extension, as `GET /api/extensions` lists it. */
export type InstalledExtension = z.infer<typeof Extension>;

export const listExtensions = defineContract({
  method: 'get',
  path: '/api/extensions',
  operationId: 'listExtensions',
  summary: 'List the installed extensions',
  description: 'Every installed extension, dependencies first, with what it adds. Strings are i18n keys: the '
    + 'interface translates them. The interface builds its kinds, icons and languages from this list.',
  tags: ['Extensions'],
  requiredRole: 'signedIn',
  responses: {
    200: {
      description: 'The installed extensions',
      schema: z.object({
        extensions: z.array(Extension).max(100).meta({ description: 'Dependencies first, then by id' }),
      }),
      examples: { core: { summary: 'Only the core', value: { extensions: [core] } } },
    },
  },
});

const diagnosed = {
  id: 'vpn',
  version: '1.0.0',
  state: 'failed',
  errors: ['depends on "tls", which is not installed'],
  code: { server: true, client: false },
  hooks: { provides: ['vpn:peer-added'], handles: ['app:ready'] },
};
const germanCoverage = {
  ...german,
  coverage: 0.98,
  missing: ['extensions.vpn.name'],
  conflicts: [{ key: 'app.name', winner: null, ignored: ['german-pack'] }],
};

export const ExtensionDiagnostics = z.object({
  extensions: z.array(z.object({
    id: kebabId().meta({ description: 'Its id', examples: ['vpn'] }),
    version: semver().meta({ description: 'Its version', examples: ['1.0.0'] }),
    state,
    errors: z.array(text(1000).min(1)).max(50).meta({
      description: 'Why it failed (credentials masked; the server logs have the full errors)',
    }),
    code: z.object({
      server: z.boolean().meta({ description: 'Whether it runs code on the server', examples: [true] }),
      client: z.boolean().meta({ description: 'Whether it runs code in the browser', examples: [false] }),
    }).meta({ description: 'The code it declares, of which users are warned before installing it' }),
    hooks: z.object({
      provides: z.array(hook()).max(100).meta({ description: 'Hooks it declares, as `<id>:<name>`' }),
      handles: z.array(text(MAX_HOOK).min(1)).max(100).meta({ description: 'Server hooks it handles, as its code names them' }),
    }).meta({ description: 'Its hooks' }),
  })).max(100).meta({ description: 'Every installed extension, in registry order' }),
  languages: z.array(ExtensionLocale.extend({
    coverage: z.number().min(0).max(1).meta({ description: 'Share of the English keys translated', examples: [0.98] }),
    missing: z.array(i18nKey()).max(10_000).meta({ description: 'Keys it does not translate: they show in English' }),
    conflicts: z.array(z.object({
      key: i18nKey().meta({ description: 'The key translated more than once', examples: ['app.name'] }),
      winner: kebabId().nullable().meta({ description: 'Whose translation is used; `null`: the app', examples: [null] }),
      ignored: z.array(kebabId().nullable()).max(50).meta({ description: 'Whose translations are ignored; `null`: the app' }),
    })).max(10_000).meta({ description: 'Keys translated by more than one extension, and which translation wins' }),
  })).max(50).meta({ description: 'Every language, with its translation coverage' }),
}).meta({
  id: 'ExtensionDiagnostics',
  description: 'What each extension does, why it failed, and translation coverage',
  examples: [{ extensions: [diagnosed], languages: [germanCoverage] }],
});

export const getExtensionDiagnostics = defineContract({
  method: 'get',
  path: '/api/extensions/diagnostics',
  operationId: 'getExtensionDiagnostics',
  summary: 'Diagnose the installed extensions',
  description: 'For admins, extension authors and maintainers: each extension\'s state and errors, the code it runs, '
    + 'its hooks, and every language\'s translation coverage, missing keys and conflicts.',
  tags: ['Extensions'],
  requiredRole: 'instanceAdmin',
  responses: {
    200: {
      description: 'The extensions and languages, with their diagnostics',
      schema: ExtensionDiagnostics,
      examples: {
        failedExtension: {
          summary: 'An extension that failed, and a German pack',
          value: { extensions: [diagnosed], languages: [germanCoverage] },
        },
      },
    },
  },
});

const nat = {
  ...core,
  id: 'nat',
  version: '1.0.0',
  name: 'extensions.nat.name',
  description: 'extensions.nat.description',
  icon: 'i-lucide-arrow-right-left',
  alwaysOn: false,
  dependsOn: ['core'],
  enabled: false,
  kinds: { host: [], network: [], service: [], protocol: [] },
  entities: [{ id: 'port-forward', label: 'extensions.nat.entities.port-forward' }],
};

export const WorkspaceExtension = Extension.extend({
  enabled: z.boolean().meta({ description: 'Whether it is on in this workspace; the core always is', examples: [false] }),
}).meta({ id: 'WorkspaceExtension', description: 'An installed extension, on or off in a workspace', examples: [nat] });

/** An installed extension as a workspace sees it, on or off. */
export type WorkspaceExtension = z.infer<typeof WorkspaceExtension>;

/** The example workspace id the other contracts use. */
const WORKSPACE_ID = '0199d6a0-0000-7000-8000-000000000001';

const WORKSPACE_EXTENSIONS_PATH = '/api/workspaces/:workspaceId/extensions';
const extensionsInstance = WORKSPACE_EXTENSIONS_PATH.replace(':workspaceId', WORKSPACE_ID);
const natInstance = `${extensionsInstance}/nat`;

const workspaceParams = z.object({
  workspaceId: entityId().meta({ description: 'The workspace\'s id', examples: [WORKSPACE_ID] }),
});
const extensionParams = workspaceParams.extend({
  extensionId: kebabId().meta({ description: 'The extension\'s id', examples: ['nat'] }),
});

const notInstalled = (instance: string) => ({
  description: 'No installed extension has this id, or a workspace the caller cannot open',
  schema: Problem,
  examples: {
    extension_not_found: {
      summary: 'No such extension',
      value: problemOf('extension_not_found', { detail: 'No installed extension has this id.', instance }),
    },
    workspace_not_found: {
      summary: 'No such workspace',
      value: problemOf('workspace_not_found', { detail: 'No workspace with this id that you can open.', instance }),
    },
  },
});
const alwaysOn = (instance: string) => problem(
  'The extension cannot be turned off (the core)',
  'extension_always_on',
  'The core extension cannot be turned off.',
  instance,
);

export const listWorkspaceExtensions = defineContract({
  method: 'get',
  path: WORKSPACE_EXTENSIONS_PATH,
  operationId: 'listWorkspaceExtensions',
  summary: 'List the extensions of a workspace',
  description: 'Every installed extension as `GET /api/extensions` lists it, with whether it is on in this workspace. '
    + 'Workspace pages build their kinds, types and labels from this list.',
  tags: ['Extensions'],
  requiredRole: 'viewer',
  params: workspaceParams,
  responses: {
    200: {
      description: 'The installed extensions, on or off in the workspace',
      schema: z.object({
        extensions: z.array(WorkspaceExtension).max(100).meta({ description: 'Dependencies first, then by id' }),
      }),
      examples: {
        natOff: { summary: 'NAT turned off', value: { extensions: [{ ...core, enabled: true }, nat] } },
      },
    },
  },
});

const ExtensionChange = z.object({
  id: kebabId().meta({ description: 'The extension that changes', examples: ['nat'] }),
  enabled: z.boolean().meta({ description: 'Whether it is on after the change', examples: [false] }),
}).meta({ id: 'ExtensionChange', description: 'An extension turned on or off', examples: [{ id: 'nat', enabled: false }] });

export const ExtensionImpact = ExtensionChange.extend({
  entities: z.array(z.object({
    entity: kebabId().meta({ description: 'The entity type', examples: ['port-forward'] }),
    count: z.number().int().min(0).meta({ description: 'How many the workspace has', examples: [3] }),
  })).max(50).meta({ description: 'Its entities by type; empty when it comes on' }),
  derivedFlows: z.number().int().min(0).meta({ description: 'How many stored flows it derives; 0 when it comes on', examples: [2] }),
}).meta({
  id: 'ExtensionImpact',
  description: 'An extension that a toggle would change, with what stays saved but hidden when it goes off',
  examples: [{ id: 'nat', enabled: false, entities: [{ entity: 'port-forward', count: 3 }], derivedFlows: 2 }],
});

/** An extension a toggle would change, as the confirmation shows it. */
export type ExtensionImpact = z.infer<typeof ExtensionImpact>;

const impactExample = {
  changes: [{ id: 'nat', enabled: false, entities: [{ entity: 'port-forward', count: 3 }], derivedFlows: 2 }],
};

export const previewExtensionToggle = defineContract({
  method: 'get',
  path: `${WORKSPACE_EXTENSIONS_PATH}/:extensionId/impact`,
  operationId: 'previewExtensionToggle',
  summary: 'Preview turning an extension on or off',
  description: 'What turning the extension on or off would change in the workspace: the extensions that change with '
    + 'it (its dependents going off, its dependencies coming on) and, for each one going off, how many of its '
    + 'entities and derived flows stay saved but hidden. Changes nothing.',
  tags: ['Extensions'],
  requiredRole: 'viewer',
  params: extensionParams,
  query: z.strictObject({
    enabled: z.enum(['true', 'false']).transform((value) => value === 'true')
      .meta({ description: 'Whether to preview turning it on (`true`) or off (`false`)', examples: ['false'] }),
  }),
  responses: {
    200: {
      description: 'The extensions that would change, the asked one first',
      schema: z.object({
        changes: z.array(ExtensionImpact).max(100).meta({ description: 'Empty when it is already in the asked state' }),
      }),
      examples: { natOff: { summary: 'Turning NAT off', value: impactExample } },
    },
    404: notInstalled(`${natInstance}/impact`),
    409: alwaysOn(`${extensionsInstance}/core/impact`),
  },
});

export const setExtensionEnabled = defineContract({
  method: 'put',
  path: `${WORKSPACE_EXTENSIONS_PATH}/:extensionId`,
  operationId: 'setExtensionEnabled',
  summary: 'Turn an extension on or off',
  description: 'For workspace admins and owners. Turning an extension off also turns off the extensions that need '
    + 'it; turning one on also turns on those it needs. Nothing is deleted: its entities stay saved but hidden, and '
    + 'its entity API answers `409 extension_disabled`, until it is turned back on.',
  tags: ['Extensions'],
  requiredRole: 'admin',
  params: extensionParams,
  body: z.strictObject({
    enabled: z.boolean().meta({ description: 'Whether to turn it on', examples: [false] }),
  }).meta({ description: 'The state asked for', examples: [{ enabled: false }] }),
  responses: {
    200: {
      description: 'The extensions that changed, the asked one first; empty when it already was in that state',
      schema: z.object({
        changed: z.array(ExtensionChange).max(100).meta({ description: 'The extensions that changed' }),
      }),
      examples: { natOff: { summary: 'NAT turned off', value: { changed: [{ id: 'nat', enabled: false }] } } },
    },
    404: notInstalled(natInstance),
    409: alwaysOn(`${extensionsInstance}/core`),
  },
});

const orphanParams = extensionParams.extend({
  entity: kebabId().meta({ description: 'The entity type, declared by the extension', examples: ['port-forward'] }),
  entityId: text(100).meta({ description: 'The entity\'s id', examples: ['0199d6a0-0000-7000-8000-000000000030'] }),
});
const orphansInstance = `${natInstance}/orphans`;
const orphanInstance = `${orphansInstance}/port-forward/0199d6a0-0000-7000-8000-000000000030`;
const orphan = {
  entity: 'port-forward',
  id: '0199d6a0-0000-7000-8000-000000000030',
  fields: { hostId: '0199d6a0-0000-7000-8000-000000000002', externalAddress: '203.0.113.10', externalPort: 8080 },
};

const extensionEnabled = (instance: string) => ({
  description: 'The extension is on in the workspace, so nothing of it is hidden',
  schema: Problem,
  examples: {
    extension_enabled: {
      summary: 'The extension is on',
      value: problemOf('extension_enabled', { detail: 'The nat extension is on: it hides nothing.', instance }),
    },
  },
});
const orphanConflict = (instance: string, inUse: boolean) => ({
  description: inUse
    ? 'The extension is on, a flow is based on the entity, or other entities refer to it'
    : 'The extension is on, or a flow is based on the entity',
  schema: Problem,
  examples: {
    extension_enabled: {
      summary: 'The extension is on',
      value: problemOf('extension_enabled', { detail: 'The nat extension is on: it hides nothing.', instance }),
    },
    hidden_entity_connected: {
      summary: 'A flow is based on it',
      value: problemOf('hidden_entity_connected', { detail: 'A flow is based on this entity.', instance }),
    },
    ...(inUse
      ? {
          entity_in_use: {
            summary: 'Other entities refer to it',
            value: problemOf('entity_in_use', { detail: 'The entity is still used by 1 route.', instance }),
          },
        }
      : {}),
  },
});
const orphanNotFound = (instance: string) => ({
  description: 'No such entity of this type in the workspace, no such type in the extension, or no such extension',
  schema: Problem,
  examples: {
    entity_not_found: {
      summary: 'No such entity',
      value: problemOf('entity_not_found', { detail: 'No port-forward with this id in the workspace.', instance }),
    },
    entity_type_not_found: {
      summary: 'No such type',
      value: problemOf('entity_type_not_found', { detail: 'The extension declares no such entity type.', instance }),
    },
    extension_not_found: {
      summary: 'No such extension',
      value: problemOf('extension_not_found', { detail: 'No installed extension has this id.', instance }),
    },
  },
});

export const listHiddenOrphans = defineContract({
  method: 'get',
  path: `${WORKSPACE_EXTENSIONS_PATH}/:extensionId/orphans`,
  operationId: 'listHiddenOrphans',
  summary: 'List the hidden entities that connect to nothing',
  description: 'The entities of an extension turned off in the workspace that no flow is based on any more, less those '
    + 'kept hidden, at most 200 per entity type. Admins and owners can delete each or keep it hidden.',
  tags: ['Extensions'],
  requiredRole: 'viewer',
  params: extensionParams,
  responses: {
    200: {
      description: 'The disconnected hidden entities',
      schema: z.object({
        items: z.array(z.object({
          entity: kebabId().meta({ description: 'Its entity type', examples: ['port-forward'] }),
          id: entityId().meta({ description: 'Its id', examples: [orphan.id] }),
          fields: z.record(z.string().max(100).regex(/^[A-Za-z][\w-]*$/), z.union([
            text(2000), z.number(), z.boolean(), z.null(), z.array(text(2000)).max(100),
          ])).meta({
            description: 'Its fields as the entity API returns them (dates as ISO strings), those holding text, '
              + 'numbers, booleans, null or lists of text: enough to name it as the inventory does',
          }),
        })).max(1000).meta({ description: 'By entity type, then creation order' }),
        truncated: z.boolean().meta({ description: 'Whether a type had more than 200', examples: [false] }),
      }),
      examples: { natOff: { summary: 'One port forward', value: { items: [orphan], truncated: false } } },
    },
    404: notInstalled(orphansInstance),
    409: extensionEnabled(orphansInstance),
  },
});

export const keepHiddenOrphan = defineContract({
  method: 'put',
  path: `${WORKSPACE_EXTENSIONS_PATH}/:extensionId/orphans/:entity/:entityId/kept`,
  operationId: 'keepHiddenOrphan',
  summary: 'Keep a hidden entity hidden',
  description: 'For workspace admins and owners: the entity leaves the list of disconnected hidden entities and stays '
    + 'hidden. Its mark is cleared when the extension is turned back on.',
  tags: ['Extensions'],
  requiredRole: 'admin',
  params: orphanParams,
  responses: {
    204: { description: 'Kept hidden', schema: z.null(), examples: { kept: { summary: 'Kept hidden', value: null } } },
    404: orphanNotFound(`${orphanInstance}/kept`),
    409: orphanConflict(`${orphanInstance}/kept`, false),
  },
});

export const removeHiddenOrphan = defineContract({
  method: 'delete',
  path: `${WORKSPACE_EXTENSIONS_PATH}/:extensionId/orphans/:entity/:entityId`,
  operationId: 'removeHiddenOrphan',
  summary: 'Delete a hidden entity that connects to nothing',
  description: 'For workspace admins and owners: deletes an entity of an extension turned off in the workspace, if no '
    + 'flow is based on it. Audit-logged like any deletion; it cannot be undone.',
  tags: ['Extensions'],
  requiredRole: 'admin',
  params: orphanParams,
  responses: {
    204: { description: 'Deleted', schema: z.null(), examples: { deleted: { summary: 'Deleted', value: null } } },
    404: orphanNotFound(orphanInstance),
    409: orphanConflict(orphanInstance, true),
  },
});
