import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  StacksMessageContainerTypeID,
  Encodeable,
  NeighborAddress,
} from '../stacks-p2p-deser';
import { MessageVectorArray } from './message-vector-array';

export class NeighborsVec extends MessageVectorArray<NeighborAddress> {
  constructor(items?: NeighborAddress[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): NeighborsVec {
    return new this().decode(source, NeighborAddress);
  }
}

export class Neighbors implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Neighbors;
  readonly containerType = Neighbors.containerType;

  /**
   * List of neighbor addresses and public key hints. This vector will be at most 128 elements
   * long.
   */
  readonly neighbors: NeighborsVec;

  constructor(neighbors: NeighborsVec) {
    this.neighbors = neighbors;
  }

  static decode(source: ResizableByteStream): Neighbors {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Neighbors(NeighborsVec.decode(source));
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.neighbors.encode(target);
  }
}
