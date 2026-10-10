import { describe, expect, it } from 'vitest';

import { findComponentsWithoutStories } from './story-coverage.mjs';

describe('story coverage', () => {
  it('accepts components that have a story next to them', () => {
    expect(findComponentsWithoutStories([
      'app/components/atoms/StatusBadge.vue',
      'app/components/atoms/StatusBadge.stories.ts',
    ])).toEqual([]);
  });

  it('reports components without a story', () => {
    expect(findComponentsWithoutStories([
      'app/components/atoms/StatusBadge.vue',
      'app/components/molecules/EntityCard.vue',
      'app/components/molecules/EntityCard.stories.ts',
    ])).toEqual(['app/components/atoms/StatusBadge.vue']);
  });

  it('checks components of extensions too', () => {
    expect(findComponentsWithoutStories(['extensions/vpn/app/components/atoms/VpnBadge.vue']))
      .toEqual(['extensions/vpn/app/components/atoms/VpnBadge.vue']);
  });

  it('ignores Vue files that are not components, such as pages and layouts', () => {
    expect(findComponentsWithoutStories(['app/pages/index.vue', 'app/layouts/default.vue', 'app/app.vue'])).toEqual([]);
  });
});
