import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

export interface CommandIo {
  db: Kysely<Database>;
  out: (line: string) => void;
  err: (line: string) => void;
}

/** `reset-password <email>`: answers the exit code. */
export function resetPassword(_args: readonly string[], _io: CommandIo): Promise<number> {
  throw new Error('Not implemented');
}
