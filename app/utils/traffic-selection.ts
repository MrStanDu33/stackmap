import type { Traffic } from '../../shared/contracts/traffic';

/** What is selected in the Traffic view: a client (`public` or `internal`), a host, a service, a port or a flow. */
export interface Selection {
  type: 'client' | 'host' | 'service' | 'listener' | 'flow';
  id: string;
}

/** The flows to highlight for a selection: those in or out of it, or the flow itself. */
export function relatedFlowIds(_traffic: Traffic, _selection: Selection): Set<string> {
  throw new Error('Not implemented');
}
