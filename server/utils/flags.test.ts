import { describe, expect, it } from 'vitest';

import { isOn } from './flags';

describe('isOn', () => {
  it('is on for true, 1, yes or on, in any case and with spaces around', () => {
    for (const value of ['true', '1', 'yes', 'on', ' TRUE ', 'Yes']) {
      expect(isOn(value), value).toBe(true);
    }
  });

  it('is off for anything else, empty or unset', () => {
    for (const value of [undefined, '', 'false', '0', 'no', 'off', 'maybe']) {
      expect(isOn(value), String(value)).toBe(false);
    }
  });
});
