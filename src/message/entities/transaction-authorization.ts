import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { StacksTransactionSpendingCondition } from './transaction-spending-condition';

export abstract class TransactionAuthorization implements Encodeable {
  abstract encode(target: ResizableByteStream): void;
}

export class StandardAuthorization extends TransactionAuthorization {
  readonly spending_condition: StacksTransactionSpendingCondition;

  constructor(spending_condition: StacksTransactionSpendingCondition) {
    super();
    this.spending_condition = spending_condition;
  }

  static decode(source: ResizableByteStream): TransactionAuthorization {
    return new StandardAuthorization(
      StacksTransactionSpendingCondition.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    this.spending_condition.encode(target);
  }
}

export class SponsoredAuthorization extends TransactionAuthorization {
  readonly spending_condition_1: StacksTransactionSpendingCondition;
  readonly spending_condition_2: StacksTransactionSpendingCondition;

  constructor(
    spending_condition_1: StacksTransactionSpendingCondition,
    spending_condition_2: StacksTransactionSpendingCondition
  ) {
    super();
    this.spending_condition_1 = spending_condition_1;
    this.spending_condition_2 = spending_condition_2;
  }

  static decode(source: ResizableByteStream): TransactionAuthorization {
    return new SponsoredAuthorization(
      StacksTransactionSpendingCondition.decode(source),
      StacksTransactionSpendingCondition.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    this.spending_condition_1.encode(target);
    this.spending_condition_2.encode(target);
  }
}
