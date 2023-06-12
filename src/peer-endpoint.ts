import * as net from 'node:net';
import { WeakDictionary } from './util';

/** A class that stores an IP address (ipv4 or ipv6) and a port number, with helper functions */

export class PeerEndpoint {
  static _uniqueCache = new WeakDictionary<string, PeerEndpoint>();

  /** The IP address, either ipv4 or ipv6 */
  readonly ipAddress: string;
  /** The port number */
  readonly port: number;

  readonly family: 'IPv4' | 'IPv6';

  constructor(ipAddress: string, port: number) {
    const ipFamily = net.isIP(ipAddress);
    if (ipFamily === 0) {
      throw new Error(`Invalid IP address: ${ipAddress}`);
    }
    this.family = ipFamily === 4 ? 'IPv4' : 'IPv6';

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
    if (this.family === 'IPv4') {
      return `${this.ipAddress}:${this.port}`;
    } else {
      return `[${this.ipAddress}]:${this.port}`;
    }
  }

  toJSON() {
    return this.toString();
  }

  static fromString(str: string) {
    let ipAddress: string;
    let port: string;
    if (str.startsWith('[')) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [ipAddress, port] = str.match(/^\[(.*)\]:(\d+)$/)!.slice(1);
    } else {
      [ipAddress, port] = str.split(':');
    }
    return new PeerEndpoint(ipAddress, parseInt(port));
  }
}
