import * as net from 'node:net';
import * as dns from 'node:dns/promises';
import { PeerEndpoint } from './peer-endpoint';
import { ENV } from './util';

export async function getBootstrapPeers() {
  const endpoints = new Set<PeerEndpoint>();
  const entries: string[] = [
    `${ENV.STACKS_NODE_P2P_HOST}:${ENV.STACKS_NODE_P2P_PORT}`,
  ];

  if (ENV.STACKS_NODE_P2P_BOOTSTRAPS) {
    entries.push(...ENV.STACKS_NODE_P2P_BOOTSTRAPS.split(','));
  }

  for (const entry of entries) {
    const [host, port] = entry.split(':');
    let hostIP = host;
    const isIP = net.isIP(hostIP) !== 0;
    if (!isIP) {
      const res = await dns.resolve4(hostIP);
      hostIP = res[0];
    }
    endpoints.add(new PeerEndpoint(hostIP, parseInt(port)));
  }

  return [...endpoints];
}
