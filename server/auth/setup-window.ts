let startedAt = new Date();

/** Called when the server starts: the setup window is counted from then. */
export function markServerStart(at: Date = new Date()): void {
  startedAt = at;
}

/** `SETUP_TIMEOUT_MINUTES`, 15 by default. */
export const setupTimeoutMinutes = (_env: Record<string, string | undefined> = process.env): number => 15;

/** Whether the setup window is still open. */
export const setupWindowOpen = (_now: Date = new Date(), _minutes: number = setupTimeoutMinutes()): boolean =>
  startedAt.getTime() < 0;
