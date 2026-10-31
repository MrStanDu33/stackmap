import ELK from 'elkjs/lib/elk.bundled.js';

import { i18n } from './nuxt-shims';
import { elkToVueFlow, trafficToElk } from '../app/utils/traffic-graph';

import type { TrafficLayout } from '../app/utils/traffic-graph';
import type { Traffic } from '../shared/contracts/traffic';

/** Lays out traffic as the app does, with ELK on the main thread: stories need no worker. */
export async function layOut(traffic: Traffic): Promise<TrafficLayout> {
  const laidOut = await new ELK().layout(trafficToElk(traffic));
  return elkToVueFlow(traffic, laidOut, i18n.global.t);
}
