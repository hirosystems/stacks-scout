import { createHash } from 'node:crypto';
import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { StacksTransactionVec } from './stacks-transaction';

export class StacksBlock implements Encodeable {
  static readonly STACKS_BLOCK_HEADER_SIZE_BYTES = 247;

  /** (1 byte) */
  readonly version_number: number;
  /** (16 bytes) The cumulative work score for this block's fork */
  readonly cumulative_work_score: string;
  /** An 80-byte VRF proof which must match the burn commitment transaction on the burn chain (in
   * particular, it must hash to its VRF seed) */
  readonly vrf_proof: string;
  /** (32 bytes) */
  readonly parent_block_hash: string;
  /** (32 bytes) */
  readonly parent_microblock_hash: string;
  /** (u16) */
  readonly parent_microblock_sequence_number: number;
  /** (32 bytes) */
  readonly transaction_merkle_root: string;
  /** (32 bytes) */
  readonly state_merkle_root: string;
  /** (20 bytes) */
  readonly microblock_public_key_hash: string;
  readonly transactions: StacksTransactionVec;

  constructor(
    version_number: number,
    cumulative_work_score: string,
    vrf_proof: string,
    parent_block_hash: string,
    parent_microblock_hash: string,
    parent_microblock_sequence_number: number,
    transaction_merkle_root: string,
    state_merkle_root: string,
    microblock_public_key_hash: string,
    transactions: StacksTransactionVec
  ) {
    this.version_number = version_number;
    this.cumulative_work_score = cumulative_work_score;
    this.vrf_proof = vrf_proof;
    this.parent_block_hash = parent_block_hash;
    this.parent_microblock_hash = parent_microblock_hash;
    this.parent_microblock_sequence_number = parent_microblock_sequence_number;
    this.transaction_merkle_root = transaction_merkle_root;
    this.state_merkle_root = state_merkle_root;
    this.microblock_public_key_hash = microblock_public_key_hash;
    this.transactions = transactions;
  }

  static decode(source: ResizableByteStream): StacksBlock {
    return new StacksBlock(
      source.readUint8(),
      source.readBytesAsHexString(16),
      source.readBytesAsHexString(80),
      source.readBytesAsHexString(32),
      source.readBytesAsHexString(32),
      source.readUint16(),
      source.readBytesAsHexString(32),
      source.readBytesAsHexString(32),
      source.readBytesAsHexString(20),
      StacksTransactionVec.decode(source)
    );
  }

  encodeHeader(target: ResizableByteStream): void {
    target.writeUint8(this.version_number);
    target.writeBytesFromHexString(this.cumulative_work_score);
    target.writeBytesFromHexString(this.vrf_proof);
    target.writeBytesFromHexString(this.parent_block_hash);
    target.writeBytesFromHexString(this.parent_microblock_hash);
    target.writeUint16(this.parent_microblock_sequence_number);
    target.writeBytesFromHexString(this.transaction_merkle_root);
    target.writeBytesFromHexString(this.state_merkle_root);
    target.writeBytesFromHexString(this.microblock_public_key_hash);
  }

  encode(target: ResizableByteStream): void {
    this.encodeHeader(target);
    this.transactions.encode(target);
  }

  _blockHash: string | undefined = undefined;
  getBlockHash(): string {
    if (this._blockHash === undefined) {
      const byteStream = new ResizableByteStream(
        StacksBlock.STACKS_BLOCK_HEADER_SIZE_BYTES
      );
      this.encodeHeader(byteStream);
      const buff = byteStream.asBuffer();
      const hash = createHash('sha512-256').update(buff).digest();
      this._blockHash = hash.toString('hex');
    }
    return this._blockHash;
  }
}
