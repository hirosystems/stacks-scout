import { PeerAddress } from './peer-handler';
import { ENV } from './util';

const STABLE_BURN_HEIGHT_LAG = 7;

export function getDefaultStacksNodePeerAddress() {
  return new PeerAddress(ENV.STACKS_NODE_P2P_HOST, ENV.STACKS_NODE_P2P_PORT);
}
