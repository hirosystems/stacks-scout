import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';

export class Transaction implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Transaction;
  readonly containerType = Transaction.containerType;

  // TODO: see SIP 005 for fields

  static decode(source: ResizableByteStream): Transaction {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Transaction();
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
  }
}
