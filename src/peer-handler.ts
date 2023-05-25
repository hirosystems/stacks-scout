import * as net from 'node:net';
import { EventEmitter, captureRejectionSymbol } from 'node:events';
import { ENV, INT, WeakDictionary, logger } from './util';
import { PeerAddress } from './message/peer-address';
import { RelayDataVec } from './message/relay-data';
import { MessageSignature } from './message/message-signature';
import { BurnchainHeaderHash } from './message/burnchain-header-hash';
import { StacksMessageEnvelope } from './message/stacks-message-envelope';
import { ResizableByteStream } from './resizable-byte-stream';
import { Handshake } from './message/handshake';
import { Preamble } from './message/preamble';
import { randomBytes } from 'node:crypto';
import * as secp256k1 from 'secp256k1';
import { getBtcBlockHashByHeight, getBtcChainInfo } from './bitcoin-net';
import { StacksPeerMetrics } from './server/prometheus-server';
import { HandshakeData } from './message/handshake-data';
import { GetNeighbors } from './message/get-neighbors';
import {
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
  StacksMessageContainerType,
} from './stacks-p2p-deser';
import { HandshakeAccept } from './message/handshake-accept';
import { Neighbors } from './message/neighbors';
import { Ping } from './message/ping';
import { Pong } from './message/pong';

// From src/core/mod.rs

// peer version (big-endian)
// first byte == major network protocol version (currently 0x18)
// second and third bytes are unused
// fourth byte == highest epoch supported by this node
const PEER_VERSION_MAINNET_MAJOR = 0x18000000;
const PEER_VERSION_TESTNET_MAJOR = 0xfacade00;

const PEER_VERSION_EPOCH_1_0 = 0x00;
const PEER_VERSION_EPOCH_2_0 = 0x00;
const PEER_VERSION_EPOCH_2_05 = 0x05;
const PEER_VERSION_EPOCH_2_1 = 0x06;
const PEER_VERSION_EPOCH_2_2 = 0x07;
const PEER_VERSION_EPOCH_2_3 = 0x08;
const PEER_VERSION_EPOCH_2_4 = 0x09;

// this should be updated to the latest network epoch version supported by this node
// const PEER_NETWORK_EPOCH = PEER_VERSION_EPOCH_2_4;

// set the fourth byte of the peer version
const PEER_VERSION_MAINNET =
  PEER_VERSION_MAINNET_MAJOR | PEER_VERSION_EPOCH_2_3;
const PEER_VERSION_TESTNET =
  PEER_VERSION_TESTNET_MAJOR | PEER_VERSION_EPOCH_2_4;
const PEER_VERSION_REGTEST =
  PEER_VERSION_TESTNET_MAJOR | PEER_VERSION_EPOCH_2_4;

const NETWORK_ID_MAINNET = 0x00000001;
const NETWORK_ID_TESTNET = 0x80000000;

const STABLE_CONFIRMATIONS_MAINNET = 7;
const STABLE_CONFIRMATIONS_TESTNET = 7;
const STABLE_CONFIRMATIONS_REGTEST = 1;

export enum PeerDirection {
  Inbound,
  Outbound,
}

export const peerConnections = new (class PeerConnections {
  readonly peers = new Set<StacksPeer>();
  register(peer: StacksPeer) {
    this.peers.add(peer);
    peer.on('closed', () => {
      this.peers.delete(peer);
    });
  }
  inboundCount() {
    return this.getInbound().length;
  }
  outboundCount() {
    return this.getOutbound().length;
  }
  getInbound(): StacksPeer[] {
    return [...this.peers].filter(
      (peer) => peer.direction === PeerDirection.Inbound
    );
  }
  getOutbound(): StacksPeer[] {
    return [...this.peers].filter(
      (peer) => peer.direction === PeerDirection.Outbound
    );
  }
})();

