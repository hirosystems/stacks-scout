import { PeerConnectionMonitor } from './peer-connection-monitor';
import { StacksPeerMetrics } from './server/prometheus-server';
import { ENV, logger } from './util';

type PeerIpAddress = string;

interface PeerInfo {
  peer_version: string;
  network_id: string;
  burn_block_height: bigint;
  port: number;
}

function u32HexString(peer_version: number): string {
  const version = Buffer.alloc(4);
  version.writeUInt32BE(peer_version);
  return `0x${version.toString('hex')}`;
}

export function setupPeerInfoLogging(
  peerConnections: PeerConnectionMonitor,
  metrics: StacksPeerMetrics
) {
  const peerMap = new Map<PeerIpAddress, PeerInfo>();

  setInterval(() => {
    for (const [ip, values] of peerMap) {
      logger.info(
        { stacks_node_ip: ip, info: values },
        `Stacks node peer report`
      );
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
    peerMap.delete(peer.endpoint.ipAddress);
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
        peerMap.set(peer.endpoint.ipAddress, {
          peer_version: u32HexString(message.preamble.peer_version),
          network_id: u32HexString(message.preamble.network_id),
          burn_block_height: message.preamble.burn_block_height,
          port: peer.endpoint.port,
        });
        metrics.stacks_scout_version.inc({
          version: u32HexString(message.preamble.peer_version),
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
