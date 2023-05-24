import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';

/**
 * This is a fixed-length container for storing a recoverable secp256k1 signature. The first byte is the recovery
 * code; the next 32 bytes are the r parameter, and the last 32 bytes are the s parameter. Because there are up to
 * two valid signature values for a secp256k1 curve, only the signature with the lower value for s will be accepted.
 */

export class MessageSignature implements Encodeable {
  /** (65-bytes, hex encoded) */
  readonly signature: string;

  constructor(signature: string) {
    if (signature.length !== 130) {
      throw new Error('MessageSignature must be a 65 byte hex string');
    }
    this.signature = signature;
  }

  static empty(): MessageSignature {
    return new MessageSignature('00'.repeat(65));
  }

  static decode(source: ResizableByteStream): MessageSignature {
    return new MessageSignature(source.readBytesAsHexString(65));
  }

  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.signature);
  }
}
