import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';

/** This is a fixed-length container for an IPv4 or an IPv6 address. */

export class PeerAddress implements Encodeable {
  // TODO: this is a hex encoded string but should be human-readable IP address string
  /** (16-byted) fixed-length container for an IPv4 or an IPv6 address. */
  readonly ip_address: string;

  constructor(ip_address: string) {
    if (ip_address.length !== 32) {
      throw new Error('ip_address must be a 16 byte hex string for now');
    }
    this.ip_address = ip_address;
  }
  static decode(source: ResizableByteStream): PeerAddress {
    return new PeerAddress(source.readBytesAsHexString(16));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.ip_address);
  }
}
