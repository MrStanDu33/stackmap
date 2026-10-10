<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { CONTRAST_PAIRS, contrastRatio, MIN_CONTRAST } from '../../shared/design/contrast';

import type { ContrastLevel, ContrastPair } from '../../shared/design/contrast';

const PALETTES = ['nebula', 'midnight'];
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const tokens = ref<Record<string, string>>({});
const level = ref<ContrastLevel>('standard');

// Read the live tokens: the values the browser actually resolves for the current theme and contrast mode.
onMounted(() => {
  const style = getComputedStyle(document.documentElement);
  const names = new Set(CONTRAST_PAIRS.flatMap(({ foreground, background }) => [foreground, background]));
  tokens.value = Object.fromEntries([...names].map((name) => [name, style.getPropertyValue(`--ui-${name}`).trim()]));
  level.value = document.documentElement.dataset.contrast === 'strict' ? 'strict' : 'standard';
});

const measure = ({ foreground, background, kind }: ContrastPair) => {
  const fg = tokens.value[foreground];
  const bg = tokens.value[background];
  const ratio = fg && bg ? contrastRatio(fg, bg) : null;
  const required = MIN_CONTRAST[level.value][kind];
  return { foreground, background, kind, ratio, required, pass: ratio !== null && ratio >= required };
};

const rows = computed(() => (Object.keys(tokens.value).length > 0 ? CONTRAST_PAIRS.map(measure) : []));
</script>

<template>
  <div class="flex flex-col gap-10 text-default">
    <section aria-labelledby="palettes-title">
      <h2
        id="palettes-title"
        class="mb-4 text-xl font-semibold text-highlighted"
      >
        Palettes
      </h2>
      <div
        v-for="palette in PALETTES"
        :key="palette"
        class="mb-4"
      >
        <h3 class="mb-2 font-medium">
          {{ palette }}
        </h3>
        <ul class="grid grid-cols-11 gap-2">
          <li
            v-for="shade in SHADES"
            :key="shade"
            class="flex flex-col gap-1 text-xs"
          >
            <span
              class="h-10 rounded-md border border-default"
              :style="{ background: `var(--color-${palette}-${shade})` }"
            />
            <span>{{ shade }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section aria-labelledby="contrast-title">
      <h2
        id="contrast-title"
        class="mb-4 text-xl font-semibold text-highlighted"
      >
        Contrast of semantic tokens
      </h2>
      <table class="w-full border-collapse text-sm">
        <caption class="mb-2 text-left text-muted">
          Requirements for the {{ level }} level: text {{ MIN_CONTRAST[level].text }}:1,
          UI elements {{ MIN_CONTRAST[level].ui }}:1.
        </caption>
        <thead>
          <tr class="border-b border-default text-left">
            <th scope="col">
              Foreground
            </th>
            <th scope="col">
              Background
            </th>
            <th scope="col">
              Sample
            </th>
            <th scope="col">
              Ratio
            </th>
            <th scope="col">
              Required
            </th>
            <th scope="col">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="`${row.foreground}/${row.background}`"
            data-testid="contrast-row"
            :data-result="row.pass ? 'pass' : 'fail'"
            class="border-b border-muted"
          >
            <td><code>--ui-{{ row.foreground }}</code></td>
            <td><code>--ui-{{ row.background }}</code></td>
            <td>
              <span
                v-if="row.kind === 'text'"
                class="inline-block rounded px-2 py-1"
                :style="{ color: `var(--ui-${row.foreground})`, background: `var(--ui-${row.background})` }"
              >Aa</span>
              <span
                v-else
                class="inline-block size-6 rounded border-2"
                :style="{ borderColor: `var(--ui-${row.foreground})`, background: `var(--ui-${row.background})` }"
                aria-hidden="true"
              />
            </td>
            <td>{{ row.ratio === null ? 'missing' : `${row.ratio.toFixed(2)}:1` }}</td>
            <td>{{ row.required }}:1</td>
            <td>{{ row.pass ? 'Pass' : 'Fail' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
