import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';

/**
 * ConsensusHash is the hash of the sortition seed and the block hash.
 * Identifies both the burnchain block and the PoX fork.
 */
export class ConsensusHash implements Encodeable {
  /** (20 bytes, hex encoded) */
  readonly hash: string;

  constructor(hash: string) {
    if (hash.length !== 40) {
      throw new Error('ConsensusHash must be a 20 byte hex string');
    }
    this.hash = hash;
  }
  static decode(source: ResizableByteStream): ConsensusHash {
    return new ConsensusHash(source.readBytesAsHexString(20));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.hash);
  }
}
