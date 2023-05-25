import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { MessageVectorArray } from '../message-vector-array';
import { Asset } from './asset';
import { ClarityValue } from './clarity-value';
import { ContractPrincipal, Principal, StandardPrincipal } from './principal';

export abstract class StacksTransactionPostCondition implements Encodeable {
  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

class StxPostCondition extends StacksTransactionPostCondition {
  readonly principal_type: number;
  /** A variable-length principal, containing the address of the standard account or contract account */
  readonly principal: Principal;
  /** A 1-byte fungible condition code, described below */
  readonly condition_code: number;
  /** An 8-byte value encoding the literal number of microSTX */
  readonly amount: bigint;

  constructor(
    principal_type: number,
    principal: Principal,
    condition_code: number,
    amount: bigint
  ) {
    super();
    this.principal_type = principal_type;
    this.principal = principal;
    this.condition_code = condition_code;
    this.amount = amount;
  }

  static decode(source: ResizableByteStream): StxPostCondition {
    const principal_type = source.readUint8();
    return new StxPostCondition(
      principal_type,
      principal_type === 0x02
        ? StandardPrincipal.decode(source)
        : ContractPrincipal.decode(source),
      source.readUint8(),
      source.readUint64()
    );
  }
}

class FungibleTokenPostCondition extends StacksTransactionPostCondition {
  readonly principal_type: number;
  /** A variable-length principal, containing the address of the standard account or contract account */
  readonly principal: Principal;
  /** A variable-length asset info structure that identifies the token type, described below */
  readonly asset: Asset;
  /** A 1-byte fungible condition code */
  readonly condition_code: number;
  /** An 8-byte value encoding the literal number of token units */
  readonly amount: bigint;

  constructor(
    principal_type: number,
    principal: Principal,
    asset: Asset,
    condition_code: number,
    amount: bigint
  ) {
    super();
    this.principal_type = principal_type;
    this.principal = principal;
    this.asset = asset;
    this.condition_code = condition_code;
    this.amount = amount;
  }

  static decode(source: ResizableByteStream): FungibleTokenPostCondition {
    const principal_type = source.readUint8();
    return new FungibleTokenPostCondition(
      principal_type,
      principal_type === 0x02
        ? StandardPrincipal.decode(source)
        : ContractPrincipal.decode(source),
      Asset.decode(source),
      source.readUint8(),
      source.readUint64()
    );
  }
}

class NonFungibleTokenPostCondition extends StacksTransactionPostCondition {
  readonly principal_type: number;
  /** A variable-length principal, containing the address of the standard account or contract account */
  readonly principal: Principal;
  /** A variable-length asset info structure that identifies the token type, described below */
  readonly asset: Asset;
  /** A variable-length asset name, which is the Clarity value that names the token instance,
   * serialized according to the Clarity value serialization format */
  readonly name: ClarityValue;
  /** A 1-byte fungible condition code */
  readonly condition_code: number;

  constructor(
    principal_type: number,
    principal: Principal,
    asset: Asset,
    name: ClarityValue,
    condition_code: number
  ) {
    super();
    this.principal_type = principal_type;
    this.principal = principal;
    this.asset = asset;
    this.name = name;
    this.condition_code = condition_code;
  }

  static decode(source: ResizableByteStream): NonFungibleTokenPostCondition {
    const principal_type = source.readUint8();
    return new NonFungibleTokenPostCondition(
      principal_type,
      principal_type === 0x02
        ? StandardPrincipal.decode(source)
        : ContractPrincipal.decode(source),
      Asset.decode(source),
      ClarityValue.decode(source),
      source.readUint8()
    );
  }
}

export class StacksTransactionPostConditionVec extends MessageVectorArray<StacksTransactionPostCondition> {
  constructor(items?: StacksTransactionPostCondition[]) {
    super(items);
  }

  decode(source: ResizableByteStream) {
    const len = source.readUint32();
    this.length = len;
    for (let i = 0; i < len; i++) {
      // 0x00: A STX post-condition, which pertains to the origin account's STX.
      // 0x01: A Fungible token post-condition, which pertains to one of the origin account's fungible tokens.
      // 0x02: A Non-fungible token post-condition, which pertains to one of the origin account's non-fungible tokens.
      const type_id = source.readUint8();
      switch (type_id) {
        case 0x00:
          this[i] = StxPostCondition.decode(source);
          break;
        case 0x01:
          this[i] = FungibleTokenPostCondition.decode(source);
          break;
        case 0x02:
          this[i] = NonFungibleTokenPostCondition.decode(source);
          break;
      }
    }
    return this;
  }

  static decode(
    source: ResizableByteStream
  ): StacksTransactionPostConditionVec {
    return new this().decode(source);
  }
}
