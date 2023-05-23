import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';
import { BurnchainHeaderHash } from './burnchain-header-hash';

export class GetPoxInv implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.GetPoxInv;
  readonly containerType = GetPoxInv.containerType;

  /**
   * The consensus hash at the start of the requested reward cycle block range
   */
  readonly consensus_hash: BurnchainHeaderHash;

  /**
   * (u16) The number of reward cycles to request (number of bits to expect)
   */
  readonly num_cycles: number;

  constructor(consensus_hash: BurnchainHeaderHash, num_cycles: number) {
    this.consensus_hash = consensus_hash;
    this.num_cycles = num_cycles;
  }

  static decode(source: ResizableByteStream): GetPoxInv {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new GetPoxInv(
      BurnchainHeaderHash.decode(source),
      source.readUint16()
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.consensus_hash.encode(target);
    target.writeUint16(this.num_cycles);
  }
}
