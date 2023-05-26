import * as net from 'node:net';
import { EventEmitter, captureRejectionSymbol } from 'node:events';
import { ENV, INT, getPeerKeyPair, getPublicIP, logger, timeout } from './util';
import { PeerAddress } from './message/peer-address';
import { RelayDataVec } from './message/relay-data';
import { MessageSignature } from './message/message-signature';
import { BurnchainHeaderHash } from './message/burnchain-header-hash';
import { StacksMessageEnvelope } from './message/stacks-message-envelope';
import { ResizableByteStream } from './resizable-byte-stream';
import { Handshake } from './message/handshake';
import { Preamble } from './message/preamble';
import { StacksPeerMetrics } from './server/prometheus-server';
import { HandshakeData } from './message/handshake-data';
import { GetNeighbors } from './message/get-neighbors';
import {
  StacksMessageContainerTypeID,
  StacksMessageContainerType,
} from './stacks-p2p-deser';
import { HandshakeAccept } from './message/handshake-accept';
import { Neighbors, NeighborsVec } from './message/neighbors';
import { NeighborAddress } from './message/neighbor-address';
import { Ping } from './message/ping';
import { Pong } from './message/pong';
import { PeerEndpoint } from './peer-endpoint';
import { Nack } from './message/nack';
import { Blocks } from './message/blocks';
import { Transaction } from './message/transaction';
import { Microblocks } from './message/microblocks';
import {
  BlocksAvailable,
  MicroblocksAvailable,
} from './message/blocks-available';
import { HandshakeReject } from './message/handshake-reject';
import { BitcoinNetInstance } from './bitcoin-net';
import { GetBlocksInv } from './message/get-blocks-inv';
import { GetPoxInv } from './message/get-pox-inv';
import { NatPunchRequest } from './message/nat-punch-request';
import { NatPunchReply } from './message/nat-punch-reply';

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
const PEER_NETWORK_EPOCH = PEER_VERSION_EPOCH_2_4;

// set the fourth byte of the peer version
const PEER_VERSION_MAINNET = PEER_VERSION_MAINNET_MAJOR | PEER_NETWORK_EPOCH;
const PEER_VERSION_TESTNET = PEER_VERSION_TESTNET_MAJOR | PEER_NETWORK_EPOCH;
const PEER_VERSION_REGTEST = PEER_VERSION_TESTNET_MAJOR | PEER_NETWORK_EPOCH;

const NETWORK_ID_MAINNET = 0x00000001;
const NETWORK_ID_TESTNET = 0x80000000;

const STABLE_CONFIRMATIONS_MAINNET = 7;
const STABLE_CONFIRMATIONS_TESTNET = 7;
const STABLE_CONFIRMATIONS_REGTEST = 1;

export enum PeerDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

interface StacksPeerEvents {
  closed: (error?: Error) => void | Promise<void>;
  socketError: (error: Error) => void | Promise<void>;
  open: () => void | Promise<void>;
  messageReceived: (message: StacksMessageEnvelope) => void | Promise<void>;
  pingMessageReceived: (
    message: StacksMessageEnvelope<Ping>
  ) => void | Promise<void>;
  pongMessageReceived: (
    message: StacksMessageEnvelope<Pong>
  ) => void | Promise<void>;
  handshakeMessageReceived: (
    message: StacksMessageEnvelope<Handshake>
  ) => void | Promise<void>;
  handshakeAcceptMessageReceived: (
    message: StacksMessageEnvelope<HandshakeAccept>
  ) => void | Promise<void>;
  handshakeRejectMessageReceived: (
    message: StacksMessageEnvelope<HandshakeReject>
  ) => void | Promise<void>;
  getNeighborsMessageReceived: (
    message: StacksMessageEnvelope<GetNeighbors>
  ) => void | Promise<void>;
  nackMessageReceived: (
    message: StacksMessageEnvelope<Nack>
  ) => void | Promise<void>;
  transactionMessageReceived: (
    message: StacksMessageEnvelope<Transaction>
  ) => void | Promise<void>;
  microblocksMessageReceived: (
    message: StacksMessageEnvelope<Microblocks>
  ) => void | Promise<void>;
  blocksMessageReceived: (
    message: StacksMessageEnvelope<Blocks>
  ) => void | Promise<void>;
  blocksAvailableMessageReceived: (
    message: StacksMessageEnvelope<BlocksAvailable>
  ) => void | Promise<void>;
  microblocksAvailableMessageReceived: (
    message: StacksMessageEnvelope<MicroblocksAvailable>
  ) => void | Promise<void>;
  getBlocksInvMessageReceived: (
    message: StacksMessageEnvelope<GetBlocksInv>
  ) => void | Promise<void>;
  getPoxInvMessageReceived: (
    message: StacksMessageEnvelope<GetPoxInv>
  ) => void | Promise<void>;
  natPunchRequestMessageReceived: (
    message: StacksMessageEnvelope<NatPunchRequest>
  ) => void | Promise<void>;
  handshakeCompleted: (message: StacksMessageEnvelope) => void | Promise<void>;
}

