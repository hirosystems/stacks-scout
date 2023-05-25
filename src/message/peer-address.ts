import * as net from 'net';
import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';

/** This is a fixed-length container for an IPv4 or an IPv6 address. */

export class PeerAddress implements Encodeable {
  /** (16-byted) fixed-length container for an IPv4 or an IPv6 address. */
  readonly ip_address: string;

  constructor(ip_address: string) {
    if (net.isIP(ip_address) === 0) {
      throw new Error('ip_address must be a valid IPv4 or IPv6 address');
    }
    this.ip_address = ip_address;
  }
  static decode(source: ResizableByteStream): PeerAddress {
    // IPv4 address has the prefix 0x00000000000000000000ffff
    const ipv4PrefixBuff = source.peekBytes(12);
    const ipv4Prefix = new DataView(
      ipv4PrefixBuff.buffer,
      ipv4PrefixBuff.byteOffset,
      ipv4PrefixBuff.byteLength
    );
    const isIPv4Addr =
      ipv4Prefix.getUint32(0) === 0x00 &&
      ipv4Prefix.getUint32(4) === 0x00 &&
      ipv4Prefix.getUint32(8) === 0x0000ffff;

    if (isIPv4Addr) {
      source.seek(source.position + 12);
      const addrParts: string[] = [];
      for (let i = 0; i < 4; i++) {
        addrParts[i] = source.readUint8().toString();
      }
      const addrStr = addrParts.join('.');
      return new PeerAddress(addrStr);
    } else {
      const addrParts: string[] = [];
      for (let i = 0; i < 8; i++) {
        addrParts[i] = source.readBytesAsHexString(2);
      }
      const addrStr = addrParts.join(':');
      return new PeerAddress(addrStr);
    }
  }
  encode(target: ResizableByteStream): void {
    // IPv4 address has the prefix 0x00000000000000000000ffff
    if (net.isIPv4(this.ip_address)) {
      target.writeUint32(0x00);
      target.writeUint32(0x00);
      target.writeUint32(0x0000ffff);
      this.ip_address
        .split('.')
        .map((x) => parseInt(x))
        .forEach((x) => target.writeUint8(x));
    } else if (net.isIPv6(this.ip_address)) {
      this.ip_address
        .split(':')
        .map((x) => parseInt(x, 16))
        .forEach((x) => target.writeUint16(x));
    } else {
      throw new Error('ip_address must be a valid IPv4 or IPv6 address');
    }
  }
}
