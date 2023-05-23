import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class Pong implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Pong;
  readonly containerType = Pong.containerType;

  /** (u32) Random number */
  readonly nonce: number;

  constructor(nonce: number) {
    this.nonce = nonce;
  }

  static decode(source: ResizableByteStream): Pong {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Pong(source.readUint32());
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    target.writeUint32(this.nonce);
  }
}
