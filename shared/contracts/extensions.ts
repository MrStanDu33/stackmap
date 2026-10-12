import { z } from 'zod';

import { defineContract } from './contract';

export const ExtensionKind = z.object({
  id: z.string(),
  label: z.string().meta({ description: 'i18n key' }),
  icon: z.string().optional(),
}).meta({ id: 'ExtensionKind', description: 'A kind an extension adds to a core entity' });

const kinds = z.array(ExtensionKind);

export const Extension = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string().meta({ description: 'i18n key' }),
  description: z.string().meta({ description: 'i18n key' }),
  icon: z.string().optional().meta({ description: 'A Lucide icon name or an image path; absent when unknown' }),
  alwaysOn: z.boolean(),
  dependsOn: z.array(z.string()),
  enabled: z.boolean().meta({ description: 'Always true until extensions can be turned off per workspace' }),
  kinds: z.object({ host: kinds, network: kinds, service: kinds, protocol: kinds }),
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
