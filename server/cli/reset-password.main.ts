import { resetPassword } from './reset-password';
import { prepareDatabase } from '../database/startup';

/*
 * The bundled command's entry (.output/cli/reset-password.mjs): the same database as the server, from the same
 * environment, migrated if needed. Its behaviour is tested in reset-password.integration.test.ts; this is the glue.
 */
const quiet = { info: () => undefined };
const db = await prepareDatabase({ DATABASE_URL: process.env.DATABASE_URL, DATA_DIR: process.env.DATA_DIR }, quiet);
try {
  process.exitCode = await resetPassword(process.argv.slice(2), {
    db,
    out: (line) => {
      console.log(line);
    },
    err: (line) => {
      console.error(line);
    },
  });
} finally {
  await db.destroy();
}
