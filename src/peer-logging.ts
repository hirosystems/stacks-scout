import { PeerConnectionMonitor } from './peer-connection-monitor';
import { logger } from './util';

// TODO: add more logs and/or prom metrics for various events

export function setupPeerInfoLogging(peerConnections: PeerConnectionMonitor) {
  peerConnections.on('peerEndpointDiscovered', (peerEndpoint) => {
    logger.info(
      { event: 'peerDiscovered', peerEndpoint: peerEndpoint.toString() },
      `Discovered peer endpoint ${peerEndpoint}`
    );
  });

  peerConnections.on('peerDisconnected', (peer) => {
    logger.info(
      {
        event: 'peerDisconnected',
        peerEndpoint: peer.endpoint.toString(),
        direction: peer.direction,
      },
      `Peer ${peer.endpoint} disconnected`
    );
  });

  peerConnections.on('peerConnected', (peer) => {
    logger.info(
      {
        event: 'peerConnected',
        peerEndpoint: peer.endpoint.toString(),
        direction: peer.direction,
      },
      `Peer ${peer.endpoint} connected`
    );

    peer.on('handshakeAcceptMessageReceived', () => {
      logger.info(
        {
          event: 'peerHandshakeAccepted',
          peerEndpoint: peer.endpoint.toString(),
        },
        `Peer ${peer.endpoint} handshake accepted`
      );
    });

    peer.on('handshakeRejectMessageReceived', () => {
      logger.info(
        {
          event: 'peerHandshakeRejected',
          peerEndpoint: peer.endpoint.toString(),
        },
        `Peer ${peer.endpoint} handshake rejected`
      );
    });

    // TODO: a bunch more peer-specific events can be listened and logged here like block messages, etc.
  });
}
