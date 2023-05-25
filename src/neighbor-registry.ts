import { logger } from './util';
import { StacksPeerMetrics } from './server/prometheus-server';
import { StacksPeer, PeerEndpoint, peerConnections } from './peer-handler';

// TODO: store neighbor addresses in memory registery object, and monitor/retry connection to them

export async function startPeerNeighborScan(
  peer: StacksPeer,
  metrics: StacksPeerMetrics
) {
  const neighbors = await peer.requestNeighbors();
  logger.info(
    `Received ${neighbors.payload.neighbors.length} neighbors from peer: ${peer.address}`
  );
  neighbors.payload.neighbors.forEach((neighbor) => {
    setImmediate(() => {
      const peerEndpoint = new PeerEndpoint(
        neighbor.addrbytes.ip_address,
        neighbor.port
      );
      // TODO: this has a race-condition where we could connect to the same peer twice
      // if we receive multiple neighbor messages from the same peer at the same time
      // before they connect and are added to the peerConnections map.
      if (peerConnections.hasPeer(peerEndpoint)) {
        // Already connected to this peer
        return;
      }
      StacksPeer.connectOutbound(peerEndpoint, metrics).catch((error) => {
        logger.error(error, `Error connecting to peer: ${peerEndpoint}`);
      });
    });
  });
}
