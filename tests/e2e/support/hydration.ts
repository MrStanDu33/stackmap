import type { Page } from '@playwright/test';

/**
 * Waits until Vue has taken over the server-rendered page. Before that a form is plain HTML: filled and submitted, it
 * reloads the page instead of running the app's code.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__));
}
