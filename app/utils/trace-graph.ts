import { indexTrace, stepName } from './trace-index';
import { SIZES } from './traffic-graph';
import { portLabel } from './traffic-index';

import type { TrafficLayout, Translate } from './traffic-graph';
import type { Trace, TraceNode } from '../../shared/contracts/traces';
import type { Edge, Node } from '@vue-flow/core';
import type { ElkNode } from 'elkjs/lib/elk-api';

type Listener = Extract<TraceNode, { type: 'listener' }>['listener'];

/** A listener node: its service, its port and protocol, and where it runs (px, as TraceGraph.vue draws it). */
export const LISTENER_HEIGHT = 72;

const nodeId = (id: string) => (id === 'client' ? 'client' : `listener:${id}`);

const listenerWidth = ({ serviceName }: Listener) => Math.min(
  SIZES.service.maxWidth,
  Math.max(SIZES.service.minWidth, serviceName.length * SIZES.character + 4 * SIZES.service.padding),
);

/** `443/tcp https`, as the node shows it. */
export const listenerPort = (listener: Listener) => [portLabel(listener), listener.protocol].filter(Boolean).join(' ');

/** The trace as an ELK graph: the client and each listener as nodes, each step as an edge. */
export function traceToElk(trace: Trace): ElkNode {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '32',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children: trace.nodes.map((node) => (node.type === 'client'
      ? { id: 'client', ...SIZES.client }
      : { id: nodeId(node.id), width: listenerWidth(node.listener), height: LISTENER_HEIGHT })),
    edges: trace.steps.map((step) => ({
      id: `step:${step.id}`, sources: [nodeId(step.source)], targets: [nodeId(step.target)],
    })),
  };
}

/** The laid-out trace as Vue Flow nodes and edges, each with its accessible name. */
export function traceElkToVueFlow(trace: Trace, laidOut: ElkNode, t: Translate): TrafficLayout {
  const index = indexTrace(trace);
  const placed = new Map((laidOut.children ?? []).map((child) => [child.id, child]));
  const box = (id: string) => {
    const { x = 0, y = 0, width = 0, height = 0 } = placed.get(id) ?? {};
    return { position: { x, y }, width, height };
  };

  const nodes = trace.nodes.map((node): Node => {
    if (node.type === 'client') {
      return {
        id: 'client', type: 'client', ...box('client'), ariaLabel: t(`traffic.client.${trace.client}`),
        domAttributes: { role: 'button', 'aria-roledescription': t('traffic.role.client') },
        data: { client: trace.client },
      };
    }
    const { listener } = node;
    // Where it runs, as the node writes it: the accessible name starts with the visible text (WCAG 2.5.3).
    const where = listener.hostName === null ? t('trace.external') : t('trace.onHost', { host: listener.hostName });
    return {
      id: nodeId(node.id), type: 'listener', ...box(nodeId(node.id)),
      ariaLabel: t('trace.listener', { service: listener.serviceName, port: listenerPort(listener), where }),
      domAttributes: { role: 'button', 'aria-roledescription': t('trace.role.listener') },
      data: { listener, where },
    };
  });

  const edges = trace.steps.map((step): Edge => {
    let kind = 'request';
    if (step.cycle) {
      kind = 'cycle';
    } else if (step.role === 'dependency') {
      kind = 'dependency';
    }
    return {
      id: `step:${step.id}`,
      source: nodeId(step.source),
      target: nodeId(step.target),
      type: 'smoothstep',
      ariaLabel: stepName(index, trace, step, t),
      domAttributes: { 'aria-roledescription': t('trace.role.step') },
      data: { step, kind },
    };
  });

  return { nodes, edges };
}
