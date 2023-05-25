import { PeerConnectionMonitor } from './peer-connection-monitor';
import { StacksPeerMetrics } from './server/prometheus-server';
import { ENV, logger } from './util';

export function setupPeerInfoLogging(
  peerConnections: PeerConnectionMonitor,
  metrics: StacksPeerMetrics
) {
  const peerMap = new Set<string>();

  setInterval(() => {
    for (const peer of peerMap) {
      logger.info({ stacks_node_ip: peer }, `Stacks node peer report`);
    }
  }, ENV.PEER_REPORT_INTERVAL_MS);

  peerConnections.on('peerEndpointDiscovered', (peerEndpoint) => {
    metrics.stacks_scout_discovered_nodes.inc();
    logger.debug(
      { event: 'peerDiscovered', peerEndpoint: peerEndpoint.toString() },
      `Discovered peer endpoint ${peerEndpoint}`
    );
  });

  peerConnections.on('peerDisconnected', (peer) => {
    metrics.stacks_scout_connected_peers.dec();
    logger.debug(
      {
        event: 'peerDisconnected',
        peerEndpoint: peer.endpoint.toString(),
        direction: peer.direction,
      },
      `Peer ${peer.endpoint} disconnected`
    );
  });

  peerConnections.on('peerConnected', (peer) => {
    metrics.stacks_scout_connected_peers.inc();
    logger.debug(
      {
        event: 'peerConnected',
        peerEndpoint: peer.endpoint.toString(),
        direction: peer.direction,
      },
      `Peer ${peer.endpoint} connected`
    );

    peer.on('handshakeAcceptMessageReceived', (message) => {
      if (!peerMap.has(peer.endpoint.ipAddress)) {
        peerMap.add(peer.endpoint.ipAddress);
        const version = Buffer.alloc(4);
        version.writeUInt32BE(message.preamble.peer_version);
        metrics.stacks_scout_version.inc({
          version: `0x${version.toString('hex')}`,
        });
      }
      logger.debug(
        {
          event: 'peerHandshakeAccepted',
          peerEndpoint: peer.endpoint.toString(),
        },
        `Peer ${peer.endpoint} handshake accepted`
      );
    });

    peer.on('handshakeRejectMessageReceived', () => {
      logger.debug(
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
