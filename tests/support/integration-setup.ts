import { existsSync } from 'node:fs';

import type { TestProject } from 'vitest/node';

import type {} from './provided-context';

/** Vitest global setup of the integration project: decides whether the Postgres runs happen. */
export default function setup(project: TestProject): void {
  if (!process.env.TEST_POSTGRES_URL && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const postgresUrl = process.env.TEST_POSTGRES_URL ?? null;

  if (!postgresUrl && process.env.CI) {
    throw new Error('TEST_POSTGRES_URL is required in CI: the integration tests must run on Postgres too.');
  }
  if (!postgresUrl) {
    console.warn(
      '\n⚠ Postgres integration tests are skipped: TEST_POSTGRES_URL is not set.\n'
      + '  Run `pnpm db:test:up`, then set TEST_POSTGRES_URL in .env (see .env.example).\n',
    );
  }
  project.provide('postgresUrl', postgresUrl);
}
