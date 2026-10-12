import type { Listener, ListenerInput, ListenerPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type ListenerRepository = ScopedRepository<Listener, ListenerInput, ListenerPatch, { serviceId?: string }>;
