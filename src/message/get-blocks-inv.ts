import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
  BurnchainHeaderHash,
} from '../stacks-p2p-deser';

export class GetBlocksInv implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.GetBlocksInv;
  readonly containerType = GetBlocksInv.containerType;

  /**
   * The consensus hash at the start of the requested reward cycle block range
   */
  readonly consensus_hash: BurnchainHeaderHash;

  /**
   * (u16) The number of blocks after to this consensus hash, including the block that corresponds
   * to this consensus hash.
   */
  readonly num_blocks: number;

  constructor(consensus_hash: BurnchainHeaderHash, num_blocks: number) {
    this.consensus_hash = consensus_hash;
    this.num_blocks = num_blocks;
  }

  static decode(source: ResizableByteStream): GetBlocksInv {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new GetBlocksInv(
      BurnchainHeaderHash.decode(source),
      source.readUint16()
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.consensus_hash.encode(target);
    target.writeUint16(this.num_blocks);
  }
}
