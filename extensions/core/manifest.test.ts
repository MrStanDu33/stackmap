import { describe, expect, it } from 'vitest';

import core from './manifest';

const ids = (entity: keyof typeof core.contributes.kinds) => core.contributes.kinds[entity]?.map(({ id }) => id);

describe('core extension', () => {
  it('contributes the core host, network, service and protocol kinds', () => {
    expect(ids('host')).toEqual(['physical', 'vm', 'vps', 'router']);
    expect(ids('network')).toEqual(['lan', 'dmz', 'public']);
    expect(ids('service')).toEqual(['app', 'database', 'cache', 'dns', 'external-api', 'other']);
    expect(ids('protocol')).toEqual(['tcp', 'udp', 'http', 'https', 'ssh', 'ftp', 'sftp']);
  });
});
