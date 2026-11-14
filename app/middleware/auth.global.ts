import { authRedirect } from '~/utils/auth-redirect';

/** Before any page: setup first, then sign-in, then a temporary password to replace; `/` opens the landing page. */
export default defineNuxtRouteMiddleware(async (to) => {
  const { session, setUp, load } = useAccount();
  if (setUp.value === null) {
    await load();
  }
  const target = authRedirect(to.fullPath, {
    setUp: Boolean(setUp.value),
    signedIn: session.value !== null,
    landingPage: session.value?.user.preferences.landingPage,
    mustChangePassword: session.value?.user.mustChangePassword,
  });
  if (target) {
    return navigateTo(target, { replace: true });
  }
});
