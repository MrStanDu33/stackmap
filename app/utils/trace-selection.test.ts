import { describe, expect, it } from 'vitest';

import { indexTrace } from './trace-index';
import { parseSelected, selectedParam } from './trace-selection';
import { DEMO_TRACE } from '../../tests/support/demo-trace';
import { DEMO_IDS } from '../../tests/support/demo-traffic';

const { listeners, flows } = DEMO_IDS;
const index = indexTrace(DEMO_TRACE);
const step = `${flows.publicHttps}:client`;

describe('parseSelected', () => {
  it('reads step:<id>, listener:<id> and client when they are in the trace', () => {
    expect(parseSelected(`step:${step}`, index)).toEqual({ type: 'step', id: step });
    expect(parseSelected(`listener:${listeners.website}`, index)).toEqual({ type: 'listener', id: listeners.website });
    expect(parseSelected('client', index)).toEqual({ type: 'client', id: 'client' });
  });

  it('given a value without a colon, gives nothing, even when its end matches an id', () => {
    const [node] = DEMO_TRACE.nodes.filter(({ type }) => type === 'listener');
    // "listenerX" was read as type "listener" and id "listenerX".
    const odd = indexTrace({ ...DEMO_TRACE, nodes: [...DEMO_TRACE.nodes, { ...node, id: 'listenerX' }] } as typeof DEMO_TRACE);

    expect(parseSelected('listenerX', odd)).toBeNull();
  });

  it('given an unknown id, a bad type or garbage, gives nothing', () => {
    for (const raw of ['step:gone', `listener:${step}`, `host:${listeners.website}`, 'step:', ':', '', 'nonsense', undefined, ['client'], 42]) {
      expect(parseSelected(raw, index), String(raw)).toBeNull();
    }
  });
});

describe('selectedParam', () => {
  it('writes a selection as step:<id>, listener:<id> or client, and nothing as undefined', () => {
    expect(selectedParam({ type: 'step', id: step })).toBe(`step:${step}`);
    expect(selectedParam({ type: 'listener', id: listeners.website })).toBe(`listener:${listeners.website}`);
    expect(selectedParam({ type: 'client', id: 'client' })).toBe('client');
    expect(selectedParam(null)).toBeUndefined();
  });
});
