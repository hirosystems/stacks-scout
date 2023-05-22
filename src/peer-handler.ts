import * as net from 'node:net';
import { WeakDictionary, logger } from './util';
import {
  BurnchainHeaderHash,
  HandshakeData,
  MessageSignature,
  NeighborAddress,
  PeerAddress,
  Preamble,
  RelayData,
  RelayDataVec,
  StacksMessageEnvelope,
} from './stacks-p2p-deser';
import { ResizableByteStream } from './resizable-byte-stream';

export class StacksPeer {
  readonly socket: net.Socket;
  readonly address: PeerEndpoint;
  /** epoch in milliseconds, zero for never */
  lastSeen = 0;

  constructor(socket: net.Socket) {
    this.address = new PeerEndpoint(
      socket.remoteAddress as string,
      socket.remotePort as number
    );
    this.socket = socket;
    this.listen();
    this.initHandshake();
  }

  private listen() {
    this.socket.on('data', (data) => {
      console.log('got data', data);
    });
  }

  private initHandshake() {
    // SO CLOSE! Stacks-node logs show that peer is connecting but message is invalid:
    // WARN [1684796429.358610] [src/net/connection.rs:571] [p2p-(0.0.0.0:20444,0.0.0.0:20443)] Invalid message preamble: Burn block height 5 <= burn stable block height 6
    // INFO [1684796429.358630] [src/net/chat.rs:1920] [p2p-(0.0.0.0:20444,0.0.0.0:20443)] convo:id=4,outbound=false,peer=UNKNOWN+UNKNOWN://192.168.128.1:48928: failed to recv on P2P conversation: InvalidMessage

    // TODO: fill this with real/valid data
    const neighborAddress = new NeighborAddress(
      new PeerAddress('0f'.repeat(16)),
      4000,
      '0e'.repeat(20)
    );
    const relayData = new RelayData(neighborAddress, 455);
    const relayVec = new RelayDataVec([relayData]);
    const handshake = new HandshakeData(
      new PeerAddress('0d'.repeat(16)),
      5000,
      0,
      '0c'.repeat(33),
      50n,
      'http://test.local'
    );

    // Encode the handshake to get the length
    const handshakeByteStream = new ResizableByteStream();
    handshake.encode(handshakeByteStream);
    const handshakeLength = handshakeByteStream.position;

    const preamble = new Preamble(
      123,
      321,
      4,
      5n,
      new BurnchainHeaderHash('ff'.repeat(32)),
      6n,
      new BurnchainHeaderHash('ee'.repeat(32)),
      7,
      new MessageSignature('dd'.repeat(65)),
      handshakeLength
    );
    const envelope = new StacksMessageEnvelope(preamble, relayVec, handshake);

    const byteStream = new ResizableByteStream();
    envelope.encode(byteStream);
    this.socket.write(byteStream.asBuffer(), (err) => {
      if (err) {
        logger.error(err, 'Error writing handshake');
      }
    });
  }

  async close() {
    // TODO: send graceful close message
    this.socket.destroy();
    return Promise.resolve();
  }

  public static async connectOutbound(
    address: PeerEndpoint
  ): Promise<StacksPeer> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(address.port, address.ipAddress);
      socket.on('connect', () => {
        resolve(socket);
      });
      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
    });
    const peer = new this(socket);
    logger.info(`Connected to Stacks peer: ${peer.address}`);
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
