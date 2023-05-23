import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';

// TODO: I think this Sha512_256(block_hash, sortition_consensus_hash)
//       AKA "index_block_hash" / "index_anchor_hash" ??
//       Or maybe it's just the regular Stacks block hash.. not sure.

export class StacksBlockId implements Encodeable {
  /** (32 bytes, hex encoded) */
  readonly hash: string;

  constructor(hash: string) {
    if (hash.length !== 64) {
      throw new Error('StacksBlockId must be a 32 byte hex string');
    }
    this.hash = hash;
  }
  static decode(source: ResizableByteStream): StacksBlockId {
    return new StacksBlockId(source.readBytesAsHexString(32));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.hash);
  }
}
