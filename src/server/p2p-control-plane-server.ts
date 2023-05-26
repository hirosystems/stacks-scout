import * as net from 'node:net';
import { StacksPeer, PeerDirection } from '../peer-handler';
import { logger, ENV } from '../util';
import { StacksPeerMetrics } from './prometheus-server';
import { PeerConnectionMonitor } from '../peer-connection-monitor';

export async function startControlPlaneServer() {
  const server = net.createServer();

  server.on('connection', (socket) => {
    handleNewInboundSocket(socket).catch((error) => {
      logger.error(error, 'Error handling new control-plane socket connection');
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.on('error', (err) => {
      logger.error(err, 'Control-plane server listen error');
      reject(err);
    });
    server.listen(
      {
        host: ENV.CONTROL_PLANE_HOST,
        port: ENV.CONTROL_PLANE_PORT,
      },
      () => {
        resolve();
      }
    );
  });

  const addr = server.address();
  if (!addr) {
    throw new Error('Control-plane server address is null or undefined');
  }
  const addrStr =
    typeof addr === 'string' ? addr : `${addr.address}:${addr.port}`;
  logger.info(`Control-plane server running on ${addrStr}`);
  return server;
}

async function handleNewInboundSocket(socket: net.Socket) {
  const socketAddr = `${socket.remoteAddress}:${socket.remotePort}`;
  logger.info(`New control-plane inbound socket connection from ${socketAddr}`);
  const peer = new StacksPeer(socket, PeerDirection.Inbound);
  PeerConnectionMonitor.instance.registerConnectedPeer(peer);
  await peer.performHandshake();
  logger.info(`Handshake accepted from inbound peer ${socketAddr}`);
}
