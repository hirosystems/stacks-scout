import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';
import { MessageSignature } from './message-signature';
import { BurnchainHeaderHash } from './burnchain-header-hash';
import { createHash, randomBytes } from 'node:crypto';
import * as secp256k1 from 'secp256k1';

export class Preamble implements Encodeable {
  /**
   * (u32)
   * A 4-byte scalar to encode the semantic version of this software.
   * The only valid value is 0x15000000 (i.e. version 21.0.0.0).
   */
  readonly peer_version: number;
  /**
   * (u32)
   * A 4-byte scalar to encode which network this peer belongs to.
   * Valid values are:
   *   0x15000000 -- this is "mainnet"
   *   0x15000001 -- this is "testnet"
   */
  readonly network_id: number;
  /**
   * (u32)
   * A 4-byte scalar to encode the message sequence number. A peer will
   * maintain a sequence number for each neighbor it talks to, and will
   * increment it each time it sends a new message (wrapping around if
   * necessary).
   */
  readonly seq: number;
  /**
   * (u64)
   * This is the height of the last burn chain block this peer processed.
   * If the peer is all caught up, this is the height of the burn chain tip.
   */
  readonly burn_block_height: bigint;
  /**
   * This is the burn block hash calculated at the burn_block_height above.
   * It uniquely identifies a burn chain block.`
   */
  readonly burn_header_hash: BurnchainHeaderHash;
  /**
   * (u64)
   * This is the height of the last stable block height -- i.e. the largest
   * block height at which a block can be considered stable in the burn
   * chain history.  In Bitcoin, this is at least 7 blocks behind block_height.
   */
  readonly stable_burn_block_height: bigint;
  /**
   * This is the hash of the last stable block's header.
   */
  readonly stable_burn_header_hash: BurnchainHeaderHash;
  /**
   * (u32) This is a pointer to additional data that follows the payload.
   * This is a reserved field; for now, it should all be 0's.
   */
  readonly additional_data: number;
  /**
   * This is a signature over the entire message (preamble and payload).
   * When generating this value, the signature bytes below must all be 0's.
   */
  signature: MessageSignature;
  /**
   * (u32) This is the length of the message payload.
   */
  payload_len: number;

  constructor(
    peer_version: number,
    network_id: number,
    seq: number,
    burn_block_height: bigint,
    burn_header_hash: BurnchainHeaderHash,
    stable_burn_block_height: bigint,
    stable_burn_header_hash: BurnchainHeaderHash,
    additional_data: number,
    signature: MessageSignature,
    payload_len: number
  ) {
    this.peer_version = peer_version;
    this.network_id = network_id;
    this.seq = seq;
    this.burn_block_height = burn_block_height;
    this.burn_header_hash = burn_header_hash;
    this.stable_burn_block_height = stable_burn_block_height;
    this.stable_burn_header_hash = stable_burn_header_hash;
    this.additional_data = additional_data;
    this.signature = signature;
    this.payload_len = payload_len;
  }

  static decode(source: ResizableByteStream): Preamble {
    return new Preamble(
      source.readUint32(),
      source.readUint32(),
      source.readUint32(),
      source.readUint64(),
      BurnchainHeaderHash.decode(source),
      source.readUint64(),
      BurnchainHeaderHash.decode(source),
      source.readUint32(),
      MessageSignature.decode(source),
      source.readUint32()
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint32(this.peer_version);
    target.writeUint32(this.network_id);
    target.writeUint32(this.seq);
    target.writeUint64(this.burn_block_height);
    this.burn_header_hash.encode(target);
    target.writeUint64(this.stable_burn_block_height);
    this.stable_burn_header_hash.encode(target);
    target.writeUint32(this.additional_data);
    this.signature.encode(target);
    target.writeUint32(this.payload_len);
  }

  // Based on https://github.com/stacks-network/stacks-blockchain/blob/master/src/net/codec.rs#L88
  sign(privKey: Buffer, envelopeStream: ResizableByteStream): void {
    // const privKey = randomBytes(32);

    // Zero-out the old signature so we can calculate a new one.
    const preambleStream = new ResizableByteStream();
    const oldSignature = this.signature;
    this.signature = MessageSignature.empty();
    this.signature.encode(preambleStream);
    this.signature = oldSignature;

    const sha256 = createHash('sha256')
      .update(preambleStream.asBuffer())
      .update(envelopeStream.asBuffer())
      .digest();

    const signature = secp256k1.ecdsaSign(sha256, privKey);
    const buf1 = Buffer.alloc(1);
    buf1.writeUint8(signature.recid);
    this.signature = new MessageSignature(
      Buffer.concat([buf1, signature.signature]).toString('hex')
    );
  }
}
