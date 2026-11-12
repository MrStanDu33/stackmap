import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { email, password, problem } from './auth';
import { defineContract } from './contract';
import { problemOf } from './errors';
import { line } from './formats';
import { timestamp } from './workspaces';

import type { ProblemCode } from './errors';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ada = { id: id(101), name: 'Ada', email: 'ada@homelab.example', role: 'admin', createdAt: '2026-10-31T09:00:00.000Z' };
const grace = { id: id(102), name: 'Grace', email: 'grace@homelab.example', role: 'user', createdAt: '2026-11-01T09:00:00.000Z' };

/** Most accounts the users page lists. `shortcut:` no paging; add it when an instance needs more. */
export const MAX_USERS = 500;

const role = () => z.enum(['admin', 'user']).meta({
  description: '`admin` manages the whole instance; `user` only what their workspaces allow',
  examples: ['user'],
});

export const UserAccount = z.object({
  id: entityId().meta({ description: 'The account\'s id', examples: [grace.id] }),
  name: line(100).meta({ description: 'Its name', examples: [grace.name] }),
  email: email(),
  role: role(),
  createdAt: timestamp().meta({ description: 'When it was created', examples: [grace.createdAt] }),
}).meta({ id: 'UserAccount', description: 'An account of the instance', examples: [grace] });

export type UserAccount = z.infer<typeof UserAccount>;

const userParams = z.object({
  userId: entityId().meta({ description: 'The account\'s id', examples: [grace.id] }),
});

const USER_PATH = `/api/users/${grace.id}`;

/** A response for one status that several problem codes share, each with its example. */
const problems = (description: string, instance: string, codes: Partial<Record<ProblemCode, string>>) => ({
  ...problem(description, ...(Object.entries(codes)[0] as [ProblemCode, string]), instance),
  examples: Object.fromEntries(Object.entries(codes).map(([code, detail]) => [
    code,
    { summary: detail, value: problemOf(code as ProblemCode, { detail, instance }) },
  ])),
});

const notFound = (instance: string) => problem(
  'No account has this id',
  'user_not_found',
  'No account with this id.',
  instance,
);

export const listUsers = defineContract({
  method: 'get',
  path: '/api/users',
  operationId: 'listUsers',
  summary: 'List the accounts',
  description: 'Every account of the instance by name, with its instance role.',
  tags: ['Accounts'],
  requiredRole: 'instanceAdmin',
  responses: {
    200: {
      description: 'The accounts',
      schema: z.object({
        users: z.array(UserAccount).max(MAX_USERS).meta({ description: 'By name' }),
      }).meta({ id: 'UserList', description: 'Accounts', examples: [{ users: [ada, grace] }] }),
      examples: { two: { summary: 'Two accounts', value: { users: [ada, grace] } } },
    },
  },
});

export const createUser = defineContract({
  method: 'post',
  path: '/api/users',
  operationId: 'createUser',
  summary: 'Create an account',
  description: 'A plain user with no workspace, signed in with the temporary password the administrator chose. '
    + 'The administrator stays signed in as themselves.',
  tags: ['Accounts'],
  requiredRole: 'instanceAdmin',
  body: z.strictObject({
    name: line(100).min(1).meta({ description: 'Its name', examples: [grace.name] }),
    email: email(),
    password: password(),
  }).meta({ description: 'The new account' }),
  responses: {
    201: { description: 'Created', schema: UserAccount, examples: { grace: { summary: 'Grace', value: grace } } },
    409: problem('An account already uses this email', 'email_taken', 'An account already uses this email.', '/api/users'),
  },
});

export const updateUser = defineContract({
  method: 'patch',
  path: '/api/users/:userId',
  operationId: 'updateUser',
  summary: 'Change an account\'s instance role',
  description: 'Promotes to or demotes from instance administrator, on the account\'s next request. The instance '
    + 'keeps at least one administrator, and administrators cannot demote themselves.',
  tags: ['Accounts'],
  requiredRole: 'instanceAdmin',
  params: userParams,
  body: z.strictObject({ role: role() }).meta({ description: 'The new instance role' }),
  responses: {
    200: { description: 'The account, with the new role', schema: UserAccount, examples: { promoted: { summary: 'Now an administrator', value: { ...grace, role: 'admin' } } } },
    404: notFound(USER_PATH),
    409: problems('The change would leave the instance without an administrator, or demote the caller', USER_PATH, {
      last_admin: 'Stackmap needs at least one administrator.',
      cannot_demote_self: 'Administrators cannot demote themselves.',
    }),
  },
});

export const setUserPassword = defineContract({
  method: 'put',
  path: '/api/users/:userId/password',
  operationId: 'setUserPassword',
  summary: 'Give an account a new temporary password',
  description: 'Replaces the account\'s password and signs it out everywhere. Not for the caller\'s own account.',
  tags: ['Accounts'],
  requiredRole: 'instanceAdmin',
  params: userParams,
  body: z.strictObject({ password: password() }).meta({ description: 'The new temporary password' }),
  responses: {
    204: { description: 'Replaced, and the account signed out', schema: z.null(), examples: { done: { summary: 'Replaced', value: null } } },
    404: notFound(`${USER_PATH}/password`),
    409: problem(
      'Administrators change their own password elsewhere',
      'cannot_reset_self',
      'Administrators cannot give themselves a temporary password.',
      `${USER_PATH}/password`,
    ),
  },
});

export const removeUser = defineContract({
  method: 'delete',
  path: '/api/users/:userId',
  operationId: 'removeUser',
  summary: 'Remove an account',
  description: 'Removes the account with its sessions and memberships. Not the caller\'s own account, nor the only '
    + 'owner of a workspace.',
  tags: ['Accounts'],
  requiredRole: 'instanceAdmin',
  params: userParams,
  responses: {
    204: { description: 'Removed', schema: z.null(), examples: { removed: { summary: 'Removed', value: null } } },
    404: notFound(USER_PATH),
    409: problems('The account is the caller\'s, or the only owner of a workspace', USER_PATH, {
      cannot_remove_self: 'Administrators cannot remove their own account.',
      last_owner: 'Grace is the only owner of Home lab. Add another owner first.',
    }),
  },
});
