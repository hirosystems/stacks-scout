import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { MessageVectorArray } from '../message-vector-array';

export class StacksTransactionPostCondition implements Encodeable {
  static decode(source: ResizableByteStream): StacksTransactionPostCondition {
    throw new Error('Not implemented');
  }
  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}

export class StacksTransactionPostConditionVec extends MessageVectorArray<StacksTransactionPostCondition> {
  constructor(items?: StacksTransactionPostCondition[]) {
    super(items);
  }
  static decode(
    source: ResizableByteStream
  ): StacksTransactionPostConditionVec {
    return new this().decode(source, StacksTransactionPostCondition);
  }
}
