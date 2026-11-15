import { createHost, createListener, createService } from '@stackmap/extension-core/testing';

import type { WorkspaceRepositories } from '../../server/repositories';

/**
 * A router forwarding 203.0.113.10:443 to a web server's listener, which derives one flow, and :8080 to nothing.
 * Answers the router and the forwards.
 */
export async function createPortForwards(repos: WorkspaceRepositories) {
  const router = await createHost(repos, { kind: 'router', addresses: [{ address: '203.0.113.10' }] });
  const server = await createHost(repos, { addresses: [{ address: '10.0.10.20' }] });
  const web = await createService(repos, { hostId: server.id });
  await createListener(repos, { serviceId: web.id, port: 443, transport: 'tcp' });
  const forward = (port: number) => repos.portForwards.create({
    hostId: router.id, externalAddress: '203.0.113.10', externalPort: port, transport: 'tcp',
    internalAddress: '10.0.10.20', internalPort: port,
  });
  return { router, forwards: [await forward(443), await forward(8080)] };
}
