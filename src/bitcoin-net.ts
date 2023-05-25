import { request } from 'undici';
import { ENV, logger, timeout } from './util';

interface LatestBlockInfo {
  hash: string;
  height: number;
  stableHeight: number;
  stableHash: string;
}

interface BitcoinNet {
  getLatestBlock(stableConfirmations: number): Promise<LatestBlockInfo>;
}

// See Bitcoin Core REST API reference: https://github.com/bitcoin/bitcoin/blob/master/doc/REST-interface.md
export class RegtestBitcoinNet implements BitcoinNet {
  static readonly instance = new RegtestBitcoinNet();
  async getLatestBlock(stableConfirmations: number): Promise<LatestBlockInfo> {
    const btcChainInfo = await this.getBtcChainInfo();
    const height = btcChainInfo.blocks;
    const hash = btcChainInfo.bestblockhash;
    const stableHeight = height - stableConfirmations;
    const stableHash = await this.getBtcBlockHashByHeight(stableHeight);
    return {
      hash,
      height,
      stableHash,
      stableHeight,
    };
  }
  getDefaultBtcEndpoint(): string {
    return `http://${ENV.BITCOIND_HOST}:${ENV.BITCOIND_PORT}`;
  }
  async getBtcChainInfo(hostname = this.getDefaultBtcEndpoint()): Promise<{
    chain: string;
    blocks: number;
    headers: number;
    bestblockhash: string;
  }> {
    const url = new URL('/rest/chaininfo.json', hostname);
    const res = await request(url, { throwOnError: true });
    return await res.body.json();
  }
  async getBtcBlockHashByHeight(
    height: number,
    hostname = this.getDefaultBtcEndpoint()
  ): Promise<string> {
    const url = new URL(`/rest/blockhashbyheight/${height}.json`, hostname);
    const res = await request(url, { throwOnError: true });
    const json: { blockhash: string } = await res.body.json();
    return json.blockhash;
  }
  async getBtcBlockByHash(
    hash: string,
    hostname = this.getDefaultBtcEndpoint()
  ): Promise<BitcoindRestBlock> {
    const url = new URL(`/rest/block/${hash}.json`, hostname);
    const res = await request(url, { throwOnError: true });
    return await res.body.json();
  }
  async getBtcBlockByHeight(
    height: number,
    hostname = this.getDefaultBtcEndpoint()
  ): Promise<BitcoindRestBlock> {
    const hash = await this.getBtcBlockHashByHeight(height, hostname);
    return await this.getBtcBlockByHash(hash, hostname);
  }
  async waitForBtcRestResponsive(
    hostname = this.getDefaultBtcEndpoint(),
    abort?: AbortSignal,
    retryInternalMs = 500
  ): Promise<void> {
    while (!abort?.throwIfAborted() ?? true) {
      try {
        await this.getBtcChainInfo(hostname);
        logger.info(`Bitcoin REST is responsive at '${hostname}'`);
        return;
      } catch (_error) {
        logger.info(`Waiting for responsive Bitcoin REST at '${hostname}' ..`);
        await timeout(retryInternalMs, abort);
      }
    }
  }
}

export class MempoolSpaceBitcoinNet implements BitcoinNet {
  static readonly mainnet = new MempoolSpaceBitcoinNet('mainnet');
  static readonly testnet = new MempoolSpaceBitcoinNet('testnet');

  readonly networkName: 'mainnet' | 'testnet';

  readonly cacheBlockInfoSeconds = 60;
  _lastBlockInfo: Promise<LatestBlockInfo> | undefined;
  _lastBlockInfoFetchTime = 0;

  constructor(network: 'mainnet' | 'testnet') {
    this.networkName = network;
  }

  get mempoolApiUrl() {
    switch (this.networkName) {
      case 'mainnet':
        return 'https://mempool.space/api/v1';
      case 'testnet':
        return 'https://mempool.space/testnet/api/v1';
      default:
        throw new Error(`Unexpected network name ${this.networkName}`);
    }
  }

  async getLatestBlock(stableConfirmations: number): Promise<LatestBlockInfo> {
    if (
      this._lastBlockInfo !== undefined &&
      this._lastBlockInfoFetchTime >
        Date.now() - this.cacheBlockInfoSeconds * 1000
    ) {
      return await this._lastBlockInfo;
    }
    const getInfo = async () => {
      const blocksUrl = this.mempoolApiUrl + '/blocks';
      const req = await request(blocksUrl, {
        maxRedirections: 5,
        throwOnError: true,
      });
      const json: MempoolSpaceBlock[] = await req.body.json();
      const latestBlock = json[0];
      const stableBlock = json[stableConfirmations];
      return {
        hash: latestBlock.id,
        height: latestBlock.height,
        stableHash: stableBlock.id,
        stableHeight: stableBlock.height,
      };
    };
    this._lastBlockInfoFetchTime = Date.now();
    this._lastBlockInfo = getInfo().catch((error) => {
      this._lastBlockInfo = undefined;
      logger.error(
        error,
        `Failed to get latest block info from mempool.space: ${error}`
      );
      throw error;
    });
    return await this._lastBlockInfo;
  }
}

interface BitcoindRestBlock {
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

interface MempoolSpaceBlock {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  bits: number;
  nonce: number;
  difficulty: number;
  merkle_root: string;
  tx_count: number;
  size: number;
  weight: number;
  previousblockhash: string;
  mediantime: number;
  extras: any;
}

export const BitcoinNetInstance = (() => {
  switch (ENV.STACKS_NETWORK_NAME) {
    case 'regtest':
      return RegtestBitcoinNet.instance;
    case 'testnet':
      return MempoolSpaceBitcoinNet.testnet;
    case 'mainnet':
      return MempoolSpaceBitcoinNet.mainnet;
    default:
      throw new Error(
        `Unexpected STACKS_NETWORK_NAME ${ENV.STACKS_NETWORK_NAME}`
      );
  }
})();
