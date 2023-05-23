import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';
import { MessageVectorArray } from './message-vector-array';
import { StacksBlockId } from './stacks-block-id';

export class StacksMicroblock implements Encodeable {
  // TODO: see SIP 005 for fields
  static decode(source: ResizableByteStream): Microblocks {
    throw new Error('Not implemented');
  }
  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}

export class StacksMicroblockVec extends MessageVectorArray<StacksMicroblock> {
  constructor(items?: StacksMicroblock[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): StacksMicroblockVec {
    return new this().decode(source, StacksMicroblock);
  }
}

export class Microblocks implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Microblocks;
  readonly containerType = Microblocks.containerType;

  /**
   * "Index" hash of the StacksBlock that produced these microblocks.
   * This is the hash of both the consensus hash of the burn chain block
   * operations that selected the StacksBlock, as well as the StacksBlock's
   * hash itself.
   */
  index_anchor_hash: StacksBlockId;
  /**
   * A contiguous sequence of microblocks.
   */
  microblocks: StacksMicroblockVec;

  constructor(
    index_anchor_hash: StacksBlockId,
    microblocks: StacksMicroblockVec
  ) {
    this.index_anchor_hash = index_anchor_hash;
    this.microblocks = microblocks;
  }

  static decode(source: ResizableByteStream): Microblocks {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Microblocks(
      StacksBlockId.decode(source),
      StacksMicroblockVec.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.index_anchor_hash.encode(target);
    this.microblocks.encode(target);
  }
}
