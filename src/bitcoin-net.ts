import { ENV, logger, timeout } from './util';

function getDefaultBtcEndpoint(): string {
  return `http://${ENV.BITCOIND_HOST}:${ENV.BITCOIND_PORT}`;
}

export async function getBitcoinChainInfo(
  hostname = getDefaultBtcEndpoint()
): Promise<{
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
}> {
  const url = new URL('/rest/chaininfo.json', hostname);
  const res = await fetch(url);
  return await res.json();
}

// TODO: function to get info for stable block

export async function waitForBtcRestResponsive(
  hostname = getDefaultBtcEndpoint(),
  abort?: AbortSignal,
  retryInternalMs = 500
): Promise<void> {
  while (!abort?.throwIfAborted() ?? true) {
    try {
      await getBitcoinChainInfo(hostname);
      logger.info(`Bitcoin REST is responsive at '${hostname}'`);
      return;
    } catch (_error) {
      logger.info(`Waiting for responsive Bitcoin REST at '${hostname}' ..`);
      await timeout(retryInternalMs, abort);
    }
  }
}
