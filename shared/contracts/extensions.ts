import { z } from 'zod';

import { defineContract } from './contract';

export const ExtensionKind = z.object({
  id: z.string(),
  label: z.string().meta({ description: 'i18n key' }),
  icon: z.string().optional(),
}).meta({ id: 'ExtensionKind', description: 'A kind an extension adds to a core entity' });

const kinds = z.array(ExtensionKind);

export const ExtensionLocale = z.object({
  code: z.string(),
  language: z.string().meta({ description: 'BCP 47 language tag' }),
  name: z.string().meta({ description: 'The language\'s name in that language' }),
}).meta({ id: 'ExtensionLocale', description: 'A language an extension adds' });

const state = z.enum(['active', 'failed']).meta({ description: 'A failed extension contributes nothing' });

export const Extension = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string().meta({ description: 'i18n key' }),
  description: z.string().meta({ description: 'i18n key' }),
  icon: z.string().optional().meta({ description: 'A Lucide icon name or an image path; absent when unknown' }),
  alwaysOn: z.boolean(),
  dependsOn: z.array(z.string()),
  state,
  enabled: z.boolean().meta({ description: 'Always true until extensions can be turned off per workspace' }),
  kinds: z.object({ host: kinds, network: kinds, service: kinds, protocol: kinds }),
  locales: z.array(ExtensionLocale),
}).meta({ id: 'Extension', description: 'An installed extension' });

export const listExtensions = defineContract({
  method: 'get',
  path: '/api/extensions',
  operationId: 'listExtensions',
  summary: 'List the installed extensions',
  description: 'Dependencies come before the extensions that need them. Strings are i18n keys.',
  tags: ['Extensions'],
  requiredRole: 'viewer',
  responses: {
    200: { description: 'The installed extensions', schema: z.object({ extensions: z.array(Extension) }) },
  },
});

export const ExtensionDiagnostics = z.object({
  extensions: z.array(z.object({
    id: z.string(),
    version: z.string(),
    state,
    errors: z.array(z.string()),
    code: z.object({ server: z.boolean(), client: z.boolean() }),
    hooks: z.object({
      provides: z.array(z.string()).meta({ description: 'Hooks the extension declares, as <id>:<name>' }),
      handles: z.array(z.string()).meta({ description: 'Server hooks the extension handles' }),
    }),
  })),
  languages: z.array(ExtensionLocale.extend({
    coverage: z.number().min(0).max(1).meta({ description: 'Share of the English keys translated' }),
    missing: z.array(z.string()),
    conflicts: z.array(z.object({
      key: z.string(),
      winner: z.string().nullable().meta({ description: 'The extension whose translation is used; null: the app' }),
      ignored: z.array(z.string().nullable()),
    })),
  })),
}).meta({ id: 'ExtensionDiagnostics', description: 'What each extension does, why it failed, and translation coverage' });

export const getExtensionDiagnostics = defineContract({
  method: 'get',
  path: '/api/extensions/diagnostics',
  operationId: 'getExtensionDiagnostics',
  summary: 'Diagnose the installed extensions',
  description: 'For admins, extension authors and maintainers: states, errors, code, hooks and translation coverage.',
  tags: ['Extensions'],
  requiredRole: 'admin',
  responses: {
    200: { description: 'The extensions and languages, with their diagnostics', schema: ExtensionDiagnostics },
  },
});
