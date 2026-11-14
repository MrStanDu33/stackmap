import { z } from 'zod';

import { password, problem, tooMany, MAX_PASSWORD } from './auth';
import { defineContract } from './contract';
import { text } from './formats';
import { CONTRASTS, LANDING_PAGES, LOCALES, Preferences, THEMES } from './preferences';

const choice = <const T extends readonly [string, ...string[]]>(values: T, description: string) =>
  z.enum(values).nullable().optional().meta({ description: `${description}; null forgets the choice`, examples: [values[0]] });

export const updatePreferences = defineContract({
  method: 'put',
  path: '/api/account/preferences',
  operationId: 'updatePreferences',
  summary: 'Save display preferences and the landing page',
  description: 'Saves the given preferences on the signed-in account and leaves the others as they were.',
  tags: ['Accounts'],
  requiredRole: 'signedIn',
  body: z.strictObject({
    theme: choice(THEMES, 'The color theme'),
    contrast: choice(CONTRASTS, 'The contrast'),
    locale: choice(LOCALES, 'The interface language'),
    landingPage: choice(LANDING_PAGES, 'The page `/` opens'),
  }).meta({ description: 'The preferences to change' }),
  responses: {
    200: {
      description: 'Every preference, after the change',
      schema: Preferences,
      examples: { saved: { summary: 'Light theme chosen', value: { theme: 'light', contrast: null, locale: 'fr', landingPage: 'graph' } } },
    },
  },
});

export const changePassword = defineContract({
  method: 'put',
  path: '/api/account/password',
  operationId: 'changePassword',
  summary: 'Change the password',
  description: 'Replaces the signed-in account\'s password, given the current one, and signs out its other sessions; '
    + 'this one stays. Clears a temporary password\'s mark. Attempts are limited per address.',
  tags: ['Accounts'],
  requiredRole: 'signedIn',
  allowedWhilePasswordChange: true,
  body: z.strictObject({
    currentPassword: text(MAX_PASSWORD).min(1).meta({ description: 'The current password', examples: ['correct horse battery'] }),
    newPassword: password(),
  }).refine((body) => body.newPassword !== body.currentPassword, {
    path: ['newPassword'],
    message: 'The new password must differ from the current one',
  }).meta({ description: 'The current and the new password, which must differ' }),
  responses: {
    204: { description: 'Changed', schema: z.null(), examples: { changed: { summary: 'Changed', value: null } } },
    400: problem('The current password is incorrect', 'wrong_password', 'The current password is incorrect.', '/api/account/password'),
    429: tooMany('/api/account/password'),
  },
});
