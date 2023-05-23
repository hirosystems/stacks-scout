import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class PoxInv implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.PoxInv;
  readonly containerType = PoxInv.containerType;

  /**
   * (u16) Number of reward cycles encoded.
   * Should be at most num_cycles from the corresponding GetPoxInv
   */
  readonly bitlen: number;

  /**
   * Bit vector representing the remote node's PoX vector. A bit will be `1` if the node is certain
   * about the status of the reward cycle's PoX anchor block (it either cannot exist, or the node
   * has a copy), or `0` if the node is uncertain (i.e. it may exist but the node does not have a
   * copy if it does).
   *
   * Will have length `ceil(PoxInv.bitlen / 8)` bytes.
   */
  readonly pox_bitvec: Uint8Array;

  constructor(bitlen: number, pox_bitvec: Uint8Array) {
    this.bitlen = bitlen;
    this.pox_bitvec = pox_bitvec;
  }

  static decode(source: ResizableByteStream): PoxInv {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    const bitlen = source.readUint16();
    return new PoxInv(bitlen, source.readBytesCopied(Math.ceil(bitlen / 8)));
  }

  encode(target: ResizableByteStream): void {
    const bitvecLen = Math.ceil(this.bitlen / 8);
    if (this.pox_bitvec.length !== bitvecLen) {
      throw new Error(
        `Expected bitvec length to be ${bitvecLen}, but was ${this.pox_bitvec.length}`
      );
    }
    target.writeUint8(this.containerType);
    target.writeUint16(this.bitlen);
    target.writeBytes(this.pox_bitvec);
  }
}
