import { entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { line, text } from './formats';

const admin = { id: '0199d6a0-0000-7000-8000-000000000101', name: 'Ada', email: 'ada@homelab.example', role: 'admin' };
const session = { user: admin };

/** Who is signed in. */
export const Session = z.object({
  user: z.object({
    id: entityId().meta({ description: 'The account\'s id', examples: [admin.id] }),
    name: line(100).meta({ description: 'Its name', examples: [admin.name] }),
    email: z.email().max(254).meta({ description: 'Its email, lower-cased', examples: [admin.email] }),
    role: z.enum(['admin', 'user']).meta({
      description: '`admin` manages the whole instance; `user` only what their workspaces allow',
      examples: [admin.role],
    }),
  }).meta({ description: 'The signed-in account' }),
}).meta({ id: 'Session', description: 'Who is signed in', examples: [session] });

export type Session = z.infer<typeof Session>;

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 128;

export const email = () => z.email().max(254).meta({ description: 'Its email; compared without case', examples: [admin.email] });
export const password = () => text(MAX_PASSWORD).min(MIN_PASSWORD).meta({
  description: `${String(MIN_PASSWORD)} to ${String(MAX_PASSWORD)} characters`,
  examples: ['correct horse battery'],
});

export const problem = (
  description: string,
  code: Parameters<typeof problemOf>[0],
  detail: string,
  instance: string,
) => ({
  description,
  schema: Problem,
  examples: { [code]: { summary: description, value: problemOf(code, { detail, instance }) } },
});
export const tooMany = (instance: string) => problem(
  'Too many attempts from this address; `Retry-After` says when to try again',
  'too_many_requests',
  'Too many attempts. Try again in 42 seconds.',
  instance,
);

export const getSetup = defineContract({
  method: 'get',
  path: '/api/setup',
  operationId: 'getSetup',
  summary: 'Say whether the first administrator can be created',
  description: '`open` while no account exists and the setup window, counted from the server start, has not passed; '
    + '`closed` once it has, until a restart; `done` once an account exists.',
  tags: ['Accounts'],
  requiredRole: 'public',
  responses: {
    200: {
      description: 'The setup state',
      schema: z.object({
        state: z.enum(['open', 'closed', 'done']).meta({ description: 'Whether setup can happen', examples: ['open'] }),
        minutes: z.number().int().min(1).max(1440).meta({
          description: 'How long the window stays open after a start (`SETUP_TIMEOUT_MINUTES`)',
          examples: [15],
        }),
      }).meta({ id: 'SetupState', description: 'The setup state', examples: [{ state: 'open', minutes: 15 }] }),
      examples: {
        open: { summary: 'Fresh instance', value: { state: 'open', minutes: 15 } },
        done: { summary: 'Set up', value: { state: 'done', minutes: 15 } },
      },
    },
  },
});

export const setUp = defineContract({
  method: 'post',
  path: '/api/setup',
  operationId: 'setUp',
  summary: 'Create the first administrator',
  description: 'Creates the instance administrator, signs them in (the session cookie is set) and, when asked, adds '
    + 'the demo workspace. Only once, and only while setup is `open`; of two concurrent requests, one wins.',
  tags: ['Accounts'],
  requiredRole: 'public',
  body: z.object({
    name: line(100).min(1).meta({ description: 'Their name', examples: [admin.name] }),
    email: email(),
    password: password(),
    demo: z.boolean().meta({ description: 'Add the demo workspace', examples: [true] }),
  }).meta({ description: 'The administrator\'s account' }),
  responses: {
    201: { description: 'Created and signed in', schema: Session, examples: { ada: { summary: 'Ada', value: session } } },
    403: problem('The setup window has passed', 'setup_closed', 'Setup is closed. Restart Stackmap to open it again.', '/api/setup'),
    409: problem('An account exists', 'already_set_up', 'Stackmap is already set up.', '/api/setup'),
    429: tooMany('/api/setup'),
  },
});

export const getSession = defineContract({
  method: 'get',
  path: '/api/session',
  operationId: 'getSession',
  summary: 'Say who is signed in',
  description: 'The account of the session cookie, or `null` without a valid one.',
  tags: ['Accounts'],
  requiredRole: 'public',
  responses: {
    200: {
      description: 'The session, or null',
      schema: Session.nullable(),
      examples: {
        signedIn: { summary: 'Signed in', value: session },
        signedOut: { summary: 'Signed out', value: null },
      },
    },
  },
});

export const signIn = defineContract({
  method: 'post',
  path: '/api/session',
  operationId: 'signIn',
  summary: 'Sign in',
  description: 'Checks an email and password and sets the session cookie. A wrong email and a wrong password get '
    + 'the same answer. Attempts are limited per address.',
  tags: ['Accounts'],
  requiredRole: 'public',
  body: z.object({
    email: email(),
    password: text(MAX_PASSWORD).min(1).meta({ description: 'Its password', examples: ['correct horse battery'] }),
  }).meta({ description: 'The credentials' }),
  responses: {
    200: { description: 'Signed in', schema: Session, examples: { ada: { summary: 'Ada', value: session } } },
    401: problem('Wrong email or password', 'invalid_credentials', 'Email or password is incorrect.', '/api/session'),
    429: tooMany('/api/session'),
  },
});

export const signOut = defineContract({
  method: 'delete',
  path: '/api/session',
  operationId: 'signOut',
  summary: 'Sign out',
  description: 'Ends the session on the server and clears its cookie; the answer is the session now: none.',
  tags: ['Accounts'],
  requiredRole: 'signedIn',
  responses: {
    200: { description: 'Signed out', schema: z.null(), examples: { signedOut: { summary: 'Signed out', value: null } } },
  },
});
