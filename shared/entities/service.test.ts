import { describe, expect, it } from 'vitest';

import { serviceSchema } from './service';
import { issuePaths } from '../../tests/support/issues';

const parse = (input: Record<string, unknown>) => serviceSchema.input.safeParse({ name: 'Website', kind: 'app', ...input });

describe('service schema', () => {
  it('requires a name and a kind; hostId, image and containerName are nullable', () => {
    expect(parse({}).data).toMatchObject({ name: 'Website', kind: 'app', hostId: null, image: null, containerName: null });
    expect(issuePaths(serviceSchema.input.safeParse({}))).toEqual(['name', 'kind']);
  });

  it('bounds the image to 300 characters and the container name to 100', () => {
    expect(parse({ image: 'i'.repeat(300), containerName: 'c'.repeat(100) }).success).toBe(true);
    expect(issuePaths(parse({ image: 'i'.repeat(301), containerName: 'c'.repeat(101) }))).toEqual(['image', 'containerName']);
  });
});
