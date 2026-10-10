export type DatabaseConfig = { dialect: 'sqlite'; path: string } | { dialect: 'postgres'; url: string };

export interface DatabaseEnv {
  DATABASE_URL?: string;
  DATA_DIR?: string;
}

/** Reads DATABASE_URL and DATA_DIR. */
export function resolveDatabaseConfig(_env: DatabaseEnv): DatabaseConfig {
  throw new Error('Not implemented');
}
