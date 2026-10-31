/**
 * Applies the RGAA strict contrast to `<html>` from its cookie, during SSR so the page never flashes, and follows the
 * display preferences' changes. Saved per user from phase 4.
 */
export default defineNuxtPlugin(() => {
  const cookie = useCookie<string | undefined>('stackmap_contrast');
  const contrast = useState<'standard' | 'strict'>('stackmap:contrast', () =>
    (cookie.value === 'strict' ? 'strict' : 'standard'));
  useHead({ htmlAttrs: { 'data-contrast': () => (contrast.value === 'strict' ? 'strict' : undefined) } });
});
