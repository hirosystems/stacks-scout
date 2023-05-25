import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { ClarityValue, ClarityValueVec } from './clarity-value';
import { MicroblockHeader } from './microblock-header';
import {
  ContractName,
  ContractPrincipal,
  Principal,
  StandardPrincipal,
} from './principal';

export abstract class TransactionPayload implements Encodeable {
  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}

export class TokenTransferPayload extends TransactionPayload {
  // A recipient principal encoded as follows:
  // A 1-byte type field indicating whether the principal is
  // 0x05: a recipient address
  // 0x06: a contract recipient
  readonly recipient_type: number;
  // If a simple recipient address, the 1-byte type is followed by a 1-byte address version number and a 20-byte hash identifying a standard recipient account.
  // If a contract recipient address, the 1-byte type is followed by the issuer address of the contract, encoded with a 1-byte address version number and the 20-byte hash that identifies the standard account of the issuer. This is followed by the encoding of the contract name -- encoded as described above.
  readonly recipient_principal: Principal;
  /** An 8-byte number denominating the number of microSTX to send to the recipient address's account. */
  readonly amount: bigint;

  constructor(
    recipient_type: number,
    recipient_principal: Principal,
    amount: bigint
  ) {
    super();
    this.recipient_type = recipient_type;
    this.recipient_principal = recipient_principal;
    this.amount = amount;
  }

  static decode(source: ResizableByteStream): TokenTransferPayload {
    const recipient_type = source.readUint8();
    let principal: Principal;
    if (recipient_type === 0x05) {
      principal = StandardPrincipal.decode(source);
    } else {
      principal = ContractPrincipal.decode(source);
    }
    return new TokenTransferPayload(
      recipient_type,
      principal,
      source.readUint64()
    );
  }
}

export class SmartContractPayload extends TransactionPayload {
  // A contract name string, described above, that encodes the human-readable part of the contract's fully-qualified name.
  readonly name: ContractName;
  // A code body string that encodes the Clarity smart contract itself. This string is encoded as:
  // A 4-byte length prefix
  readonly body_length: number;
  // Zero or more human-readable ASCII characters -- specifically, those between 0x20 and 0x7e (inclusive), and the whitespace characters \n and \t.
  readonly body: string;

  constructor(name: ContractName, body_length: number, body: string) {
    super();
    this.name = name;
    this.body_length = body_length;
    this.body = body;
  }

  static decode(source: ResizableByteStream): SmartContractPayload {
    const name = ContractName.decode(source);
    const body_length = source.readUint32();
    const body = source.readBytesAsHexString(body_length);
    return new SmartContractPayload(name, body_length, body);
  }
}

export class ContractCallPayload extends TransactionPayload {
  // A contract address, comprised of a 1-byte address version number and a 20-byte public key hash of the standard account that created the smart contract whose public function is to be called,
  // A length-prefixed contract name string, described above, that encodes the human readable part of the contract's fully-qualified name,
  readonly principal: ContractPrincipal;
  // A length-prefixed function name string, comprised of a 1-byte length and up to 128 characters
  // of valid ASCII text, that identifies the public function to call. The characters must match the
  // regex ^[a-zA-Z]([a-zA-Z0-9]|[-_!?])*$.
  readonly function_name_length: number;
  readonly function_name: string;
  // A length-prefixed list of function arguments, encoded as follows:
  // A 4-byte length prefix, indicating the number of arguments
  // Zero or more binary strings encoding the arguments as Clarity values. Clarity values are serialized as described in the section Clarity Value Representation.
  readonly function_args: ClarityValueVec;

  constructor(
    principal: ContractPrincipal,
    function_name_length: number,
    function_name: string,
    function_args: ClarityValueVec
  ) {
    super();
    this.principal = principal;
    this.function_name_length = function_name_length;
    this.function_name = function_name;
    this.function_args = function_args;
  }

  static decode(source: ResizableByteStream): ContractCallPayload {
    const principal = ContractPrincipal.decode(source);
    const function_name_length = source.readUint8();
    const function_name = source.readBytesAsHexString(function_name_length);
    return new ContractCallPayload(
      principal,
      function_name_length,
      function_name,
      ClarityValueVec.decode(source)
    );
  }
}

export class PoisonMicroblockPayload extends TransactionPayload {
  // Two Stacks microblock headers, such that either the prev_block or sequence values are equal.
  // When validated, the ECDSA recoverable signature fields of both microblocks must recover to the
  // same public key, and it must hash to the leader's parent anchored block's public key hash. See
  // the following sections for the exact encoding of a Stacks microblock header.
  readonly mb_header_1: MicroblockHeader;
  readonly mb_header_2: MicroblockHeader;

  constructor(mb_header_1: MicroblockHeader, mb_header_2: MicroblockHeader) {
    super();
    this.mb_header_1 = mb_header_1;
    this.mb_header_2 = mb_header_2;
  }

  static decode(source: ResizableByteStream): PoisonMicroblockPayload {
    return new PoisonMicroblockPayload(
      MicroblockHeader.decode(source),
      MicroblockHeader.decode(source)
    );
  }
}

export class CoinbasePayload extends TransactionPayload {
  /** A 32-byte field called a coinbase buffer that the Stacks leader can fill with whatever it
   * wants. */
  readonly buffer: string;

  constructor(buffer: string) {
    super();
    this.buffer = buffer;
  }

  static decode(source: ResizableByteStream): CoinbasePayload {
    return new CoinbasePayload(source.readBytesAsHexString(32));
  }
}

export class CoinbasePayToAltPayload extends TransactionPayload {
  /** A 32-byte field called a coinbase buffer that the Stacks leader can fill with whatever it
   * wants. */
  readonly buffer: string;
  readonly principal: ClarityValue;

  constructor(buffer: string, principal: ClarityValue) {
    super();
    this.buffer = buffer;
    this.principal = principal;
  }

  static decode(source: ResizableByteStream): CoinbasePayToAltPayload {
    return new CoinbasePayToAltPayload(
      source.readBytesAsHexString(32),
      ClarityValue.decode(source)
    );
  }
}

export class VersionedSmartContractPayload extends SmartContractPayload {
  /** 1 byte */
  readonly clarity_version: number;

  constructor(
    clarity_version: number,
    name: ContractName,
    body_length: number,
    body: string
  ) {
    super(name, body_length, body);
    this.clarity_version = clarity_version;
  }

  static decode(source: ResizableByteStream): VersionedSmartContractPayload {
    const clarity_version = source.readUint8();
    const name = ContractName.decode(source);
    const body_length = source.readUint32();
    const body = source.readBytesAsHexString(body_length);
    return new VersionedSmartContractPayload(
      clarity_version,
      name,
      body_length,
      body
    );
  }
}
