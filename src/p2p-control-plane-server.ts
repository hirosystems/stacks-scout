import fastify from 'fastify';
import { getBitcoinChainInfo } from './bitcoin-net';
import { getStacksNodeInfo } from './stacks-rpc';
import { ENV, logger } from './util';

// TODO: use custom tcp server rather than http/fastify

export async function startControlPlanServer() {
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
      const btcInfo = await getBitcoinChainInfo();
      const stxInfo = await getStacksNodeInfo();
      return {
        btcInfo,
        stxInfo,
      };
    },
  });

  const addr = await server.listen({
    host: ENV.CONTROL_PLANE_HOST,
    port: ENV.CONTROL_PLANE_PORT,
  });

  logger.info(`Control-plane server running on ${addr}`);
  return server;
}
