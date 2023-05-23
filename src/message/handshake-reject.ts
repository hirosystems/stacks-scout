import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class HandshakeReject
  implements StacksMessageTypedContainer, Encodeable
{
  static readonly containerType = StacksMessageContainerTypeID.HandshakeReject;
  readonly containerType = HandshakeReject.containerType;

  static decode(source: ResizableByteStream): HandshakeReject {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new HandshakeReject();
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
  }
}
