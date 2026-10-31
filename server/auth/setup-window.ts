const DEFAULT_MINUTES = 15;
const MAX_MINUTES = 1440;

let startedAt = new Date();

/** Called when the server starts: the setup window is counted from then. */
export function markServerStart(at: Date = new Date()): void {
  startedAt = at;
}

/** `SETUP_TIMEOUT_MINUTES` (1 to 1440), 15 when unset or invalid. */
export function setupTimeoutMinutes(env: Record<string, string | undefined> = process.env): number {
  const minutes = Number(env.SETUP_TIMEOUT_MINUTES);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_MINUTES ? minutes : DEFAULT_MINUTES;
}

/** Whether the setup window, counted from the server start, is still open. */
export const setupWindowOpen = (now: Date = new Date(), minutes: number = setupTimeoutMinutes()): boolean =>
  now.getTime() - startedAt.getTime() < minutes * 60_000;
