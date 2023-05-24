import * as net from 'node:net';
import { ENV, WeakDictionary, logger } from './util';
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

// From src/core/mod.rs
const PEER_VERSION_MAINNET = 0x18000006;
const PEER_VERSION_TESTNET = 0xfacade06;
const NETWORK_ID_MAINNET = 0x17000000;
const NETWORK_ID_TESTNET = 0xff000000;

export class StacksPeer {
  readonly socket: net.Socket;
  readonly address: PeerEndpoint;
  /** This peer's private key */
  readonly privKey: Buffer;
  /** This peer's public key */
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
    const handshake = new Handshake(
      new PeerAddress('00000000000000000000ffff7f000001'), // 127.0.0.1 -> IPv6
      ENV.CONTROL_PLANE_PORT,
      0x0001,
      this.pubKey.toString('hex'),
      100000n,
      'http://test.local'
    );
    const preamble = new Preamble(
      PEER_VERSION_MAINNET,
      NETWORK_ID_MAINNET,
      0,
      // TODO: This block height must be from the current Stacks epoch (2.3)
      10n,
      new BurnchainHeaderHash(
        '0000000000000000000435785429211dca22ed6e2444800c88ad042eb0cc0e94'
      ),
      // TODO: This should be `burn_block_height` - 7
      3n,
      new BurnchainHeaderHash(
        '000000000000000000050bcb25b81adaa1f2138dfd58e05634544b2e77a3dcbb'
      ),
      0,
      // Signature and length will be calculated later
      new MessageSignature('dd'.repeat(65)),
      0
    );
    const envelope = new StacksMessageEnvelope(
      preamble,
      new RelayDataVec([]), // No relays, we're generating this message.
      handshake
    );
    envelope.sign(this.privKey);

    this.send(envelope);
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
