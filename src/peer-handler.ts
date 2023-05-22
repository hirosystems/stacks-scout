import * as net from 'node:net';
import { WeakDictionary, logger } from './util';

export class StacksPeer {
  readonly socket: net.Socket;
  readonly address: PeerAddress;
  /** epoch in milliseconds, zero for never */
  lastSeen = 0;

  constructor(socket: net.Socket) {
    this.address = new PeerAddress(
      socket.remoteAddress as string,
      socket.remotePort as number
    );
    this.socket = socket;
    this.listen();
  }

  private listen() {
    this.socket.on('data', (data) => {
      console.log('got data', data);
    });
  }

  async close() {
    // TODO: send graceful close message
    this.socket.destroy();
    return Promise.resolve();
  }

  public static async connectOutbound(
    address: PeerAddress
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
export class PeerAddress {
  static _uniqueCache = new WeakDictionary<string, PeerAddress>();

  /** The IP address, either ipv4 or ipv6 */
  readonly ipAddress: string;
  /** The port number */
  readonly port: number;

  constructor(ipAddress: string, port: number) {
    this.ipAddress = ipAddress;
    this.port = port;
    const strRepr = this.toString();
    const existing = PeerAddress._uniqueCache.get(strRepr);
    if (existing !== undefined) {
      return existing;
    }
    PeerAddress._uniqueCache.set(strRepr, this);
  }

  toString() {
    return `${this.ipAddress}:${this.port}`;
  }

  static fromString(str: string) {
    const [ipAddress, port] = str.split(':');
    return new PeerAddress(ipAddress, parseInt(port));
  }
}
