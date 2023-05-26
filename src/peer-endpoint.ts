import * as net from 'node:net';
import { WeakDictionary } from './util';

/** A class that stores an IP address (ipv4 or ipv6) and a port number, with helper functions */

export class PeerEndpoint {
  static _uniqueCache = new WeakDictionary<string, PeerEndpoint>();

  /** The IP address, either ipv4 or ipv6 */
  readonly ipAddress: string;
  /** The port number */
  readonly port: number;
  readonly public_key_hash: string;

  readonly family: 'IPv4' | 'IPv6';

  constructor(ipAddress: string, port: number, public_key_hash: string) {
    const ipFamily = net.isIP(ipAddress);
    if (ipFamily === 0) {
      throw new Error(`Invalid IP address: ${ipAddress}`);
    }
    this.family = ipFamily === 4 ? 'IPv4' : 'IPv6';

    this.ipAddress = ipAddress;
    this.port = port;
    this.public_key_hash = public_key_hash;
    const strRepr = this.toString();
    const existing = PeerEndpoint._uniqueCache.get(strRepr);
    if (existing !== undefined) {
      return existing;
    }
    PeerEndpoint._uniqueCache.set(strRepr, this);
  }

  toString() {
    if (this.family === 'IPv4') {
      return `${this.ipAddress}:${this.port}_${this.public_key_hash}`;
    } else {
      return `[${this.ipAddress}]:${this.port}_${this.public_key_hash}`;
    }
  }

  toJSON() {
    return this.toString();
  }

  static fromString(str: string) {
    let ipAddress: string;
    let rest: string;
    if (str.startsWith('[')) {
      [ipAddress, rest] = str.split(']:');
      ipAddress = ipAddress.substring(1);
    } else {
      [ipAddress, rest] = str.split(':');
    }
    let port = '';
    let public_key_hash = '';
    [port, public_key_hash] = rest.split('_');
    return new PeerEndpoint(ipAddress, parseInt(port), public_key_hash);
  }
}
