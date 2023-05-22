import { ENV } from './util';

export const getBitcoinRestUrl = (path: string) =>
  new URL(path, `http://${ENV.BITCOIND_HOST}:${ENV.BITCOIND_PORT}`);

export async function getBitcoinChainInfo(): Promise<{
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
}> {
  const url = getBitcoinRestUrl('/rest/chaininfo.json');
  const res = await fetch(url);
  return await res.json();
}
