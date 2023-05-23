import { Preamble } from './preamble';
import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable, StacksMessageTypedContainer } from '../stacks-p2p-deser';
import { RelayDataVec } from './relay-data';

/**
 * This is called just "StacksMessage" in the SIP, using "envelope" for disambiguation.
 * All Stacks messages are represented as:
 */

export class StacksMessageEnvelope implements Encodeable {
  /** A fixed-length preamble which describes some metadata about the peer's view of the network. */
  readonly preamble: Preamble;
  /** A variable-length but bound-sized relayers vector which describes the order of peers that relayed a message. */
  readonly relayers: RelayDataVec;
  /** A variable-length payload, which encodes a specific peer message as a typed container. */
  readonly payload: StacksMessageTypedContainer;

  constructor(
    preamble: Preamble,
    relayers: RelayDataVec,
    payload: StacksMessageTypedContainer
  ) {
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
}
