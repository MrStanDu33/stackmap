import { describe, expect, it } from 'vitest';

import reverseProxy from './manifest';

describe('reverse proxy manifest', () => {
  it('declares the route entity on reverse_proxy_route and the reverse-proxy service kind, with every label under extensions.reverse-proxy.', () => {
    expect(reverseProxy.contributes.entities).toEqual([
      { id: 'route', table: 'reverse_proxy_route', label: 'extensions.reverse-proxy.entities.route' },
    ]);
    expect(reverseProxy.contributes.kinds.service).toEqual([
      { id: 'reverse-proxy', label: 'extensions.reverse-proxy.kinds.service.reverse-proxy', icon: 'i-lucide-split' },
    ]);
  });
});

describe('reverse-proxy manifest: onboarding', () => {
  it('asks its onboarding question under extensions.reverse-proxy.onboarding (3)', () => {
    expect(reverseProxy.onboarding).toBe('extensions.reverse-proxy.onboarding');
  });
});