interface StacksPeerEvents {
  closed: (error?: Error) => void | Promise<void>;
  socketError: (error: Error) => void | Promise<void>;
  open: () => void | Promise<void>;
  messageReceived: (message: StacksMessageEnvelope) => void | Promise<void>;
  pingMessageReceived: (
    message: StacksMessageEnvelope<Ping>
  ) => void | Promise<void>;
}

export class StacksPeer extends EventEmitter {
  readonly socket: net.Socket;
  readonly direction: PeerDirection;
  readonly address: PeerEndpoint;
  /** This peer's private key */
  readonly privKey: Buffer;
  /** This peer's public key */
  readonly pubKey: Buffer;
  readonly metrics: StacksPeerMetrics;
  /** epoch in milliseconds, zero for never */
  lastSeen = 0;

  lastMessageSeqNumber = 0;

  constructor(
    socket: net.Socket,
    direction: PeerDirection,
    metrics: StacksPeerMetrics
  ) {
    super({ captureRejections: true });
    this.direction = direction;
    this.address = new PeerEndpoint(
      socket.remoteAddress as string,
      socket.remotePort as number
    );
    this.metrics = metrics;
    do {
      // TODO: use a persistent key for this (stacks-scout) peer rather than this per-peer key
      // probably set via env var
      this.privKey = randomBytes(32);
    } while (!secp256k1.privateKeyVerify(this.privKey));
    this.pubKey = Buffer.from(secp256k1.publicKeyCreate(this.privKey));
    this.socket = socket;
    this.setupSocketEvents();
    this.setupPongResponder();
    peerConnections.register(this);
  }

  [captureRejectionSymbol](error: any, event: string, ...args: any[]) {
    logger.error(error, `Unhandled rejection for event ${event}`);
  }

  on<T extends keyof StacksPeerEvents>(
    eventName: T,
    listener: StacksPeerEvents[T]
  ): this {
    return super.on(eventName, listener);
  }

  once<T extends keyof StacksPeerEvents>(
    eventName: T,
    listener: StacksPeerEvents[T]
  ): this {
    return super.once(eventName, listener);
  }

  emit<T extends keyof StacksPeerEvents>(
    eventName: T,
    ...args: Parameters<StacksPeerEvents[T]>
  ): boolean {
    return super.emit(eventName, ...args);
  }

  private setupSocketEvents() {
    this.createSocketDataReader();
    this.socket.on('error', (err) => {
      logger.error(err, 'Error on peer socket');
      this.emit('socketError', err);
    });
    this.socket.on('close', (hadError) => {
      if (hadError) {
        logger.error(`Peer closed connection with error: ${this.address}`);
      } else {
        logger.info(`Peer closed connection: ${this.address}`);
      }
      this.emit('closed');
    });
  }

  private setupPongResponder() {
    this.on('pingMessageReceived', async (message) => {
      const pong = new Pong(message.payload.nonce);
      const envelope = await this.createAndSignEnvelope(pong);
      await this.send(envelope);
    });
  }

  private createSocketDataReader() {
    // the left over data from the last received chunk
    let lastChunk = Buffer.alloc(0);

    const handleRecvData = (data: Buffer) => {
      // Read in chunks to get first the preamble (fixed size),
      // then get the payload size from the preamble and read that.
      // Then write any extra bytes into a new byte stream.
      const buff =
        lastChunk.length === 0 ? data : Buffer.concat([lastChunk, data]);

      if (buff.length < Preamble.BYTE_SIZE) {
        // not enough data yet to read a message, save the chunk and wait for more
        lastChunk = buff;
        return;
      }

      const payloadLength = Preamble.readPayloadLength(buff);
      if (buff.length < payloadLength + Preamble.BYTE_SIZE) {
        // not enough data yet to read a message, save the chunk and wait for more
        lastChunk = buff;
        return;
      }

      // we have enough data to read a message, decode into a StacksMessageEnvelope
      const byteStream = new ResizableByteStream();
      byteStream.writeBytes(buff);
      byteStream.seek(0);
      const receivedMsg = StacksMessageEnvelope.decode(byteStream);

      if (buff.length > byteStream.position) {
        // extra data left over after reading the message, save it for next time
        lastChunk = byteStream.readBytesAsBuffer(
          byteStream.byteLength - byteStream.position
        );
      } else {
        // no extra data left over
        lastChunk = Buffer.alloc(0);
      }

      logger.debug(
        receivedMsg,
        `received ${receivedMsg.payload.constructor.name} message from ${this.address}`
      );
      this.emit('messageReceived', receivedMsg);

      if (
        receivedMsg.payload.containerType === StacksMessageContainerTypeID.Ping
      ) {
        this.emit(
          'pingMessageReceived',
          receivedMsg as StacksMessageEnvelope<Ping>
        );
      }
      // EXAMPLE metric manipulation
      // this.metrics.stacks_scout_discovered_nodes.inc();

      if (lastChunk.length > 0) {
        // if there's more data, recursively handle it
        handleRecvData(Buffer.alloc(0));
      }
    };

    this.socket.on('data', (data) => {
      handleRecvData(data);
    });
  }

