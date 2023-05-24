import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  StacksMessageContainerTypeID,
  Encodeable,
} from '../stacks-p2p-deser';
import { HandshakeData } from './handshake-data';

export class Handshake implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Handshake;
  readonly containerType = Handshake.containerType;

  readonly data: HandshakeData;

  constructor(data: HandshakeData) {
    this.data = data;
  }
  static decode(source: ResizableByteStream): Handshake {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Handshake(HandshakeData.decode(source));
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.data.encode(target);
  }
}
