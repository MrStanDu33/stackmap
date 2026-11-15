import { describe, expect, it } from 'vitest';

import { ExtensionNotFoundError } from './extension-toggles';
import { onboardingChange } from './onboarding';

import type { ToggledExtension } from './extension-toggles';

const extension = (id: string, dependsOn: string[] = ['core'], alwaysOn = false): ToggledExtension =>
  ({ id, alwaysOn, dependsOn });

// Registry order: dependencies first, then by id.
const core = extension('core', [], true);
const nat = extension('nat');
const proxy = extension('reverse-proxy');
const tls = extension('tls');
const acme = extension('acme', ['core', 'tls']);

describe('onboardingChange', () => {
  it('given NAT chosen, turns NAT on and reverse proxy off (4)', () => {
    expect(onboardingChange([core, nat, proxy], ['nat'])).toEqual({ enable: ['nat'], disable: ['reverse-proxy'] });
  });

  it('given nothing chosen, turns every optional extension off and leaves the core on (5)', () => {
    expect(onboardingChange([core, nat, proxy], [])).toEqual({ enable: [], disable: ['nat', 'reverse-proxy'] });
  });

  it('given an extension chosen whose dependency is optional, turns the dependency on too (6)', () => {
    expect(onboardingChange([core, tls, nat, acme], ['acme'])).toEqual({ enable: ['tls', 'acme'], disable: ['nat'] });
  });

  it('given a chosen id that is not installed, fails with ExtensionNotFoundError (7)', () => {
    expect(() => onboardingChange([core, nat], ['vpn'])).toThrow(ExtensionNotFoundError);
  });

  it('given the core among the chosen ids, accepts it and changes nothing for it (8)', () => {
    expect(onboardingChange([core, nat, proxy], ['core', 'nat'])).toEqual({ enable: ['nat'], disable: ['reverse-proxy'] });
  });
});
