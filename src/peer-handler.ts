import * as net from 'node:net';
import { ENV, WeakDictionary, logger } from './util';
import { PeerAddress } from './message/peer-address';
import { NeighborAddress } from './message/neighbor-address';
import { RelayData, RelayDataVec } from './message/relay-data';
import { MessageSignature } from './message/message-signature';
import { BurnchainHeaderHash } from './message/burnchain-header-hash';
import { StacksMessageEnvelope } from './message/stacks-message-envelope';
import { ResizableByteStream } from './resizable-byte-stream';
import { Handshake } from './message/handshake';
import { Preamble } from './message/preamble';
import { randomBytes } from 'node:crypto';
import * as secp256k1 from 'secp256k1';

export class StacksPeer {
  readonly socket: net.Socket;
  readonly address: PeerEndpoint;
  /** This node's private key */
  readonly privKey: Buffer;
  readonly pubKey: Buffer;
  /** epoch in milliseconds, zero for never */
  lastSeen = 0;

  constructor(socket: net.Socket) {
    this.address = new PeerEndpoint(
      socket.remoteAddress as string,
      socket.remotePort as number
    );
    do {
      this.privKey = randomBytes(32);
    } while (!secp256k1.privateKeyVerify(this.privKey));
    this.pubKey = Buffer.from(secp256k1.publicKeyCreate(this.privKey));
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
    const handshake = new Handshake(
      new PeerAddress('007f000000000001'), // 127.0.0.1
      5000,
      0,
      this.pubKey.toString('hex'),
      50n,
      'http://test.local'
    );
    const preamble = new Preamble(
      0x15000000,
      0x15000001,
      0,
      10n,
      new BurnchainHeaderHash(
        '0000000000000000000435785429211dca22ed6e2444800c88ad042eb0cc0e94'
      ),
      3n,
      new BurnchainHeaderHash(
        '000000000000000000050bcb25b81adaa1f2138dfd58e05634544b2e77a3dcbb'
      ),
      0,
      new MessageSignature('dd'.repeat(65)), // Will be calculated later
      0 // Will be calculated later
    );
    const envelope = new StacksMessageEnvelope(
      preamble,
      new RelayDataVec([]), // Empty, we're generating this message.
      handshake
    );
    envelope.sign(this.privKey);

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
