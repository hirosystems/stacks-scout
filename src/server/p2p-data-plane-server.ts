import fastify from 'fastify';
import { ENV, logger } from '../util';
import { getStacksNodeInfo } from '../stacks-rpc';
import { StacksPeerMetrics } from './prometheus-server';
import { PeerConnectionMonitor } from '../peer-connection-monitor';

export async function startDataPlaneServer(metrics: StacksPeerMetrics) {
  const server = fastify({ logger });

  server.route({
    url: '*',
    method: ['GET', 'POST', 'HEAD', 'PUT'],
    handler: async (request, reply) => {
      return reply.redirect('/status');
    },
  });

  server.get('/status', async (request, reply) => {
    const connectionsInProgress = [
      ...PeerConnectionMonitor.instance.connectionsInProgress.keys(),
    ].map((k) => k.toString());
    const connectedPeers = [
      ...PeerConnectionMonitor.instance.connectedPeers,
    ].map(([_, p]) => {
      return {
        endpoint: p.endpoint.toString(),
        reported_endpoint: p.reportedEndpoint?.toString() ?? null,
        public_key: p.publicKey ?? null,
        direction: p.direction,
        last_seen: new Date(p.lastSeen).toISOString(),
        last_seen_seconds_ago: Math.round((Date.now() - p.lastSeen) / 1000),
      };
    });
    const knownPeers = [...PeerConnectionMonitor.instance.knownPeers].map((p) =>
      p.toString()
    );
    const replyJson = JSON.stringify(
      {
        status: 'ok',
        connectedPeers,
        connectionsInProgress,
        knownPeers,
      },
      null,
      2
    );
    reply.type('application/json').send(replyJson);
  });

  const addr = await server.listen({
    host: ENV.DATA_PLANE_HOST,
    port: ENV.DATA_PLANE_PORT,
  });

  logger.info(`Data-plane server running at ${addr}`);
  return server;
}
