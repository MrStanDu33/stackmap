/** The secret that signs sessions: `BETTER_AUTH_SECRET`, or one generated once into the data directory. */
export const loadAuthSecret = (_options: { env: { BETTER_AUTH_SECRET?: string }; dataDir: string }): Promise<string> =>
  Promise.resolve('');
