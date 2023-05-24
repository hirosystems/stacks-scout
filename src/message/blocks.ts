import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';
import { StacksBlockVec } from './entities/stacks-block';

export class Blocks implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Blocks;
  readonly containerType = Blocks.containerType;

  /** A list of blocks pushed, paired with the consensus hashes of the burnchain blocks that
   * selected them */
  readonly blocks: StacksBlockVec;

  constructor(blocks: StacksBlockVec) {
    this.blocks = blocks;
  }

  static decode(source: ResizableByteStream): Blocks {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Blocks(StacksBlockVec.decode(source));
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.blocks.encode(target);
  }
}
