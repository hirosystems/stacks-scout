import * as net from 'node:net';
import * as dns from 'node:dns/promises';
import { PeerEndpoint } from './peer-endpoint';
import { ENV } from './util';

export async function getDefaultStacksNodePeerAddress() {
  let hostIP = ENV.STACKS_NODE_P2P_HOST;
  const isIP = net.isIP(hostIP) !== 0;
  if (!isIP) {
    const res = await dns.resolve4(hostIP);
    hostIP = res[0];
  }
  return new PeerEndpoint(hostIP, ENV.STACKS_NODE_P2P_PORT);
}
