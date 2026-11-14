import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { resetPassword } from './reset-password';
import { useTestAccounts } from '../../tests/support/accounts';
import { DIALECTS } from '../../tests/support/databases';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('reset-password on %s', (dialect: Dialect) => {
  const accounts = useTestAccounts(dialect);

  /** Runs the command and answers its exit code and what it printed. */
  const run = async (...args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await resetPassword(args, {
      db: accounts.db(),
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };
  const passwordIn = (output: string) => /: (\S{20})$/m.exec(output)?.[1];

  it('given an email in any case, prints a random 20-character temporary password once and exits with 0 (14)', async () => {
    await accounts.signedIn();

    const first = await run('ADA@HomeLab.example');
    const second = await run('ada@homelab.example');

    expect(first.code).toBe(0);
    expect(passwordIn(first.out)).toMatch(/^[\w-]{20}$/);
    expect(passwordIn(second.out)).not.toBe(passwordIn(first.out));
    expect(first.out.split(passwordIn(first.out) ?? '').length).toBe(2);
  });

  it('the printed password works, the account\'s sessions are gone and it is marked for a change (14)', async () => {
    const cookie = await accounts.signedIn();

    const { out } = await run('ada@homelab.example');

    expect((await accounts.call('GET', '/api/session', { cookie })).json).toBeNull();
    const fresh = await accounts.signInAs('ada@homelab.example', passwordIn(out));
    expect((await accounts.call('GET', '/api/session', { cookie: fresh })).json).toMatchObject({ user: { mustChangePassword: true } });
  });

  it('given an unknown email, prints "No account with this email." and exits with 1 (15)', async () => {
    await accounts.signedIn();

    expect(await run('nobody@homelab.example')).toMatchObject({ code: 1, err: 'No account with this email.' });
  });

  it('without an argument, prints its usage and exits with 2; with --help, exits with 0 (15)', async () => {
    const missing = await run();
    const help = await run('--help');

    expect(missing.code).toBe(2);
    expect(missing.err).toContain('Usage: reset-password <email>');
    expect(help.code).toBe(0);
    expect(help.out).toContain('Usage: reset-password <email>');
  });

  it('given an account with no password to reset, says so and exits with 1 (15, review)', async () => {
    await accounts.signedIn();
    await sql`delete from ${sql.table('account')}`.execute(accounts.db());

    expect(await run('ada@homelab.example')).toMatchObject({ code: 1, err: 'This account has no password to reset.' });
  });
});
