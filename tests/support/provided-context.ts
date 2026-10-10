// Values the integration project's global setup passes to the tests (see integration-setup.ts).
declare module 'vitest' {
  export interface ProvidedContext {
    /** Postgres used by the integration tests, or null when they only run on SQLite. */
    postgresUrl: string | null;
  }
}

export {};
