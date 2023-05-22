import { ENV } from './util';

const STABLE_BURN_HEIGHT_LAG = 7;

export const getStacksNodeP2pUrl = () =>
  new URL(`http://${ENV.STACKS_NODE_P2P_HOST}:${ENV.STACKS_NODE_P2P_PORT}`);
