import type { ScopedRepository } from './entity-repository';
import type { Listener, ListenerInput, ListenerPatch } from '../../shared/entities';

export type ListenerRepository = ScopedRepository<Listener, ListenerInput, ListenerPatch, { serviceId?: string }>;
