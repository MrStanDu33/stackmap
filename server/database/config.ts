import { join } from 'node:path';

export type DatabaseConfig = { dialect: 'sqlite'; path: string } | { dialect: 'postgres'; url: string };

export interface DatabaseEnv {
  DATABASE_URL?: string;
  DATA_DIR?: string;
}

export class DatabaseConfigError extends Error {
  override name = 'DatabaseConfigError';
}

const DEFAULT_DATA_DIR = 'data';
const SQLITE_FILE = 'stackmap.sqlite';
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const ANY_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

const ACCEPTED_FORMS = 'an empty value (SQLite in DATA_DIR), file:<path> or a file path (SQLite), :memory: '
  + '(in-memory SQLite), postgres://… or postgresql://… (Postgres)';

/** The URL with its password masked, safe for logs and errors. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return url.replace(/:[^:@/]+@/, ':****@');
  }
}

/** Reads DATABASE_URL and DATA_DIR: SQLite in DATA_DIR by default, Postgres when the URL points to one. */
export function resolveDatabaseConfig(env: DatabaseEnv): DatabaseConfig {
  const url = env.DATABASE_URL?.trim() ?? '';
  if (url === '') {
    return { dialect: 'sqlite', path: join(env.DATA_DIR?.trim() || DEFAULT_DATA_DIR, SQLITE_FILE) };
  }
  if (POSTGRES_URL.test(url)) {
    return { dialect: 'postgres', url };
  }
  if (url.startsWith('file:')) {
    return { dialect: 'sqlite', path: url.slice('file:'.length) };
  }
  // A file path or :memory:.
  if (!ANY_URL.test(url)) {
    return { dialect: 'sqlite', path: url };
  }
  throw new DatabaseConfigError(`Unsupported DATABASE_URL "${redactUrl(url)}". Use ${ACCEPTED_FORMS}.`);
}