  async waitForMessage(predicate: (msg: StacksMessageEnvelope) => boolean) {
    return new Promise<StacksMessageEnvelope>((resolve) => {
      const listener = (msg: StacksMessageEnvelope) => {
        if (predicate(msg)) {
          this.removeListener('messageReceived', listener);
          resolve(msg);
        }
      };
      this.on('messageReceived', listener);
    });
  }

  private getNextSeqNumber(): number {
    // increment (wrapping if necessary) the sequence number
    const seqNum = this.lastMessageSeqNumber++;
    if (seqNum >= INT.MAX_U32) {
      this.lastMessageSeqNumber = 0;
    }
    return seqNum;
  }

  async createAndSignEnvelope(
    message: StacksMessageContainerType
  ): Promise<StacksMessageEnvelope> {
    const seqNum = this.getNextSeqNumber();
    let peerVersion: number;
    let networkID: number;
    let stableConfirmations: number;

    switch (ENV.STACKS_NETWORK_NAME) {
      case 'mainnet':
        peerVersion = PEER_VERSION_MAINNET;
        networkID = NETWORK_ID_MAINNET;
        stableConfirmations = STABLE_CONFIRMATIONS_MAINNET;
        break;
      case 'testnet':
        peerVersion = PEER_VERSION_TESTNET;
        networkID = NETWORK_ID_TESTNET;
        stableConfirmations = STABLE_CONFIRMATIONS_TESTNET;
        break;
      case 'regtest':
        peerVersion = PEER_VERSION_REGTEST;
        networkID = NETWORK_ID_TESTNET;
        stableConfirmations = STABLE_CONFIRMATIONS_REGTEST;
        break;
    }

    const btcChainInfo = await getBtcChainInfo();
    const btcStableBurnHeight = btcChainInfo.blocks - stableConfirmations;
    const latestBtcBlockHash = await getBtcBlockHashByHeight(
      btcChainInfo.blocks
    );
    const stableBtcBlockHash = await getBtcBlockHashByHeight(
      btcStableBurnHeight
    );

    const preamble = new Preamble(
      /* peer_version */ peerVersion,
      /* network_id */ networkID,
      /* seq */ seqNum,
      /* burn_block_height */ BigInt(btcChainInfo.blocks),
      /* burn_header_hash */ new BurnchainHeaderHash(latestBtcBlockHash),
      /* stable_burn_block_height */ BigInt(btcStableBurnHeight),
      /* stable_burn_header_hash */ new BurnchainHeaderHash(stableBtcBlockHash),
      /* additional_data */ 0,
      /* signature */ MessageSignature.empty(),
      /* payload_len */ 0
    );
    const envelope = new StacksMessageEnvelope(
      preamble,
      new RelayDataVec([]), // No relays, we're generating this message.
      message
    );
    envelope.sign(this.privKey);
    return envelope;
  }

