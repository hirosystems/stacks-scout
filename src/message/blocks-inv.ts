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
   * Will never exceed 4096.
   */
  readonly bitlen: number;

  /**
   * A bit vector of which blocks this peer has. bitvec[i] represents the availability of the next
   * 8*i blocks, where bitvec[i] & 0x01 represents the availability of the (8*i)th block, and
   * bitvec[i] & 0x80 represents the availability of the (8*i+7)th block. Each bit corresponds to a
   * sortition on the burn chain, and will be set if this peer has the winning block data.
   *
   * Will have length `ceil(BlocksInvData.bitlen / 8)` bytes.
   */
  readonly block_bitvec: Uint8Array;

  /**
   * A bit vector for which confirmed microblock streams this peer has. The ith bit represents the
   * presence/absence of the ith confirmed microblock stream.  It is in 1-to-1 correspondance with
   * block_bitvec.
   *
   * Will have length ceil(BlocksInvData.bitlen / 8) bytes.
   */
  readonly microblocks_bitvec: Uint8Array;

  constructor(
    bitlen: number,
    block_bitvec: Uint8Array,
    microblocks_bitvec: Uint8Array
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
      source.readBytesCopied(Math.ceil(bitlen / 8)),
      source.readBytesCopied(Math.ceil(bitlen / 8))
    );
  }

  encode(target: ResizableByteStream): void {
    if (this.bitlen > 4096) {
      throw new Error(`bitlen must be <= 4096, got ${this.bitlen}`);
    }
    const bitvecLength = Math.ceil(this.bitlen / 8);
    if (this.block_bitvec.byteLength !== bitvecLength) {
      throw new Error(
        `block_bitvec must be ${bitvecLength} bytes, got ${this.block_bitvec.byteLength}`
      );
    }
    if (this.microblocks_bitvec.byteLength !== bitvecLength) {
      throw new Error(
        `microblocks_bitvec must be ${bitvecLength} bytes, got ${this.microblocks_bitvec.byteLength}`
      );
    }
    target.writeUint8(this.containerType);
    target.writeUint16(this.bitlen);
    target.writeBytes(this.block_bitvec);
    target.writeBytes(this.microblocks_bitvec);
  }
}
