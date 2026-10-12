import { join } from 'node:path';

import { createConfig, lintFromString, loadConfig } from '@redocly/openapi-core';
import { describe, expect, it } from 'vitest';

import { createOpenApiDocument } from './openapi';

import type { Config } from '@redocly/openapi-core';

const ROOT = join(import.meta.dirname, '../..');

/** The problems Redocly finds in the generated document, as `rule: message (pointer)`. */
const problemsWith = async (config: Config) => (await lintFromString({
  source: JSON.stringify(createOpenApiDocument()),
  absoluteRef: join(ROOT, 'docs/api/openapi.json'),
  config,
})).map(({ ruleId, message, location }) => `${ruleId}: ${message} (${location[0]?.pointer ?? ''})`);

describe('OpenAPI document: validity and lint', () => {
  it('is valid OpenAPI 3.1', async () => {
    expect(await problemsWith(await createConfig({ rules: { struct: 'error', 'no-unresolved-refs': 'error' } })))
      .toEqual([]);
  });

  it('passes the strict lint (redocly.yaml) with no error and no warning', async () => {
    expect(await problemsWith(await loadConfig({ configPath: join(ROOT, 'redocly.yaml') }))).toEqual([]);
  });

  it('has every example valid against its schema', async () => {
    expect(await problemsWith(await createConfig({
      rules: {
        'no-invalid-media-type-examples': { severity: 'error', allowAdditionalProperties: false },
        'no-invalid-schema-examples': { severity: 'error', allowAdditionalProperties: false },
        'no-invalid-parameter-examples': { severity: 'error', allowAdditionalProperties: false },
      },
    }))).toEqual([]);
  });
});
