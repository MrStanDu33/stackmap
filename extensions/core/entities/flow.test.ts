import { describe, expect, it } from 'vitest';

import { flowSchema } from './flow';
import { issuePaths } from '../../../tests/support/issues';

const SERVICE_ID = '0199d6a0-0000-7000-8000-000000000001';
const LISTENER_ID = '0199d6a0-0000-7000-8000-000000000002';

const parse = (input: Record<string, unknown>) =>
  flowSchema.input.safeParse({ sourceServiceId: SERVICE_ID, targetListenerId: LISTENER_ID, ...input });

describe('flow schema', () => {
  it('given a source service and a target listener, defaults protocol, purpose and encrypted to null and fills the common fields', () => {
    expect(issuePaths(flowSchema.input.safeParse({}))).toEqual(['sourceServiceId', 'targetListenerId']);
    expect(parse({}).data).toMatchObject({
      sourceServiceId: SERVICE_ID,
      targetListenerId: LISTENER_ID,
      protocol: null,
      purpose: null,
      encrypted: null,
      status: 'active',
      tags: [],
    });
    expect(parse({ protocol: 'postgres', purpose: 'Stores the site content', encrypted: true }).success).toBe(true);
  });

  it('refuses a purpose longer than 200 characters or on several lines', () => {
    expect(issuePaths(parse({ purpose: 'x'.repeat(201) }))).toEqual(['purpose']);
    expect(issuePaths(parse({ purpose: 'Stores\nthe content' }))).toEqual(['purpose']);
    expect(issuePaths(parse({ protocol: 'Not A Kind', encrypted: 'yes' }))).toEqual(['protocol', 'encrypted']);
  });
});
