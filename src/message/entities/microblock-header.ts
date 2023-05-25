import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';

export class MicroblockHeader implements Encodeable {
  // A 1-byte version number to describe how to validate the block.
  readonly version_number: number;
  // A 2-byte sequence number as a hint to describe how to order a set of microblocks.
  readonly seq_number: number;
  // A 32-byte parent microblock hash, which is the SHA512/256 hash of the previous signed microblock in this stream.
  readonly parent_microblock_hash: string;
  // A 32-byte transaction Merkle root, the SHA512/256 root hash of a binary Merkle tree calculated over this block's sequence of transactions.
  readonly transaction_merkle_root: string;
  // A 65-byte signature over the block header from the Stacks peer that produced it, using the private key whose public key was announced in the anchored block. This is a recoverable ECDSA secp256k1 signature, whose recovered compressed public key must hash to the same value as the parent anchor block's microblock public key hash field.
  readonly signature: string;

  constructor(
    version_number: number,
    seq_number: number,
    parent_microblock_hash: string,
    transaction_merkle_root: string,
    signature: string
  ) {
    this.version_number = version_number;
    this.seq_number = seq_number;
    this.parent_microblock_hash = parent_microblock_hash;
    this.transaction_merkle_root = transaction_merkle_root;
    this.signature = signature;
  }

  static decode(source: ResizableByteStream): MicroblockHeader {
    return new MicroblockHeader(
      source.readUint8(),
      source.readUint16(),
      source.readBytesAsHexString(32),
      source.readBytesAsHexString(32),
      source.readBytesAsHexString(65)
    );
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}
