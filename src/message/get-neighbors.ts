import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class GetNeighbors implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.GetNeighbors;
  readonly containerType = GetNeighbors.containerType;

  static decode(source: ResizableByteStream): GetNeighbors {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new GetNeighbors();
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
  }
}
