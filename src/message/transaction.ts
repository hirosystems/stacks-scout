import { ResizableByteStream } from '../resizable-byte-stream';
import {
  Encodeable,
  StacksMessageContainerTypeID,
  StacksMessageTypedContainer,
} from '../stacks-p2p-deser';
import { StacksTransaction } from './entities/stacks-transaction';

export class Transaction implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Transaction;
  readonly containerType = Transaction.containerType;

  readonly transaction: StacksTransaction;

  constructor(transaction: StacksTransaction) {
    this.transaction = transaction;
  }

  static decode(source: ResizableByteStream): Transaction {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Transaction(StacksTransaction.decode(source));
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.transaction.encode(target);
  }
}
