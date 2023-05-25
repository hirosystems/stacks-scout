import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';
import { BurnchainHeaderHash } from './burnchain-header-hash';
import { ConsensusHash } from './consensus-hash';
import { MessageVectorArray } from './message-vector-array';

/**
 * Tuple of (ConsensusHash, BurnchainHeaderHash) used in the BlocksAvailableData array.
 */
export class AnchoredStacksBlock implements Encodeable {
  readonly consensus_hash: ConsensusHash;
  readonly burnchain_header_hash: BurnchainHeaderHash;

  constructor(
    consensus_hash: ConsensusHash,
    burnchain_header_hash: BurnchainHeaderHash
  ) {
    this.consensus_hash = consensus_hash;
    this.burnchain_header_hash = burnchain_header_hash;
  }
  static decode(source: ResizableByteStream): AnchoredStacksBlock {
    return new AnchoredStacksBlock(
      ConsensusHash.decode(source),
      BurnchainHeaderHash.decode(source)
    );
  }
  encode(target: ResizableByteStream): void {
    this.consensus_hash.encode(target);
    this.burnchain_header_hash.encode(target);
  }
}

export class BlocksAvailableVec extends MessageVectorArray<AnchoredStacksBlock> {
  constructor(items?: AnchoredStacksBlock[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): BlocksAvailableVec {
    return new this().decode(source, AnchoredStacksBlock);
  }
}

export class BlocksAvailable
  implements StacksMessageTypedContainer, Encodeable
{
  static readonly containerType = StacksMessageContainerTypeID.BlocksAvailable;
  readonly containerType = BlocksAvailable.containerType;

  /**
   * List of blocks available.
   *  - Each entry in available corresponds to the availability of an anchored Stacks block from the sender.
   *  - available.length will never exceed 32.
   *  - Each ConsensusHash in BlocksAvailableData.available must be the consensus hash calculated by the sender for the burn chain block identified by BurnchainHeaderHash.
   */
  readonly available: BlocksAvailableVec;

  constructor(available: BlocksAvailableVec) {
    this.available = available;
  }

  static decode(source: ResizableByteStream): BlocksAvailable {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new BlocksAvailable(BlocksAvailableVec.decode(source));
  }

  encode(target: ResizableByteStream): void {
    if (this.available.length > 32) {
      throw new Error('available.length must not exceed 32');
    }
    target.writeUint8(this.containerType);
    this.available.encode(target);
  }
}

/**
 * Same structure as BlocksAvailable.
 * Notes:
 *  - Each entry in available corresponds to the availability of a confirmed microblock stream from the sender.
 *  - The same rules and limits apply to the available list as in BlocksAvailable.
 */
export class MicroblocksAvailable
  implements StacksMessageTypedContainer, Encodeable
{
  static readonly containerType =
    StacksMessageContainerTypeID.MicroblocksAvailable;
  readonly containerType = MicroblocksAvailable.containerType;

  /**
   * List of blocks available.
   *  - Each entry in available corresponds to the availability of an anchored Stacks block from the sender.
   *  - available.length will never exceed 32.
   *  - Each ConsensusHash in available must be the consensus hash calculated by the sender for the burn chain block identified by BurnchainHeaderHash.
   */
  readonly available: BlocksAvailableVec;

  constructor(available: BlocksAvailableVec) {
    this.available = available;
  }

  static decode(source: ResizableByteStream): MicroblocksAvailable {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new MicroblocksAvailable(BlocksAvailableVec.decode(source));
  }

  encode(target: ResizableByteStream): void {
    if (this.available.length > 32) {
      throw new Error('available.length must not exceed 32');
    }
    target.writeUint8(this.containerType);
    this.available.encode(target);
  }
}
