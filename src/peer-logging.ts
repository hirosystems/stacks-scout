import { StacksMessageEnvelope } from './message/stacks-message-envelope';
import { PeerConnectionMonitor } from './peer-connection-monitor';
import { StacksPeer } from './peer-handler';
import { StacksPeerMetrics } from './server/prometheus-server';
import { ENV, logger } from './util';
import { LRUCache } from 'lru-cache';

type PeerId = string;

interface PeerInfo {
  ip_address: string;
  peer_version: string;
  network_id: string;
  burn_block_height: bigint;
  port: number;
  public_key?: string;
  reported_endpoint?: string;
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
  /** Block hash -> timestamp LRU cache for the first time a block was seen. */
  const blockTimestampCache = new LRUCache<string, number>({
    max: 20,
  });
  /** Microblock hash -> timestamp LRU cache for the first time a block was seen. */
  const microblockTimestampCache = new LRUCache<string, number>({
    max: 40,
  });
  /** Transaction hash -> timestamp LRU cache for the first time a block was seen. */
  const transactionTimestampCache = new LRUCache<string, number>({
    max: 500,
  });
  const peerMap = new Map<PeerId, PeerInfo>();

  // Stacks peer reporting
  setInterval(() => {
    for (const [id, values] of peerMap) {
      logger.info(
        { stacks_node_ip: values.ip_address, info: values },
        `Stacks node peer report`
      );
    }
  }, ENV.PEER_REPORT_INTERVAL_MS);

  const observePeer = (peer: StacksPeer, message: StacksMessageEnvelope) => {
    const peerId = `${peer.endpoint.ipAddress}_${peer.publicKey ?? ''}`;
    if (!peerMap.has(peerId)) {
      peerMap.set(peerId, {
        ip_address: peer.endpoint.ipAddress,
        peer_version: u32HexString(message.preamble.peer_version),
        network_id: u32HexString(message.preamble.network_id),
        burn_block_height: message.preamble.burn_block_height,
        port: peer.endpoint.port,
        public_key: peer.publicKey,
        reported_endpoint: peer.reportedEndpoint?.toString() ?? '',
      });
      metrics.stacks_scout_version.inc({
        version: u32HexString(message.preamble.peer_version),
      });
    }
  };

  const observeBlock = (hash: string) => {
    const firstSeenAt = blockTimestampCache.get(hash);
    if (firstSeenAt) {
      const latency = Date.now() - firstSeenAt;
      metrics.stacks_scout_block_propagation_rate_bucket.observe(latency);
    } else {
      blockTimestampCache.set(hash, Date.now());
    }
  };

  const observeMicroblock = (hash: string) => {
    const firstSeenAt = microblockTimestampCache.get(hash);
    if (firstSeenAt) {
      const latency = Date.now() - firstSeenAt;
      metrics.stacks_scout_microblock_propagation_rate_bucket.observe(latency);
    } else {
      microblockTimestampCache.set(hash, Date.now());
    }
  };

  const observeTransaction = (hash: string) => {
    const firstSeenAt = transactionTimestampCache.get(hash);
    if (firstSeenAt) {
      const latency = Date.now() - firstSeenAt;
      metrics.stacks_scout_mempool_propagation_rate_bucket.observe(latency);
    } else {
      transactionTimestampCache.set(hash, Date.now());
    }
  };

  peerConnections.on('peerEndpointDiscovered', (peerEndpoint) => {
    metrics.stacks_scout_discovered_nodes.inc();
    logger.debug(
      { event: 'peerDiscovered', peerEndpoint: peerEndpoint.toString() },
      `Discovered peer endpoint ${peerEndpoint}`
    );
  });

  peerConnections.on('peerDisconnected', (peer) => {
    metrics.stacks_scout_connected_peers.dec({ direction: peer.direction });
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
    metrics.stacks_scout_connected_peers.inc({ direction: peer.direction });
    logger.debug(
      {
        event: 'peerConnected',
        peerEndpoint: peer.endpoint.toString(),
        direction: peer.direction,
      },
      `Peer ${peer.endpoint} connected`
    );

    peer.on('handshakeCompleted', (message) => {
      observePeer(peer, message);
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

    peer.on('blocksAvailableMessageReceived', (message) => {
      for (const block of message.payload.available) {
        observeBlock(block.consensus_hash.hash);
      }
    });

    peer.on('microblocksAvailableMessageReceived', (message) => {
      for (const microblock of message.payload.available) {
        observeMicroblock(microblock.consensus_hash.hash);
      }
    });

    peer.on('transactionMessageReceived', (message) => {
      observeTransaction(message.payload.transaction.txid);
    });

    peer.on('messageResponseDurationMeasured', (messageType, durationMs) => {
      // TODO: what to log?
      logger.info(
        { peer: peer.endpoint.toString(), messageType, durationMs },
        `Peer took ${durationMs}ms to respond to ${messageType}`
      );
    });
  });
}
