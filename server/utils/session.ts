import type { Session } from '../../shared/contracts/auth';
import type { H3Event } from 'h3';

/** Reads who is signed in from a request: by default the session cookie, through Better Auth. */
export type SessionResolver = (event: H3Event) => Promise<Session | null>;

let resolver: SessionResolver = () => Promise.resolve(null);

/** For tests: who requests are made as. */
export function setSessionResolver(next: SessionResolver): void {
  resolver = next;
}

export const getRequestSession = (event: H3Event): Promise<Session | null> => resolver(event);
