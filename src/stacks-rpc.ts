import { request } from 'undici';
import { ENV, logger, timeout } from './util';

function getDefaultStacksNodeRpcEndpoint(): string {
  return `http://${ENV.STACKS_NODE_RPC_HOST}:${ENV.STACKS_NODE_RPC_PORT}`;
}

export function getStacksNodeRpcUrl(
  path: string,
  hostname = getDefaultStacksNodeRpcEndpoint()
): URL {
  return new URL(path, hostname);
}

export async function getStacksNodeInfo(
  hostname = getDefaultStacksNodeRpcEndpoint()
): Promise<any> {
  const url = getStacksNodeRpcUrl('/v2/info', hostname);
  const res = await request(url, { throwOnError: true });
  return await res.body.json();
}

export async function waitForRpcResponsive(
  hostname = getDefaultStacksNodeRpcEndpoint(),
  abort?: AbortSignal,
  retryInternalMs = 500
): Promise<void> {
  while (!abort?.throwIfAborted() ?? true) {
    try {
      await getStacksNodeInfo(hostname);
      logger.info(`Stacks node RPC is responsive at '${hostname}'`);
      return;
    } catch (_error) {
      logger.info(`Waiting for responsive Stacks node RPC at '${hostname}' ..`);
      await timeout(retryInternalMs, abort);
    }
  }
}