export class StacksPeer extends EventEmitter {
  readonly socket: net.Socket;
  readonly direction: PeerDirection;
  readonly endpoint: PeerEndpoint;
  readonly metrics: StacksPeerMetrics;
  /** epoch in milliseconds, zero for never */
  lastSeen = 0;

  lastMessageSeqNumber = 0;

  handshakeCompleted = false;

  /** Not defined until a handshake has completed */
  publicKey?: string;

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
    this.socket = socket;
    this.setupSocketEvents();
    this.setupPongResponder();
    this.setupHandshakeResponder();
    this.setupNeighborsResponder();
    this.setupGetBlocksInvResponder();
    this.setupGetPoxInvResponder();
    this.setupNatPunchRequestResponder();
    this.setupNackHandler();
    this.setupPinging();

    // Typically we get this accept message for outbound node where we initiated the handshake
    this.once('handshakeAcceptMessageReceived', (msg) => {
      this.handshakeCompleted = true;
      this.publicKey = msg.payload.handshake.node_public_key;
      this.emit('handshakeCompleted', msg);
    });
    // Typically we get this handshake message for inbound nodes where they initiated the handshake
    this.once('handshakeMessageReceived', (msg) => {
      this.handshakeCompleted = true;
      this.publicKey = msg.payload.data.node_public_key;
      this.emit('handshakeCompleted', msg);
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
      const handshakeData = await this.createHandshakeData();
      const heartbeatIntervalSeconds = 60;
      const handshakeResponse = new HandshakeAccept(
        handshakeData,
        heartbeatIntervalSeconds
      );
      const envelope = await this.createAndSignEnvelope(handshakeResponse);
      await this.send(envelope);
    });
  }

  private setupNeighborsResponder() {
    this.on('getNeighborsMessageReceived', async (message) => {
      const pubKeyHash = getPeerKeyPair().pubKeyHash.toString('hex');
      const myIP =
        ENV.CONTROL_PLANE_PUBLIC_HOST === 'auto'
          ? await getPublicIP()
          : ENV.CONTROL_PLANE_PUBLIC_HOST;
      const selfPeerAddr = new PeerAddress(myIP);
      const selfPort = ENV.CONTROL_PLANE_PUBLIC_PORT;
      const neighborAddrs = [
        new NeighborAddress(selfPeerAddr, selfPort, pubKeyHash),
      ];
      const neighbors = new Neighbors(new NeighborsVec(neighborAddrs));
      const envelope = await this.createAndSignEnvelope(neighbors);
      await this.send(envelope);
    });
  }

  private setupGetBlocksInvResponder() {
    this.on('getBlocksInvMessageReceived', (msg) => {
      // TODO: implement BlocksInv reply
      logger.warn(
        msg,
        `Uh oh! Peer ${this.endpoint} requested blocks inv and we don't have an answer`
      );
    });
  }

  private setupGetPoxInvResponder() {
    this.on('getPoxInvMessageReceived', (msg) => {
      // TODO: implement PoxInv reply
      logger.warn(
        msg,
        `Uh oh! Peer ${this.endpoint} requested pox inv and we don't have an answer`
      );
    });
  }

  private setupNatPunchRequestResponder() {
    this.on('natPunchRequestMessageReceived', async (msg) => {
      const natPunchReply = new NatPunchReply(
        new PeerAddress(this.endpoint.ipAddress),
        this.endpoint.port,
        msg.payload.nonce
      );
      const envelope = await this.createAndSignEnvelope(natPunchReply);
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
            receivedMsg.payload,
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
        case StacksMessageContainerTypeID.HandshakeReject:
          this.emit(
            'handshakeRejectMessageReceived',
            receivedMsg as StacksMessageEnvelope<HandshakeReject>
          );
          break;
        case StacksMessageContainerTypeID.GetNeighbors:
          this.emit(
            'getNeighborsMessageReceived',
            receivedMsg as StacksMessageEnvelope<GetNeighbors>
          );
          break;
        case StacksMessageContainerTypeID.Ping:
          this.emit(
            'pingMessageReceived',
            receivedMsg as StacksMessageEnvelope<Ping>
          );
          break;
        case StacksMessageContainerTypeID.Pong:
          this.emit(
            'pongMessageReceived',
            receivedMsg as StacksMessageEnvelope<Pong>
          );
          break;
        case StacksMessageContainerTypeID.Nack:
          this.emit(
            'nackMessageReceived',
            receivedMsg as StacksMessageEnvelope<Nack>
          );
          break;
        case StacksMessageContainerTypeID.Transaction:
          this.emit(
            'transactionMessageReceived',
            receivedMsg as StacksMessageEnvelope<Transaction>
          );
          break;
        case StacksMessageContainerTypeID.Blocks:
          this.emit(
            'blocksMessageReceived',
            receivedMsg as StacksMessageEnvelope<Blocks>
          );
          break;
        case StacksMessageContainerTypeID.Microblocks:
          this.emit(
            'microblocksMessageReceived',
            receivedMsg as StacksMessageEnvelope<Microblocks>
          );
          break;
        case StacksMessageContainerTypeID.BlocksAvailable:
          this.emit(
            'blocksAvailableMessageReceived',
            receivedMsg as StacksMessageEnvelope<BlocksAvailable>
          );
          break;
        case StacksMessageContainerTypeID.MicroblocksAvailable:
          this.emit(
            'microblocksAvailableMessageReceived',
            receivedMsg as StacksMessageEnvelope<MicroblocksAvailable>
          );
          break;
        case StacksMessageContainerTypeID.GetBlocksInv:
          this.emit(
            'getBlocksInvMessageReceived',
            receivedMsg as StacksMessageEnvelope<GetBlocksInv>
          );
          break;
        case StacksMessageContainerTypeID.GetPoxInv:
          this.emit(
            'getPoxInvMessageReceived',
            receivedMsg as StacksMessageEnvelope<GetPoxInv>
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

    const btcInfo = await BitcoinNetInstance.getLatestBlock(
      stableConfirmations
    );

    const preamble = new Preamble(
      /* peer_version */ peerVersion,
      /* network_id */ networkID,
      /* seq */ seqNum,
      /* burn_block_height */ BigInt(btcInfo.height),
      /* burn_header_hash */ new BurnchainHeaderHash(btcInfo.hash),
      /* stable_burn_block_height */ BigInt(btcInfo.stableHeight),
      /* stable_burn_header_hash */ new BurnchainHeaderHash(btcInfo.stableHash),
      /* additional_data */ 0,
      /* signature */ MessageSignature.empty(),
      /* payload_len */ 0
    );
    const envelope = new StacksMessageEnvelope(
      preamble,
      new RelayDataVec([]), // No relays, we're generating this message.
      message
    );
    envelope.sign(getPeerKeyPair().privKey);
    return envelope;
  }

  private async createHandshakeData() {
    const myIP =
      ENV.DATA_PLANE_PUBLIC_HOST === 'auto'
        ? await getPublicIP()
        : ENV.DATA_PLANE_PUBLIC_HOST;
    const dataUrl = `http://${myIP}:${ENV.DATA_PLANE_PUBLIC_PORT}`;
    // TODO: figure out what the servicesAvailable value should be (looks like the stacks-node uses 0x0003)
    const servicesAvailable = 0x0003;
    return new HandshakeData(
      /* addrbytes */ new PeerAddress(myIP),
      /* port */ ENV.CONTROL_PLANE_PORT,
      /* services */ servicesAvailable,
      /* node_public_key */ getPeerKeyPair().pubKey.toString('hex'),
      /* expire_block_height */ 10_000_000n,
      /* data_url */ dataUrl
    );
  }

  async performHandshake(): Promise<StacksMessageEnvelope<HandshakeAccept>> {
    const handshake = new Handshake(await this.createHandshakeData());
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

    return peer;
  }
}
