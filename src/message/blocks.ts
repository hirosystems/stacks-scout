import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';
import { ConsensusHash } from './consensus-hash';
import { StacksBlock } from './entities/stacks-block';
import { MessageVectorArray } from './message-vector-array';

export class Blocks implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Blocks;
  readonly containerType = Blocks.containerType;

  /** A list of blocks pushed, paired with the consensus hashes of the burnchain blocks that
   * selected them */
  readonly blocks: BlocksVec;

  constructor(blocks: BlocksVec) {
    this.blocks = blocks;
  }

  static decode(source: ResizableByteStream): Blocks {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Blocks(BlocksVec.decode(source));
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.blocks.encode(target);
  }
}

export class AnchoredStacksBlock implements Encodeable {
  readonly consensus_hash: ConsensusHash;
  readonly stacks_block: StacksBlock;

  constructor(consensus_hash: ConsensusHash, stacks_block: StacksBlock) {
    this.consensus_hash = consensus_hash;
    this.stacks_block = stacks_block;
  }

  static decode(source: ResizableByteStream): AnchoredStacksBlock {
    return new AnchoredStacksBlock(
      ConsensusHash.decode(source),
      StacksBlock.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    this.consensus_hash.encode(target);
    this.stacks_block.encode(target);
  }
}

export class BlocksVec extends MessageVectorArray<AnchoredStacksBlock> {
  constructor(items?: AnchoredStacksBlock[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): BlocksVec {
    return new this().decode(source, AnchoredStacksBlock);
  }
}
