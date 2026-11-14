import type { Session } from '#shared/contracts/auth';
import type { Preferences } from '#shared/contracts/preferences';
import type { Display } from '~/utils/preferences-sync';

import { preferencesToApply } from '~/utils/preferences-sync';

type Contrast = Display['contrast'];
const YEAR = 60 * 60 * 24 * 365;

/**
 * The display preferences: applies the account's saved ones (theme, contrast, language, and their cookies, which
 * server rendering reads), reads what the display shows, and saves changes to the account. `status` says how the
 * last save went, for DisplayPreferences to announce. Call it in a setup or plugin, not after an await.
 */
export function usePreferences() {
  const status = useState<'saved' | 'error' | null>('preferences.status', () => null);
  const colorMode = useColorMode();
  const contrastCookie = useCookie<Contrast>('stackmap_contrast', { default: () => 'standard', maxAge: YEAR, sameSite: 'lax' });
  const contrast = useState<Contrast>('stackmap:contrast', () => contrastCookie.value);
  // Color mode's own cookie (nuxt.config.ts): its script reads it before the first paint, so writing it here, during
  // server rendering, gives the page the account's theme from the start.
  const themeCookie = useCookie<string>('nuxt-color-mode', { maxAge: YEAR, sameSite: 'lax' });
  const { $i18n } = useNuxtApp();
  // useAccount's state, read directly: useAccount itself applies preferences through this composable.
  const session = useState<Session | null>('account.session', () => null);

  const apply = async (saved: Preferences) => {
    const { theme, contrast: chosen, locale } = preferencesToApply(saved);
    if (theme) {
      colorMode.preference = theme;
      themeCookie.value = theme;
    }
    if (chosen) {
      contrast.value = chosen;
      contrastCookie.value = chosen;
    }
    if (locale && locale !== $i18n.locale.value) {
      await $i18n.setLocale(locale);
    }
  };

  const display = (): Display => ({
    theme: colorMode.preference === 'light' ? 'light' : 'dark',
    contrast: contrast.value,
    locale: $i18n.locale.value === 'fr' ? 'fr' : 'en',
  });

  /** Saves changes to the signed-in account; signed out, the cookies alone keep them. */
  const save = async (changes: Partial<Preferences>) => {
    if (!session.value) {
      return;
    }
    status.value = null;
    try {
      const saved = await $fetch<Preferences>('/api/account/preferences', { method: 'PUT', body: changes });
      session.value = { user: { ...session.value.user, preferences: saved } };
      status.value = 'saved';
    } catch {
      status.value = 'error';
    }
  };

  return { status, apply, display, save };
}
