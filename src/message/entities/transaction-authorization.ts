import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { StacksTransactionSpendingCondition } from './transaction-spending-condition';

export abstract class TransactionAuthorization implements Encodeable {
  /** A 1-byte authorization type field that indicates whether or not the transaction has a standard
   * or sponsored authorization */
  readonly authorization_type: number;

  constructor(authorization_type: number) {
    this.authorization_type = authorization_type;
  }

  static decode(source: ResizableByteStream): TransactionAuthorization {
    const type = source.peekUint8();
    if (type === 0x05) {
      return SponsoredAuthorization.decode(source);
    }
    return StandardAuthorization.decode(source);
  }

  abstract encode(target: ResizableByteStream): void;
}

class StandardAuthorization extends TransactionAuthorization {
  readonly spending_condition: StacksTransactionSpendingCondition;

  constructor(
    authorization_type: number,
    spending_condition: StacksTransactionSpendingCondition
  ) {
    super(authorization_type);
    this.spending_condition = spending_condition;
  }

  static decode(source: ResizableByteStream): TransactionAuthorization {
    return new StandardAuthorization(
      source.readUint8(),
      StacksTransactionSpendingCondition.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.authorization_type);
    this.spending_condition.encode(target);
  }
}

class SponsoredAuthorization extends TransactionAuthorization {
  readonly spending_condition_1: StacksTransactionSpendingCondition;
  readonly spending_condition_2: StacksTransactionSpendingCondition;

  constructor(
    authorization_type: number,
    spending_condition_1: StacksTransactionSpendingCondition,
    spending_condition_2: StacksTransactionSpendingCondition
  ) {
    super(authorization_type);
    this.spending_condition_1 = spending_condition_1;
    this.spending_condition_2 = spending_condition_2;
  }

  static decode(source: ResizableByteStream): TransactionAuthorization {
    return new SponsoredAuthorization(
      source.readUint8(),
      StacksTransactionSpendingCondition.decode(source),
      StacksTransactionSpendingCondition.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.authorization_type);
    this.spending_condition_1.encode(target);
    this.spending_condition_2.encode(target);
  }
}
