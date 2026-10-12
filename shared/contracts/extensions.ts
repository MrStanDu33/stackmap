import { z } from 'zod';

import { defineContract } from './contract';
import { SEMVER } from './system';

const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const LOCALE_CODE = /^[a-z]{2,3}(?:-[A-Z]{2}|-[A-Z][a-z]{3})?$/;
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const iconDescription = 'A Lucide icon name (`i-lucide-…`) or the path of an image the extension ships; absent when '
  + 'there is none or the app cannot show it (the interface then shows a generic icon)';

const lan = { id: 'lan', label: 'extensions.core.kinds.network.lan', icon: 'i-lucide-network' };
const german = { code: 'de', language: 'de-DE', name: 'Deutsch' };

export const ExtensionKind = z.object({
  id: z.string().regex(KEBAB_CASE).meta({ description: 'Stored in the database; unique per entity', examples: ['lan'] }),
  label: z.string().min(1).meta({ description: 'i18n key of its name', examples: [lan.label] }),
  icon: z.string().min(1).optional().meta({ description: iconDescription, examples: [lan.icon] }),
}).meta({ id: 'ExtensionKind', description: 'A kind an extension adds to a core entity', examples: [lan] });

const kindsOf = (entity: string) => z.array(ExtensionKind).meta({ description: `Kinds it adds to ${entity}` });

export const ExtensionLocale = z.object({
  code: z.string().regex(LOCALE_CODE).meta({ description: 'Locale code, as in settings', examples: ['de'] }),
  language: z.string().regex(LANGUAGE_TAG).meta({ description: 'BCP 47 language tag', examples: ['de-DE'] }),
  name: z.string().min(1).meta({ description: 'The language\'s name, in that language', examples: ['Deutsch'] }),
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
  enabled: true,
  kinds: { host: [], network: [lan], service: [], protocol: [] },
  locales: [],
};

export const Extension = z.object({
  id: z.string().regex(KEBAB_CASE).meta({ description: 'Unique, kebab-case', examples: ['core'] }),
  version: z.string().regex(SEMVER).meta({ description: 'Its semantic version', examples: ['1.4.0'] }),
  name: z.string().min(1).meta({ description: 'i18n key of its name', examples: [core.name] }),
  description: z.string().min(1).meta({ description: 'i18n key of what it adds', examples: [core.description] }),
  icon: z.string().min(1).optional().meta({ description: iconDescription, examples: [core.icon] }),
  alwaysOn: z.boolean().meta({ description: 'Whether it can never be turned off (the core)', examples: [true] }),
  dependsOn: z.array(z.string().regex(KEBAB_CASE)).meta({ description: 'Ids of the extensions it needs' }),
  state,
  enabled: z.boolean().meta({ description: 'Always true until extensions can be turned off per workspace', examples: [true] }),
  kinds: z.object({
    host: kindsOf('hosts'),
    network: kindsOf('networks'),
    service: kindsOf('services'),
    protocol: kindsOf('flows (protocols)'),
  }).meta({ description: 'Kinds it adds, by core entity; empty when it failed' }),
  locales: z.array(ExtensionLocale).meta({ description: 'Languages it adds; empty when it failed' }),
}).meta({ id: 'Extension', description: 'An installed extension', examples: [core] });

export const listExtensions = defineContract({
  method: 'get',
  path: '/api/extensions',
  operationId: 'listExtensions',
  summary: 'List the installed extensions',
  description: 'Every installed extension, dependencies first, with what it adds. Strings are i18n keys: the '
    + 'interface translates them. The interface builds its kinds, icons and languages from this list.',
  tags: ['Extensions'],
  requiredRole: 'viewer',
  responses: {
    200: {
      description: 'The installed extensions',
      schema: z.object({
        extensions: z.array(Extension).meta({ description: 'Dependencies first, then by id' }),
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
    id: z.string().regex(KEBAB_CASE).meta({ description: 'Its id', examples: ['vpn'] }),
    version: z.string().regex(SEMVER).meta({ description: 'Its version', examples: ['1.0.0'] }),
    state,
    errors: z.array(z.string().min(1)).meta({
      description: 'Why it failed (credentials masked; the server logs have the full errors)',
    }),
    code: z.object({
      server: z.boolean().meta({ description: 'Whether it runs code on the server', examples: [true] }),
      client: z.boolean().meta({ description: 'Whether it runs code in the browser', examples: [false] }),
    }).meta({ description: 'The code it declares, of which users are warned before installing it' }),
    hooks: z.object({
      provides: z.array(z.string().min(1)).meta({ description: 'Hooks it declares, as `<id>:<name>`' }),
      handles: z.array(z.string().min(1)).meta({ description: 'Server hooks it handles' }),
    }).meta({ description: 'Its hooks' }),
  })).meta({ description: 'Every installed extension, in registry order' }),
  languages: z.array(ExtensionLocale.extend({
    coverage: z.number().min(0).max(1).meta({ description: 'Share of the English keys translated', examples: [0.98] }),
    missing: z.array(z.string().min(1)).meta({ description: 'Keys it does not translate: they show in English' }),
    conflicts: z.array(z.object({
      key: z.string().min(1).meta({ description: 'The key translated more than once', examples: ['app.name'] }),
      winner: z.string().nullable().meta({ description: 'Whose translation is used; `null`: the app', examples: [null] }),
      ignored: z.array(z.string().nullable()).meta({ description: 'Whose translations are ignored' }),
    })).meta({ description: 'Keys translated by more than one extension, and which translation wins' }),
  })).meta({ description: 'Every language, with its translation coverage' }),
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
  requiredRole: 'admin',
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
