import { authRedirect } from '~/utils/auth-redirect';

/** Before any page: setup first, then sign-in; signed-in visitors skip both. */
export default defineNuxtRouteMiddleware(async (to) => {
  const { session, setUp, load } = useAccount();
  if (setUp.value === null) {
    await load();
  }
  const target = authRedirect(to.fullPath, { setUp: Boolean(setUp.value), signedIn: session.value !== null });
  if (target) {
    return navigateTo(target, { replace: true });
  }
});