  async performHandshake(): Promise<StacksMessageEnvelope<HandshakeAccept>> {
    const handshake = new Handshake(
      new HandshakeData(
        new PeerAddress('127.0.0.1'),
        ENV.CONTROL_PLANE_PORT,
        0x0001,
        this.pubKey.toString('hex'),
        100000n,
        ENV.DATA_PLANE_PUBLIC_URL
      )
    );
    const envelope = await this.createAndSignEnvelope(handshake);
    this.send(envelope);
    const handshakeReply = await this.waitForMessage(
      (msg) =>
        msg.payload.containerType ===
          StacksMessageContainerTypeID.HandshakeAccept ||
        msg.payload.containerType ===
          StacksMessageContainerTypeID.HandshakeReject
    );
    if (
      handshakeReply.payload.containerType ===
      StacksMessageContainerTypeID.HandshakeReject
    ) {
      throw new Error('Handshake rejected');
    } else if (
      handshakeReply.payload.containerType ===
      StacksMessageContainerTypeID.HandshakeAccept
    ) {
      return handshakeReply as StacksMessageEnvelope<HandshakeAccept>;
    } else {
      throw new Error('Invalid handshake reply');
    }
  }

  async requestNeighbors(): Promise<StacksMessageEnvelope<Neighbors>> {
    const getNeighbors = new GetNeighbors();
    const envelope = await this.createAndSignEnvelope(getNeighbors);
    this.send(envelope);
    const neighbors = await this.waitForMessage(
      (msg) =>
        msg.payload.containerType === StacksMessageContainerTypeID.Neighbors
    );
    return neighbors as StacksMessageEnvelope<Neighbors>;
  }

  async send(envelope: StacksMessageEnvelope) {
    const byteStream = new ResizableByteStream();
    envelope.encode(byteStream);
    this.socket.write(byteStream.asBuffer(), (err) => {
      if (err) {
        logger.error(err, 'Error sending message');
      }
    });
  }

  async close() {
    // TODO: send graceful close message
    this.socket.destroy();
    return Promise.resolve();
  }

  public static async connectOutbound(
    address: PeerEndpoint,
    metrics: StacksPeerMetrics
  ): Promise<StacksPeer> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection({
        host: address.ipAddress,
        port: address.port,
      });
      const onConnect = () => {
        socket.removeListener('error', onError);
        resolve(socket);
      };
      const onError = (error: Error) => {
        socket.removeListener('connect', onConnect);
        socket.destroy();
        reject(error);
      };
      socket.once('connect', onConnect);
      socket.once('error', onError);
    });

    const peer = new this(socket, PeerDirection.Outbound, metrics);
    logger.info(`Connected to Stacks peer: ${peer.address}`);

    const handshakeReply = await peer.performHandshake();
    logger.info(`Handshake accepted by peer: ${peer.address}`);

    // TODO: store neighbor addresses in memory registery object, and monitor/retry connection to them
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
        StacksPeer.connectOutbound(peerEndpoint, metrics).catch((error) => {
          logger.error(error, `Error connecting to peer: ${peerEndpoint}`);
        });
      });
    });
    return peer;
  }
}

/** A class that stores an IP address (ipv4 or ipv6) and a port number, with helper functions */
export class PeerEndpoint {
  static _uniqueCache = new WeakDictionary<string, PeerEndpoint>();

  /** The IP address, either ipv4 or ipv6 */
  readonly ipAddress: string;
  /** The port number */
  readonly port: number;

  constructor(ipAddress: string, port: number) {
    this.ipAddress = ipAddress;
    this.port = port;
    const strRepr = this.toString();
    const existing = PeerEndpoint._uniqueCache.get(strRepr);
    if (existing !== undefined) {
      return existing;
    }
    PeerEndpoint._uniqueCache.set(strRepr, this);
  }

  toString() {
    return `${this.ipAddress}:${this.port}`;
  }

  static fromString(str: string) {
    const [ipAddress, port] = str.split(':');
    return new PeerEndpoint(ipAddress, parseInt(port));
  }
}
