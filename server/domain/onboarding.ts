import type { ToggledExtension } from './extension-toggles';

/** Which optional extensions a workspace's onboarding turns on and off, in registry order. */
export function onboardingChange(
  _installed: readonly ToggledExtension[],
  _chosen: readonly string[],
): { enable: string[]; disable: string[] } {
  throw new Error('Not implemented');
}
