import { entityId, port } from '@stackmap/extension-sdk/entities';
import { FLOW_CLIENTS, MAX_TRACE_HOP_PARAMS, TRACE_STAGES } from '@stackmap/extension-sdk/server';
import { z } from 'zod';

import { defineContract } from './contract';
import { Problem, problemOf } from './errors';
import { i18nKey, kebabId, line, text } from './formats';

export const MAX_TRACE_NODES = 500;
export const MAX_TRACE_STEPS = 1000;
/** Hops on one step: room for many extensions' hops; past it, the last hop counts the ones left out. */
export const MAX_TRACE_STEP_HOPS = 200;
/** How many dependency levels a trace follows below the request's last service. */
export const MAX_TRACE_DEPENDENCY_DEPTH = 8;

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const client = z.enum(FLOW_CLIENTS);
const clientDocs = {
  description: 'Where the request comes from: the internet (`public`) or the local network (`internal`), as DNS views',
  examples: ['public'],
};

/** A lowercase DNS name: labels of letters, digits and inner hyphens, no wildcard. */
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** A node id: `client`, or a listener's id. */
const NODE_ID = /^(?:client|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** A name a client asks for, lowered; at most 253 characters. */
const hostname = () => z.string().max(253).trim().toLowerCase()
  .regex(HOSTNAME, { message: 'Expected a hostname, such as app.homelab.example (no wildcard)' });

export const TraceHop = z.object({
  entity: kebabId().meta({ description: 'The entity the hop describes', examples: ['port-forward'] }),
  id: entityId().meta({ description: 'Its id', examples: [id(30)] }),
  stage: z.enum(TRACE_STAGES).meta({ description: 'Name resolution, network or proxy', examples: ['network'] }),
  label: i18nKey().meta({ description: 'i18n key of its description', examples: ['extensions.nat.trace.forward'] }),
  params: z.record(z.string().max(40).regex(/^[A-Za-z][\w-]*$/), text(200)).meta({
    description: `Values the label interpolates, at most ${String(MAX_TRACE_HOP_PARAMS)}`,
  }),
  port: port().optional().meta({ description: 'The port a client connects to at this hop', examples: [443] }),
}).meta({
  id: 'TraceHop',
  description: 'One entity a step goes through, described by its extension',
  examples: [{
    entity: 'port-forward', id: id(30), stage: 'network', label: 'extensions.nat.trace.forward', port: 443,
    params: { router: 'Edge router', external: '203.0.113.10:443/tcp', internal: '10.0.10.20:443' },
  }],
});

const listenerNode = {
  id: id(10),
  type: 'listener',
  listener: {
    id: id(10),
    port: 443,
    transport: 'tcp',
    protocol: 'https',
    publishedPort: 443,
    serviceId: id(4),
    serviceName: 'Nginx Proxy Manager',
    hostId: id(3),
    hostName: 'Home server',
  },
};

export const TraceNode = z.discriminatedUnion('type', [
  z.object({
    id: z.enum(['client']).meta({ description: 'The client node', examples: ['client'] }),
    type: z.enum(['client']).meta({ description: 'Where the request starts', examples: ['client'] }),
  }),
  z.object({
    id: entityId().meta({ description: 'The listener\'s id', examples: [id(10)] }),
    type: z.enum(['listener']).meta({ description: 'A listener the request or a dependency reaches', examples: ['listener'] }),
    listener: z.object({
      id: entityId().meta({ description: 'Its id', examples: [id(10)] }),
      port: port().meta({ description: 'Port it listens on', examples: [443] }),
      transport: kebabId().meta({ description: '`tcp` or `udp`', examples: ['tcp'] }),
      protocol: kebabId().nullable().meta({ description: 'Its protocol kind, when known', examples: ['https'] }),
      publishedPort: port().nullable().meta({ description: 'Port the host publishes it on', examples: [443] }),
      serviceId: entityId().meta({ description: 'Its service', examples: [id(4)] }),
      serviceName: line(100).meta({ description: 'Its service\'s name', examples: ['Nginx Proxy Manager'] }),
      hostId: entityId().nullable().meta({ description: 'The service\'s host; null for an external service', examples: [id(3)] }),
      hostName: line(100).nullable().meta({ description: 'The host\'s name', examples: ['Home server'] }),
    }).meta({ description: 'The listener, with its service and host' }),
  }),
]).meta({ id: 'TraceNode', description: 'The client, or a listener', examples: [listenerNode] });

const step = {
  id: `${id(50)}:client`,
  source: 'client',
  target: id(10),
  role: 'request',
  depth: 0,
  cycle: false,
  flow: { id: id(50), origin: 'derived', extension: 'nat', deriver: 'port-forwards', protocol: null, encrypted: null, purpose: null },
  hops: [
    {
      entity: 'dns-record', id: id(20), stage: 'dns', label: 'extensions.core.trace.address',
      params: { name: 'app.homelab.example', address: '203.0.113.10', view: 'public' },
    },
    {
      entity: 'port-forward', id: id(30), stage: 'network', label: 'extensions.nat.trace.forward', port: 443,
      params: { router: 'Edge router', external: '203.0.113.10:443/tcp', internal: '10.0.10.20:443' },
    },
  ],
};

export const TraceStep = z.object({
  id: z.string().max(80).regex(/^[0-9a-f-]{36}:(?:client|[0-9a-f-]{36})$/).meta({ description: '`<flow id>:<source node id>`, unique in the trace', examples: [step.id] }),
  source: z.string().max(36).regex(NODE_ID).meta({ description: 'Id of the node it leaves', examples: ['client'] }),
  target: entityId().meta({ description: 'Id of the listener node it reaches', examples: [id(10)] }),
  role: z.enum(['request', 'dependency']).meta({
    description: '`request`: carries the traced hostname; `dependency`: a call the services on the way make',
    examples: ['request'],
  }),
  depth: z.number().int().min(0).max(MAX_TRACE_DEPENDENCY_DEPTH).meta({
    description: 'Dependency level: 0 on the request path',
    examples: [0],
  }),
  cycle: z.boolean().meta({ description: 'It leads back to a listener already on its path, and is not followed', examples: [false] }),
  flow: z.object({
    id: entityId().meta({ description: 'The flow\'s id', examples: [id(50)] }),
    origin: z.enum(['derived', 'manual']).meta({ description: 'Derived from entities, or documented by hand', examples: ['derived'] }),
    extension: kebabId().nullable().meta({ description: 'Extension of its deriver; null for a manual flow', examples: ['nat'] }),
    deriver: kebabId().nullable().meta({ description: 'Its deriver; null for a manual flow', examples: ['port-forwards'] }),
    protocol: kebabId().nullable().meta({ description: 'Its protocol kind, when known', examples: [null] }),
    encrypted: z.boolean().nullable().meta({ description: 'Whether it is encrypted; null when unknown', examples: [null] }),
    purpose: line(200).nullable().meta({ description: 'Why it exists (manual flows)', examples: [null] }),
  }).meta({ description: 'The flow the step follows' }),
  hops: z.array(TraceHop).max(MAX_TRACE_STEP_HOPS).meta({ description: 'What it goes through, DNS first, then network, then proxies' }),
}).meta({ id: 'TraceStep', description: 'A flow the trace follows, from one node to a listener', examples: [step] });

const trace = {
  hostname: 'app.homelab.example',
  port: 443,
  client: 'public',
  truncated: false,
  nodes: [{ id: 'client', type: 'client' }, listenerNode],
  steps: [step],
};

export const Trace = z.object({
  hostname: z.string().max(253).regex(HOSTNAME).meta({ description: 'The traced hostname', examples: ['app.homelab.example'] }),
  port: port().nullable().meta({ description: 'The port it was narrowed to; null for every entry', examples: [443] }),
  client: client.meta(clientDocs),
  truncated: z.boolean().meta({
    description: `The walk stopped at ${String(MAX_TRACE_NODES)} nodes or ${String(MAX_TRACE_STEPS)} steps`,
    examples: [false],
  }),
  nodes: z.array(TraceNode).max(MAX_TRACE_NODES).meta({ description: 'The client first, then listeners in walk order' }),
  steps: z.array(TraceStep).max(MAX_TRACE_STEPS).meta({ description: 'In walk order' }),
}).meta({ id: 'Trace', description: 'The path of a request to a hostname, hop by hop, and its dependencies', examples: [trace] });

export type Trace = z.infer<typeof Trace>;
export type TraceNode = z.infer<typeof TraceNode>;
export type TraceStep = z.infer<typeof TraceStep>;

export const getTrace = defineContract({
  method: 'get',
  path: '/api/workspaces/:workspaceId/trace',
  operationId: 'getTrace',
  summary: 'Trace a hostname',
  description: 'Follows the workspace\'s flows from a client to a hostname: DNS, port forwards and proxies to the app, '
    + 'then the app\'s dependencies. Without `port`, every entry the client can use is shown; with it, only those on '
    + 'that port. Computed on each call from the stored flows.',
  tags: ['Traces'],
  requiredRole: 'viewer',
  params: z.object({
    workspaceId: entityId().meta({ description: 'The workspace', examples: [id(1)] }),
  }),
  query: z.object({
    hostname: hostname().meta({ description: 'The name to trace; upper case is lowered', examples: ['app.homelab.example'] }),
    port: z.coerce.number().pipe(port()).optional().meta({ description: 'Only the entries on this port', examples: [443] }),
    client: client.default('public').meta(clientDocs),
  }),
  responses: {
    200: {
      description: 'The trace; only the client node when nothing reaches the name',
      schema: Trace,
      examples: { forward: { summary: 'Through the router to NPM', value: trace } },
    },
    404: {
      description: 'No such workspace',
      schema: Problem,
      examples: {
        workspace_not_found: {
          summary: 'Unknown workspace',
          value: problemOf('workspace_not_found', {
            detail: `No workspace ${id(1)}.`,
            instance: `/api/workspaces/${id(1)}/trace`,
          }),
        },
      },
    },
  },
});
