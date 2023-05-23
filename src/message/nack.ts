import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class Nack implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Nack;
  readonly containerType = Nack.containerType;

  /** (u32) Numeric error code to describe what went wrong */
  readonly error_code: number;

  constructor(error_code: number) {
    this.error_code = error_code;
  }

  static decode(source: ResizableByteStream): Nack {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Nack(source.readUint32());
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    target.writeUint32(this.error_code);
  }
}
