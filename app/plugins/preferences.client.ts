import { preferencesToSave } from '~/utils/preferences-sync';

/**
 * Signed in, a change to the display (the sidebar's switches, or /settings) is saved to the account, once the page
 * is mounted: the account's own values, applied while loading, are not saved back.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { session } = useAccount();
  const preferences = usePreferences();
  nuxtApp.hook('app:mounted', () => {
    watch(preferences.display, async (display) => {
      const changes = session.value && preferencesToSave(session.value.user.preferences, display);
      if (changes) {
        await preferences.save(changes);
      }
    });
  });
});
