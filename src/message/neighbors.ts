import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  StacksMessageContainerTypeID,
  Encodeable,
  NeighborAddress,
} from '../stacks-p2p-deser';

export class Neighbors implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Neighbors;
  readonly containerType = Neighbors.containerType;

  /**
   * List of neighbor addresses and public key hints. This vector will be at most 128 elements
   * long.
   */
  readonly neighbors: NeighborAddress[];

  constructor(neighbors: NeighborAddress[]) {
    this.neighbors = neighbors;
  }

  static decode(source: ResizableByteStream): Neighbors {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    const neighbors: NeighborAddress[] = [];
    try {
      // TODO: Is this right? No neighbor count is given in the message.
      neighbors.push(NeighborAddress.decode(source));
    } catch (error) {
      //
    }
    return new Neighbors(neighbors);
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    for (const neighbor of this.neighbors) {
      neighbor.encode(target);
    }
  }
}
