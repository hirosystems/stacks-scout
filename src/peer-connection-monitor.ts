import { logger } from './util';
import { StacksPeerMetrics } from './server/prometheus-server';
import { StacksPeer } from './peer-handler';
import { PeerEndpoint } from './peer-endpoint';
import { PeerState, PeerStorage } from './peer-storage';

export class PeerConnectionMonitor {
  readonly knownPeers = new Set<PeerEndpoint>();
  readonly connectedPeers = new Map<PeerEndpoint, StacksPeer>();
  readonly connectionsInProgress = new Map<PeerEndpoint, Promise<StacksPeer>>();

  // TODO: make reconnectInterval configurable
  readonly reconnectInterval = 1000 * 60 * 1; // 1 minute;
  reconnectTimer: NodeJS.Timer | undefined;

  // TODO: make neighborScanInterval configurable
  readonly neighborScanInterval = 1000 * 30; // 30 seconds
  neighborScanTimer: NodeJS.Timer | undefined;

  private static _instance: PeerConnectionMonitor | undefined;
  static get instance(): PeerConnectionMonitor {
    if (this._instance === undefined) {
      this._instance = new PeerConnectionMonitor();
    }
    return this._instance;
  }

  private constructor() {
    // make constructor private to force usage of instance getter
  }

  public loadPeersFromStorage() {
    const storage = PeerStorage.open();
    for (const peer of storage.getPeers()) {
      this.registerPeerEndpoint(peer.endpoint);
    }
  }

  getUnconnectedPeers(): PeerEndpoint[] {
    const peers: PeerEndpoint[] = [];
    for (const peer of this.knownPeers) {
      if (
        !this.connectedPeers.has(peer) &&
        !this.connectionsInProgress.has(peer)
      ) {
        peers.push(peer);
      }
    }
    return peers;
  }

  /**
   * On an interval, check all known peers. Connect to any that are not already
   * connected or in progress.
   */
  public startPeriodicReconnecting() {
    if (this.reconnectTimer !== undefined) {
      return;
    }
    this.reconnectTimer = setInterval(() => {
      const peers = this.getUnconnectedPeers();
      peers.forEach((peer) => {
        this.connectToPeer(peer);
      });
    });
  }

  /**
   * On an interval, check all connected peers. Start a neighbor query for each
   * peer where X seconds have passed since last scan.
   */
  public startPeerNeighborScanning() {
    if (this.neighborScanTimer !== undefined) {
      return;
    }
    this.neighborScanTimer = setInterval(() => {
      this.connectedPeers.forEach((peer, peerEndpoint) => {
        // TODO: check last scan time for peer and skip if too soon
        // skip if peer handshake not completed
        if (!peer.handshakeCompleted) {
          return;
        }
        this.scanPeerNeighbors(peer).catch((error) => {
          logger.error(
            error,
            `Error scanning neighbors for peer: ${peerEndpoint}`
          );
        });
      });
    }, this.neighborScanInterval);
  }

  private async scanPeerNeighbors(peer: StacksPeer) {
    const neighbors = await peer.requestNeighbors();
    logger.info(
      `Received ${neighbors.payload.neighbors.length} neighbors from peer: ${peer.endpoint}`
    );
    neighbors.payload.neighbors.forEach((neighbor) => {
      const endpoint = new PeerEndpoint(
        neighbor.addrbytes.ip_address,
        neighbor.port
      );
      PeerConnectionMonitor.instance.registerPeerEndpoint(endpoint);
    });
  }

  private connectToPeer(peerEndpoint: PeerEndpoint): void {
    const connectionPromise = StacksPeer.connectOutbound(
      peerEndpoint,
      StacksPeerMetrics.instance
    )
      .then((peer) => {
        this.connectedPeers.set(peerEndpoint, peer);
        peer.on('closed', () => {
          this.connectedPeers.delete(peerEndpoint);
        });
        return peer;
      })
      .catch((error) => {
        logger.error(error, `Error connecting to peer: ${peerEndpoint}`);
        throw error;
      })
      .finally(() => {
        this.connectionsInProgress.delete(peerEndpoint);
      });
    this.connectionsInProgress.set(peerEndpoint, connectionPromise);
  }

  private storePeerState(peerEndpoint: PeerEndpoint) {
    const storage = PeerStorage.open();
    let peerState = storage.getPeerState(peerEndpoint);
    if (peerState === undefined) {
      peerState = new PeerState(peerEndpoint);
      peerState.registeredAt = Date.now();
    }
    storage.setPeerState(peerState);
  }

  public registerPeerEndpoint(peerEndpoint: PeerEndpoint) {
    this.knownPeers.add(peerEndpoint);
    if (this.connectedPeers.has(peerEndpoint)) {
      // Already connected to this peer
      return;
    }
    if (this.connectionsInProgress.has(peerEndpoint)) {
      // Already attempting to connect to this peer
      return;
    }
    this.storePeerState(peerEndpoint);
    this.connectToPeer(peerEndpoint);
  }

  public registerConnectedPeer(peer: StacksPeer) {
    if (this.connectedPeers.has(peer.endpoint)) {
      throw new Error(`Already connected to peer: ${peer.endpoint}`);
    }
    this.knownPeers.add(peer.endpoint);
    this.connectedPeers.set(peer.endpoint, peer);
    this.storePeerState(peer.endpoint);
    peer.on('closed', () => {
      this.connectedPeers.delete(peer.endpoint);
    });
  }
}
