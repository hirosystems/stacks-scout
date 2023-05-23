import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';

export class Blocks implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Blocks;
  readonly containerType = Blocks.containerType;

  // TODO: see SIP 005 for fields

  static decode(source: ResizableByteStream): Blocks {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Blocks();
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
  }
}
