import type { TraceWorkspace } from './traces';
import type { Traffic } from '../../shared/contracts/traffic';

/** The traffic graph of a workspace, from its entities and stored flows; each table is read once. */
export function readTraffic(_workspace: TraceWorkspace): Promise<Traffic> {
  return Promise.reject(new Error('Not implemented'));
}
