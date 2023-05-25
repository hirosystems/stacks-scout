import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { MessageVectorArray } from '../message-vector-array';
import {
  SponsoredAuthorization,
  StandardAuthorization,
  TransactionAuthorization,
} from './transaction-authorization';
import {
  CoinbasePayToAltPayload,
  CoinbasePayload,
  ContractCallPayload,
  PoisonMicroblockPayload,
  SmartContractPayload,
  TokenTransferPayload,
  TransactionPayload,
  VersionedSmartContractPayload,
} from './transaction-payload';
import { StacksTransactionPostConditionVec } from './transaction-post-condition';

export class StacksTransaction implements Encodeable {
  /** (u8) */
  readonly version_number: number;
  /** (u32) */
  readonly chain_id: number;
  /** 1 byte */
  readonly authorization_type: number;
  /** x */
  readonly authorization: TransactionAuthorization;
  /** (u8) */
  readonly anchor_mode: number;
  /** (u8) */
  readonly post_condition_mode: number;
  readonly post_conditions: StacksTransactionPostConditionVec;
  /** A 1-byte payload type ID, between 0 and 5 exclusive. */
  readonly payload_type_id: number;
  readonly payload: TransactionPayload;

  constructor(
    version_number: number,
    chain_id: number,
    authorization_type: number,
    authorization: TransactionAuthorization,
    anchor_mode: number,
    post_condition_mode: number,
    post_conditions: StacksTransactionPostConditionVec,
    payload_type_id: number,
    payload: TransactionPayload
  ) {
    this.version_number = version_number;
    this.chain_id = chain_id;
    this.authorization_type = authorization_type;
    this.authorization = authorization;
    this.anchor_mode = anchor_mode;
    this.post_condition_mode = post_condition_mode;
    this.post_conditions = post_conditions;
    this.payload_type_id = payload_type_id;
    this.payload = payload;
  }

  static decode(source: ResizableByteStream): StacksTransaction {
    const version_number = source.readUint8();
    const chain_id = source.readUint32();
    const authorization_type = source.readUint8();
    const authorization =
      authorization_type === 0x05
        ? SponsoredAuthorization.decode(source)
        : StandardAuthorization.decode(source);
    const anchor_mode = source.readUint8();
    const pc_mode = source.readUint8();
    const pc = StacksTransactionPostConditionVec.decode(source);
    const p_type_id = source.readUint8();
    let payload: TransactionPayload;
    switch (p_type_id) {
      case 0x00:
        payload = TokenTransferPayload.decode(source);
        break;
      case 0x01:
        payload = SmartContractPayload.decode(source);
        break;
      case 0x02:
        payload = ContractCallPayload.decode(source);
        break;
      case 0x03:
        payload = PoisonMicroblockPayload.decode(source);
        break;
      case 0x04:
        payload = CoinbasePayload.decode(source);
        break;
      case 0x05:
        payload = CoinbasePayToAltPayload.decode(source);
        break;
      default:
        payload = VersionedSmartContractPayload.decode(source);
        break;
    }
    return new StacksTransaction(
      version_number,
      chain_id,
      authorization_type,
      authorization,
      anchor_mode,
      pc_mode,
      pc,
      p_type_id,
      payload
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.version_number);
    target.writeUint32(this.chain_id);
    this.authorization.encode(target);
    target.writeUint8(this.anchor_mode);
    target.writeUint8(this.post_condition_mode);
    this.post_conditions.encode(target);
    target.writeUint8(this.payload_type_id);
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
