import fastify from 'fastify';
import { ENV, logger } from '../util';
import { getBtcChainInfo } from '../bitcoin-net';
import { getStacksNodeInfo } from '../stacks-rpc';
import { StacksPeerMetrics } from './prometheus-server';

export async function startDataPlaneServer(metrics: StacksPeerMetrics) {
  const server = fastify({ logger });

  /*
  server.get('/', async (request, reply) => {
    const btcInfo = await getBitcoinChainInfo();
    const stxInfo = await getStacksNodeInfo();
    return {
      btcInfo,
      stxInfo,
    };
  });
  */

  server.route({
    url: '*',
    method: ['GET', 'POST', 'HEAD', 'PUT'],
    handler: async (request, reply) => {
      const btcInfo = await getBtcChainInfo();
      const stxInfo = await getStacksNodeInfo();
      return {
        btcInfo,
        stxInfo,
      };
    },
  });

  const addr = await server.listen({
    host: ENV.DATA_PLANE_HOST,
    port: ENV.DATA_PLANE_PORT,
  });

  logger.info(`Data-plane server running at ${addr}`);
  return server;
}
