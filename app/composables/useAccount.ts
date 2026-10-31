import type { Session } from '#shared/contracts/auth';

/**
 * Who is signed in and whether Stackmap is set up, shared by the pages and the route middleware; read once per load
 * (on the server during SSR, with the request's cookie), then kept up to date by sign-in, setup and sign-out.
 */
export function useAccount() {
  const session = useState<Session | null>('account.session', () => null);
  const setUp = useState<boolean | null>('account.setUp', () => null);

  const load = async () => {
    const request = useRequestFetch();
    session.value = await request<Session | null>('/api/session');
    setUp.value = session.value ? true : (await request<{ state: string }>('/api/setup')).state === 'done';
  };

  const signedIn = (next: Session) => {
    session.value = next;
    setUp.value = true;
  };

  const signOut = async () => {
    // Signed out on the client whatever the server answers: an expired session is gone already.
    await $fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
    session.value = null;
    await navigateTo('/login', { replace: true });
  };

  return { session, setUp, load, signedIn, signOut };
}
