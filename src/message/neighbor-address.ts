import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';
import { PeerAddress } from './peer-address';

export class NeighborAddress implements Encodeable {
  /** The IPv4 or IPv6 address of this peer */
  readonly addrbytes: PeerAddress;
  /** (u16) The port this peer listens on */
  readonly port: number;
  /**
   * (20-bytes, hex encoded)
   * The RIPEMD160-SHA256 hash of the node's public key.
   * If this structure is used to advertise knowledge of another peer,
   * then this field _may_ be used as a hint to tell the receiver which
   * public key to expect when it establishes a connection.
   */
  readonly public_key_hash: string;

  constructor(addrbytes: PeerAddress, port: number, public_key_hash: string) {
    if (public_key_hash.length !== 40) {
      throw new Error('public_key_hash must be a 20 byte hex string');
    }
    this.addrbytes = addrbytes;
    this.port = port;
    this.public_key_hash = public_key_hash;
  }
  static decode(source: ResizableByteStream): NeighborAddress {
    return new NeighborAddress(
      PeerAddress.decode(source),
      source.readUint16(),
      source.readBytesAsHexString(20)
    );
  }
  encode(target: ResizableByteStream): void {
    this.addrbytes.encode(target);
    target.writeUint16(this.port);
    target.writeBytesFromHexString(this.public_key_hash);
  }
}
