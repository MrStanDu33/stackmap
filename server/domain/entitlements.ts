/*
 * What a workspace may use. Everything in v1; later driven by a signed offline license key (paid self-host) or a
 * subscription (cloud). Paid features will ship as extensions that ask here first.
 */

/** Whether a workspace may use a feature. */
export function can(_workspace: { id: string }, _feature: string): boolean {
  return true;
}
