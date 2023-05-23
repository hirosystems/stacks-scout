import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class BlocksInv implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.BlocksInv;
  readonly containerType = BlocksInv.containerType;

  /**
   * (u16) Number of bits represented in the bit vector below. Represents the number of blocks in this
   * inventory.
   */
  readonly bitlen: number;

  /**
   * A bit vector of which blocks this peer has. bitvec[i] represents the availability of the next
   * 8*i blocks, where bitvec[i] & 0x01 represents the availability of the (8*i)th block, and
   * bitvec[i] & 0x80 represents the availability of the (8*i+7)th block. Each bit corresponds to a
   * sortition on the burn chain, and will be set if this peer has the winning block data
   */
  readonly block_bitvec: string;

  /**
   * A bit vector for which confirmed microblock streams this peer has. The ith bit represents the
   * presence/absence of the ith confirmed microblock stream.  It is in 1-to-1 correspondance with
   * block_bitvec.
   */
  readonly microblocks_bitvec: string;

  constructor(
    bitlen: number,
    block_bitvec: string,
    microblocks_bitvec: string
  ) {
    this.bitlen = bitlen;
    this.block_bitvec = block_bitvec;
    this.microblocks_bitvec = microblocks_bitvec;
  }

  static decode(source: ResizableByteStream): BlocksInv {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    const bitlen = source.readUint16();
    return new BlocksInv(
      bitlen,
      source.readBytesAsHexString(Math.ceil(bitlen / 8)),
      source.readBytesAsHexString(Math.ceil(bitlen / 8))
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    target.writeUint16(this.bitlen);
    target.writeBytesFromHexString(this.block_bitvec);
    target.writeBytesFromHexString(this.microblocks_bitvec);
  }
}
