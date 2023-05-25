import { EventEmitter, captureRejectionSymbol } from 'node:events';
import { ENV, logger } from './util';
import { StacksPeerMetrics } from './server/prometheus-server';
import { StacksPeer } from './peer-handler';
import { PeerEndpoint } from './peer-endpoint';
import { PeerState, PeerStorage } from './peer-storage';

interface PeerConnectionMonitorEvents {
  peerEndpointDiscovered(peerEndpoint: PeerEndpoint): void | Promise<void>;
  peerConnected(peer: StacksPeer): void | Promise<void>;
  peerDisconnected(peer: StacksPeer): void | Promise<void>;
}

export class PeerConnectionMonitor {
  readonly knownPeers = new Set<PeerEndpoint>();
  readonly connectedPeers = new Map<PeerEndpoint, StacksPeer>();
  readonly connectionsInProgress = new Map<PeerEndpoint, Promise<StacksPeer>>();

  private reconnectTimer: NodeJS.Timer | undefined;
  private neighborScanTimer: NodeJS.Timer | undefined;

  private readonly eventEmitter = new EventEmitter({ captureRejections: true });

  private static _instance: PeerConnectionMonitor | undefined;
  static get instance(): PeerConnectionMonitor {
    if (this._instance === undefined) {
      this._instance = new PeerConnectionMonitor();
    }
    return this._instance;
  }

  private constructor() {
    Object.assign(this.eventEmitter, {
      [captureRejectionSymbol]: (error: any, event: string, ...args: any[]) => {
        logger.error(
          error,
          `Unhandled rejection for peer-connection-monitor event ${event}`
        );
      },
    });
  }

  on<T extends keyof PeerConnectionMonitorEvents>(
    eventName: T,
    listener: PeerConnectionMonitorEvents[T]
  ) {
    this.eventEmitter.on(eventName, listener);
  }

  once<T extends keyof PeerConnectionMonitorEvents>(
    eventName: T,
    listener: PeerConnectionMonitorEvents[T]
  ) {
    this.eventEmitter.once(eventName, listener);
  }

  emit<T extends keyof PeerConnectionMonitorEvents>(
    eventName: T,
    ...args: Parameters<PeerConnectionMonitorEvents[T]>
  ) {
    this.eventEmitter.emit(eventName, ...args);
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
    }, ENV.PEER_RECONNECT_INTERVAL_MS);
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
    }, ENV.PEER_NEIGHBOR_SCAN_INTERVAL_MS);
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
          this.emit('peerDisconnected', peer);
        });
        this.emit('peerConnected', peer);
        peer.performHandshake().catch((error) => {
          logger.error(error, `Handshake failed with peer: ${peer.endpoint}`);
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
    if (!this.knownPeers.has(peerEndpoint)) {
      this.knownPeers.add(peerEndpoint);
      this.emit('peerEndpointDiscovered', peerEndpoint);
    }
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
    if (!this.knownPeers.has(peer.endpoint)) {
      this.knownPeers.add(peer.endpoint);
      this.emit('peerEndpointDiscovered', peer.endpoint);
    }
    this.connectedPeers.set(peer.endpoint, peer);
    this.storePeerState(peer.endpoint);
    peer.on('closed', () => {
      this.connectedPeers.delete(peer.endpoint);
      this.emit('peerDisconnected', peer);
    });
    this.emit('peerConnected', peer);
  }
}
