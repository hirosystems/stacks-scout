import { createHash } from 'node:crypto';
import * as secp256k1 from 'secp256k1';

import { Preamble } from './preamble';
import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageTypedContainer,
  StacksMessageContainerType,
} from '../stacks-p2p-deser';
import { RelayDataVec } from './relay-data';
import { MessageSignature } from './message-signature';

/**
 * This is called just "StacksMessage" in the SIP, using "envelope" for disambiguation.
 * All Stacks messages are represented as:
 */
export class StacksMessageEnvelope<
  TPayload extends StacksMessageContainerType = StacksMessageContainerType
> implements Encodeable
{
  /** A fixed-length preamble which describes some metadata about the peer's view of the network. */
  readonly preamble: Preamble;
  /** A variable-length but bound-sized relayers vector which describes the order of peers that relayed a message. */
  readonly relayers: RelayDataVec;
  /** A variable-length payload, which encodes a specific peer message as a typed container. */
  readonly payload: TPayload;

  constructor(preamble: Preamble, relayers: RelayDataVec, payload: TPayload) {
    this.preamble = preamble;
    this.relayers = relayers;
    this.payload = payload;
  }

  static decode(source: ResizableByteStream): StacksMessageEnvelope {
    return new StacksMessageEnvelope(
      Preamble.decode(source),
      RelayDataVec.decode(source),
      StacksMessageTypedContainer.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    this.preamble.encode(target);
    this.relayers.encode(target);
    this.payload.encode(target);
  }

  /**
   * Based on https://github.com/stacks-network/stacks-blockchain/blob/master/src/net/codec.rs#L88
   *      and https://github.com/stacks-network/stacks-blockchain/blob/master/src/net/codec.rs#L1120
   * And SIP-003: https://github.com/stacksgov/sips/blob/main/sips/sip-003/sip-003-peer-network.md#creating-a-control-plane-message
   *
   * All control-plane messages are signed with the node's session private key using ECDSA on the secp256k1 curve. To sign a StacksMessage, a peer uses the following algorithm:
   * 1. Serialize the payload to a byte string.
   * 2. Set the preamble.payload_len field to the length of the payload byte string
   * 3. Set the preamble.seq field to be the number of messages sent to this peer so far.
   * 4. Set the preamble.signature field to all 0's
   * 5. Serialize the preamble to a byte string.
   * 6. Calculate the SHA512/256 over the preamble and payload byte strings
   * 7. Calculate the recoverable secp256k1 signature from the SHA256
   */
  sign(privKey: Buffer): void {
    if (this.relayers.length > 0) {
      throw new Error('Can not sign a relayed message');
    }
    // Determine length
    const contentStream = new ResizableByteStream();
    this.relayers.encode(contentStream);
    this.payload.encode(contentStream);
    this.preamble.payload_len = contentStream.position;

    // Zero-out the old signature so we can calculate a new one.
    this.preamble.signature = MessageSignature.empty();

    const preambleStream = new ResizableByteStream();
    this.preamble.encode(preambleStream);
    const sha512_256 = createHash('sha512-256')
      .update(preambleStream.asBuffer())
      .update(contentStream.asBuffer())
      .digest();

    const signature = secp256k1.ecdsaSign(sha512_256, privKey);
    const buf1 = Buffer.alloc(1);
    buf1.writeUint8(signature.recid);
    this.preamble.signature = new MessageSignature(
      Buffer.concat([buf1, signature.signature]).toString('hex')
    );
  }
}
