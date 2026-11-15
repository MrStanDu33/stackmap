import ELK from 'elkjs/lib/elk.bundled.js';

import { i18n } from './nuxt-shims';
import { extensionLabels } from '../app/utils/extension-labels';
import { traceElkToVueFlow, traceToElk } from '../app/utils/trace-graph';
import { elkToVueFlow, trafficToElk } from '../app/utils/traffic-graph';
import { INSTALLED_EXTENSIONS } from '../tests/support/extensions';

import type { TrafficLayout } from '../app/utils/traffic-graph';
import type { Trace } from '../shared/contracts/traces';
import type { Traffic } from '../shared/contracts/traffic';

/**
 * Lays out traffic as the app does, with ELK on the main thread: stories need no worker. Loaders run before the
 * decorator applies the story's locale, so it is applied here: node names are in the language of the text they show.
 */
export async function layOut(traffic: Traffic, locale?: unknown): Promise<TrafficLayout> {
  if (locale === 'en' || locale === 'fr') {
    i18n.global.locale.value = locale;
  }
  const laidOut = await new ELK().layout(trafficToElk(traffic));
  // With the extensions' labels, as the page gives them: kinds and protocols in the language they show in.
  const labels = extensionLabels(INSTALLED_EXTENSIONS, (key, params) => i18n.global.t(key, params ?? {}));
  return elkToVueFlow(traffic, laidOut, i18n.global.t, labels);
}

/** Lays out a trace as the app does, in the story's locale (see layOut). */
export async function layOutTrace(trace: Trace, locale?: unknown): Promise<TrafficLayout> {
  if (locale === 'en' || locale === 'fr') {
    i18n.global.locale.value = locale;
  }
  const laidOut = await new ELK().layout(traceToElk(trace));
  return traceElkToVueFlow(trace, laidOut, i18n.global.t);
}
