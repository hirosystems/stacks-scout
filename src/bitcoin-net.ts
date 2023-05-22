import { request } from 'undici';
import { ENV, logger, timeout } from './util';

// See Bitcoin Core REST API reference: https://github.com/bitcoin/bitcoin/blob/master/doc/REST-interface.md

function getDefaultBtcEndpoint(): string {
  return `http://${ENV.BITCOIND_HOST}:${ENV.BITCOIND_PORT}`;
}

export async function getBtcChainInfo(
  hostname = getDefaultBtcEndpoint()
): Promise<{
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
}> {
  const url = new URL('/rest/chaininfo.json', hostname);
  const res = await request(url, { throwOnError: true });
  return await res.body.json();
}

export async function getBtcBlockHashByHeight(
  height: number,
  hostname = getDefaultBtcEndpoint()
): Promise<string> {
  const url = new URL(`/rest/blockhashbyheight/${height}.json`, hostname);
  const res = await request(url, { throwOnError: true });
  const json: { blockhash: string } = await res.body.json();
  return json.blockhash;
}

export async function getBtcBlockByHash(
  hash: string,
  hostname = getDefaultBtcEndpoint()
): Promise<BitcoinBlock> {
  const url = new URL(`/rest/block/${hash}.json`, hostname);
  const res = await request(url, { throwOnError: true });
  return await res.body.json();
}

export async function getBtcBlockByHeight(
  height: number,
  hostname = getDefaultBtcEndpoint()
): Promise<BitcoinBlock> {
  const hash = await getBtcBlockHashByHeight(height, hostname);
  return await getBtcBlockByHash(hash, hostname);
}

export async function waitForBtcRestResponsive(
  hostname = getDefaultBtcEndpoint(),
  abort?: AbortSignal,
  retryInternalMs = 500
): Promise<void> {
  while (!abort?.throwIfAborted() ?? true) {
    try {
      await getBtcChainInfo(hostname);
      logger.info(`Bitcoin REST is responsive at '${hostname}'`);
      return;
    } catch (_error) {
      logger.info(`Waiting for responsive Bitcoin REST at '${hostname}' ..`);
      await timeout(retryInternalMs, abort);
    }
  }
}

export interface BitcoinBlock {
  hash: string;
  confirmations: number;
  strippedsize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  tx: any[];
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  nTx: number;
  previousblockhash: string;
  nextblockhash: string;
}
