import * as net from 'node:net';
import { EventEmitter, captureRejectionSymbol } from 'node:events';
import { ENV, INT, logger, timeout } from './util';
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
import { PeerEndpoint } from './peer-endpoint';
import { Nack } from './message/nack';

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

interface StacksPeerEvents {
  closed: (error?: Error) => void | Promise<void>;
  socketError: (error: Error) => void | Promise<void>;
  open: () => void | Promise<void>;
  messageReceived: (message: StacksMessageEnvelope) => void | Promise<void>;
  pingMessageReceived: (
    message: StacksMessageEnvelope<Ping>
  ) => void | Promise<void>;
  handshakeMessageReceived: (
    message: StacksMessageEnvelope<Handshake>
  ) => void | Promise<void>;
  handshakeAcceptMessageReceived: (
    message: StacksMessageEnvelope<HandshakeAccept>
  ) => void | Promise<void>;
  nackMessageReceived: (
    message: StacksMessageEnvelope<Nack>
  ) => void | Promise<void>;
}

export class StacksPeer extends EventEmitter {
  readonly socket: net.Socket;
  readonly direction: PeerDirection;
  readonly endpoint: PeerEndpoint;
  /** This peer's private key */
  readonly privKey: Buffer;
  /** This peer's public key */
  readonly pubKey: Buffer;
  readonly metrics: StacksPeerMetrics;
  /** epoch in milliseconds, zero for never */
  lastSeen = 0;

  lastMessageSeqNumber = 0;

  handshakeCompleted = false;

  constructor(
    socket: net.Socket,
    direction: PeerDirection,
    metrics: StacksPeerMetrics
  ) {
    super({ captureRejections: true });
    this.direction = direction;
    this.endpoint = new PeerEndpoint(
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
    this.setupHandshakeResponder();
    this.setupNackHandler();
    this.setupPinging();
    this.once('handshakeAcceptMessageReceived', () => {
      this.handshakeCompleted = true;
    });
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
        logger.error(`Peer closed connection with error: ${this.endpoint}`);
      } else {
        logger.info(`Peer closed connection: ${this.endpoint}`);
      }
      this.emit('closed');
    });
  }

  private async setupPinging() {
    const socketClosedPromise = new Promise<void>((resolve) => {
      this.socket.once('close', () => resolve());
    });

    // wait for the handshake to complete before starting to ping (or for the socket to close)
    await Promise.race([
      socketClosedPromise,
      this.waitForMessage(
        (msg) =>
          msg.payload.containerType ===
          StacksMessageContainerTypeID.HandshakeAccept
      ),
    ]);
    if (this.socket.closed) {
      return;
    }

    const pingInterval = 10_000;
    let nextPingNonce = 0;

    const sendPing = async () => {
      const pingNonce = ++nextPingNonce;
      const ping = new Ping(pingNonce);
      const envelope = await this.createAndSignEnvelope(ping);
      await this.send(envelope);
      const pong = await this.waitForMessage(
        (msg) =>
          msg.payload.containerType === StacksMessageContainerTypeID.Pong &&
          msg.payload.nonce === pingNonce
      );
      return pong;
    };

    while (!this.socket.closed) {
      await timeout(pingInterval);
      try {
        await Promise.race([socketClosedPromise, sendPing()]);
      } catch (error) {
        logger.error(error, 'Error pinging peer');
      }
    }
  }

  private setupPongResponder() {
    this.on('pingMessageReceived', async (message) => {
      const pong = new Pong(message.payload.nonce);
      const envelope = await this.createAndSignEnvelope(pong);
      await this.send(envelope);
    });
  }

  private setupHandshakeResponder() {
    this.on('handshakeMessageReceived', async (message) => {
      const handshakeData = this.createHandshakeData();
      const heartbeatIntervalSeconds = 60;
      const handshakeResponse = new HandshakeAccept(
        handshakeData,
        heartbeatIntervalSeconds
      );
      const envelope = await this.createAndSignEnvelope(handshakeResponse);
      await this.send(envelope);
    });
  }

  private setupNackHandler() {
    this.on('nackMessageReceived', (message) => {
      logger.error(
        `Peer ${this.endpoint} sent nack: ${message.payload.error_code}`
      );
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
        // check if message deserialization read the expected length
        if (byteStream.position < payloadLength + Preamble.BYTE_SIZE) {
          logger.error(
            `Message deserialization error: payload ${
              receivedMsg.payload.constructor.name
            } is expected to be ${payloadLength} bytes, but only ${
              byteStream.position - Preamble.BYTE_SIZE
            } bytes were read by the decoder`
          );
          lastChunk = Buffer.alloc(0);
          return;
        }
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
        `received ${receivedMsg.payload.constructor.name} message from ${this.endpoint}`
      );
      this.emit('messageReceived', receivedMsg);

      switch (receivedMsg.payload.containerType) {
        case StacksMessageContainerTypeID.Handshake:
          this.emit(
            'handshakeMessageReceived',
            receivedMsg as StacksMessageEnvelope<Handshake>
          );
          break;
        case StacksMessageContainerTypeID.HandshakeAccept:
          this.emit(
            'handshakeAcceptMessageReceived',
            receivedMsg as StacksMessageEnvelope<HandshakeAccept>
          );
          break;
        case StacksMessageContainerTypeID.Ping:
          this.emit(
            'pingMessageReceived',
            receivedMsg as StacksMessageEnvelope<Ping>
          );
          break;
        case StacksMessageContainerTypeID.Nack:
          this.emit(
            'nackMessageReceived',
            receivedMsg as StacksMessageEnvelope<Nack>
          );
          break;
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

  private createHandshakeData() {
    // TODO: make the IP configurable via env var (or self discovery)
    const myIP = '127.0.0.1';
    // TODO: figure out what the servicesAvailable value should be (looks like the stacks-node uses 0x0003)
    const servicesAvailable = 0x0003;
    return new HandshakeData(
      /* addrbytes */ new PeerAddress(myIP),
      /* port */ ENV.CONTROL_PLANE_PORT,
      /* services */ servicesAvailable,
      /* node_public_key */ this.pubKey.toString('hex'),
      /* expire_block_height */ 1_000_000n,
      /* data_url */ ENV.DATA_PLANE_PUBLIC_URL
    );
  }

  async performHandshake(): Promise<StacksMessageEnvelope<HandshakeAccept>> {
    const handshake = new Handshake(this.createHandshakeData());
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
    logger.info(`Connected to Stacks peer: ${peer.endpoint}`);

    const handshakeReply = await peer.performHandshake();
    logger.info(`Handshake accepted by peer: ${peer.endpoint}`);

    return peer;
  }
}
