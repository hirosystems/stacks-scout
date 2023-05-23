import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';

/** This is a container for the hash of a burn chain block header, encoded as a 32-byte cryptographic hash. */

export class BurnchainHeaderHash implements Encodeable {
  /** (32 bytes, hex encoded) */
  readonly hash: string;

  constructor(hash: string) {
    if (hash.length !== 64) {
      throw new Error('BurnchainHeaderHash must be a 32 byte hex string');
    }
    this.hash = hash;
  }
  static decode(source: ResizableByteStream): BurnchainHeaderHash {
    return new BurnchainHeaderHash(source.readBytesAsHexString(32));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.hash);
  }
}
