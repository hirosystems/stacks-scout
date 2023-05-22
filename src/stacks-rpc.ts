import { ENV } from './util';

export const getStacksNodeRpcUrl = (path: string) =>
  new URL(
    path,
    `http://${ENV.STACKS_NODE_RPC_HOST}:${ENV.STACKS_NODE_RPC_PORT}`
  );

export async function getStacksNodeInfo(): Promise<any> {
  const url = getStacksNodeRpcUrl('/v2/info');
  const res = await fetch(url);
  return await res.json();
}
