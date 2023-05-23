import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';

export class NatPunchRequest
  implements StacksMessageTypedContainer, Encodeable
{
  static readonly containerType = StacksMessageContainerTypeID.NatPunchRequest;
  readonly containerType = NatPunchRequest.containerType;

  /** (u32) a 4-byte nonce unique to this request */
  readonly nonce: number;

  constructor(nonce: number) {
    this.nonce = nonce;
  }

  static decode(source: ResizableByteStream): NatPunchRequest {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new NatPunchRequest(source.readUint32());
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    target.writeUint32(this.nonce);
  }
}
