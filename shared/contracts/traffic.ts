import { entityId, port } from '@stackmap/extension-sdk/entities';
import { FLOW_CLIENTS, MAX_FLOW_HOSTNAMES } from '@stackmap/extension-sdk/server';
import { z } from 'zod';

import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { kebabId, line } from './formats';

export const MAX_TRAFFIC_HOSTS = 500;
export const MAX_TRAFFIC_SERVICES = 1000;
export const MAX_TRAFFIC_LISTENERS = 2000;
export const MAX_TRAFFIC_FLOWS = 5000;
/** Hostnames sent per flow: a wildcard route can serve thousands; `hostnameCount` gives the total. */
export const MAX_TRAFFIC_FLOW_HOSTNAMES = 50;

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** A lowercase DNS name, a wildcard allowed as the first label. */
const HOSTNAME = /^(?=.{1,253}$)(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const host = { id: id(3), name: 'Home server', kind: 'physical' };
const service = { id: id(4), name: 'Nginx Proxy Manager', kind: 'reverse-proxy', hostId: id(3) };
const listener = { id: id(10), serviceId: id(4), port: 443, transport: 'tcp', protocol: 'https', publishedPort: 443 };
const flow = {
  id: id(50),
  origin: 'derived',
  extension: 'nat',
  deriver: 'port-forwards',
  source: { type: 'client', client: 'public' },
  targetListenerId: id(10),
  protocol: null,
  encrypted: null,
  purpose: null,
  hostnames: ['app.homelab.example', 'homelab.example', 'www.homelab.example'],
  hostnameCount: 3,
};

export const TrafficHost = z.object({
  id: entityId().meta({ description: 'Its id', examples: [host.id] }),
  name: line(100).meta({ description: 'Its name', examples: [host.name] }),
  kind: kebabId().meta({ description: 'Its host kind', examples: [host.kind] }),
}).meta({ id: 'TrafficHost', description: 'A host: a box holding its services', examples: [host] });

export const TrafficService = z.object({
  id: entityId().meta({ description: 'Its id', examples: [service.id] }),
  name: line(100).meta({ description: 'Its name', examples: [service.name] }),
  kind: kebabId().meta({ description: 'Its service kind', examples: [service.kind] }),
  hostId: entityId().nullable().meta({ description: 'Its host; null for an external service', examples: [service.hostId] }),
}).meta({ id: 'TrafficService', description: 'A service, with its listeners as ports', examples: [service] });

export const TrafficListener = z.object({
  id: entityId().meta({ description: 'Its id', examples: [listener.id] }),
  serviceId: entityId().meta({ description: 'Its service', examples: [listener.serviceId] }),
  port: port().meta({ description: 'Port it listens on', examples: [listener.port] }),
  transport: kebabId().meta({ description: '`tcp` or `udp`', examples: [listener.transport] }),
  protocol: kebabId().nullable().meta({ description: 'Its protocol kind, when known', examples: [listener.protocol] }),
  publishedPort: port().nullable().meta({ description: 'Port the host publishes it on', examples: [listener.publishedPort] }),
}).meta({ id: 'TrafficListener', description: 'A port a service listens on: where flows end', examples: [listener] });

export const TrafficFlow = z.object({
  id: entityId().meta({ description: 'Its id', examples: [flow.id] }),
  origin: z.enum(['derived', 'manual']).meta({ description: 'Derived from entities, or documented by hand', examples: ['derived'] }),
  extension: kebabId().nullable().meta({ description: 'Extension of its deriver; null for a manual flow', examples: ['nat'] }),
  deriver: kebabId().nullable().meta({ description: 'Its deriver; null for a manual flow', examples: ['port-forwards'] }),
  source: z.discriminatedUnion('type', [
    z.object({
      type: z.enum(['client']).meta({ description: 'Traffic entering from a client', examples: ['client'] }),
      client: z.enum(FLOW_CLIENTS).meta({ description: 'The internet (`public`) or the local network (`internal`)', examples: ['public'] }),
    }),
    z.object({
      type: z.enum(['service']).meta({ description: 'A call a service makes', examples: ['service'] }),
      serviceId: entityId().meta({ description: 'The calling service', examples: [id(5)] }),
    }),
  ]).meta({ description: 'Where it starts', examples: [flow.source] }),
  targetListenerId: entityId().meta({ description: 'The listener it reaches', examples: [flow.targetListenerId] }),
  protocol: kebabId().nullable().meta({ description: 'Its protocol kind, when known', examples: [null] }),
  encrypted: z.boolean().nullable().meta({ description: 'Whether it is encrypted; null when unknown', examples: [null] }),
  purpose: line(200).nullable().meta({ description: 'Why it exists (manual flows)', examples: [null] }),
  hostnames: z.array(z.string().max(253).regex(HOSTNAME)).max(MAX_TRAFFIC_FLOW_HOSTNAMES).meta({
    description: `Names it serves, sorted: the first ${String(MAX_TRAFFIC_FLOW_HOSTNAMES)}`,
    examples: [flow.hostnames],
  }),
  hostnameCount: z.number().int().min(0).max(MAX_FLOW_HOSTNAMES).meta({ description: 'How many names it serves', examples: [3] }),
}).meta({ id: 'TrafficFlow', description: 'A flow from a client or a service to a listener', examples: [flow] });

const traffic = { hosts: [host], services: [service], listeners: [listener], flows: [flow], truncated: false };

export const Traffic = z.object({
  hosts: z.array(TrafficHost).max(MAX_TRAFFIC_HOSTS).meta({ description: 'By name' }),
  services: z.array(TrafficService).max(MAX_TRAFFIC_SERVICES).meta({ description: 'By name' }),
  listeners: z.array(TrafficListener).max(MAX_TRAFFIC_LISTENERS).meta({ description: 'By service, then port' }),
  flows: z.array(TrafficFlow).max(MAX_TRAFFIC_FLOWS).meta({ description: 'Derived ones first, then manual ones' }),
  truncated: z.boolean().meta({
    description: 'A list hit its maximum: the first items are kept, and what refers to a left-out item is left out',
    examples: [false],
  }),
}).meta({ id: 'Traffic', description: 'Every host, service, listener and flow of a workspace', examples: [traffic] });

export type Traffic = z.infer<typeof Traffic>;
export type TrafficFlow = z.infer<typeof TrafficFlow>;

export const getTraffic = defineContract({
  method: 'get',
  path: '/api/workspaces/:workspaceId/traffic',
  operationId: 'getTraffic',
  summary: 'Get the traffic graph',
  description: 'Gives the workspace\'s hosts, services and listeners, and every flow between them: clients entering '
    + 'through DNS, port forwards and proxies, and the calls services make. Computed on each call from the stored '
    + 'flows.',
  tags: ['Traffic'],
  requiredRole: 'viewer',
  params: z.object({
    workspaceId: entityId().meta({ description: 'The workspace', examples: [id(1)] }),
  }),
  responses: {
    200: {
      description: 'The traffic graph; empty lists for an empty workspace',
      schema: Traffic,
      examples: { demo: { summary: 'Through the router to NPM', value: traffic } },
    },
    404: {
      description: 'No such workspace',
      schema: Problem,
      examples: {
        workspace_not_found: {
          summary: 'Unknown workspace',
          value: problemOf('workspace_not_found', {
            detail: `No workspace ${id(1)}.`,
            instance: `/api/workspaces/${id(1)}/traffic`,
          }),
        },
      },
    },
  },
});
