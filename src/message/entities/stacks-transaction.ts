import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { MessageVectorArray } from '../message-vector-array';
import { StacksTransactionAuthorization } from './stacks-transaction-authorization';
import { StacksTransactionPayload } from './stacks-transaction-payload';
import { StacksTransactionPostConditionVec } from './stacks-transaction-post-condition';

export class StacksTransaction implements Encodeable {
  /** (u8) */
  readonly version_number: number;
  /** (u32) */
  readonly chain_id: number;
  /** x */
  readonly authorization: StacksTransactionAuthorization;
  /** (u8) */
  readonly anchor_mode: number;
  /** (u8) */
  readonly post_condition_mode: number;
  readonly post_conditions: StacksTransactionPostConditionVec;
  readonly payload: StacksTransactionPayload;

  constructor(
    version_number: number,
    chain_id: number,
    authorization: StacksTransactionAuthorization,
    anchor_mode: number,
    post_condition_mode: number,
    post_conditions: StacksTransactionPostConditionVec,
    payload: StacksTransactionPayload
  ) {
    this.version_number = version_number;
    this.chain_id = chain_id;
    this.authorization = authorization;
    this.anchor_mode = anchor_mode;
    this.post_condition_mode = post_condition_mode;
    this.post_conditions = post_conditions;
    this.payload = payload;
  }

  static decode(source: ResizableByteStream): StacksTransaction {
    return new StacksTransaction(
      source.readUint8(),
      source.readUint32(),
      StacksTransactionAuthorization.decode(source),
      source.readUint8(),
      source.readUint8(),
      StacksTransactionPostConditionVec.decode(source),
      StacksTransactionPayload.decode(source)
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.version_number);
    target.writeUint32(this.chain_id);
    this.authorization.encode(target);
    target.writeUint8(this.anchor_mode);
    target.writeUint8(this.post_condition_mode);
    this.post_conditions.encode(target);
    this.payload.encode(target);
  }
}

export class StacksTransactionVec extends MessageVectorArray<StacksTransaction> {
  constructor(items?: StacksTransaction[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): StacksTransactionVec {
    return new this().decode(source, StacksTransaction);
  }
}
