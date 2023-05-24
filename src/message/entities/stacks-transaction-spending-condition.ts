import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { MessageVectorArray } from '../message-vector-array';

export abstract class StacksTransactionSpendingCondition implements Encodeable {
  /** 1 byte */
  readonly hash_mode: number;
  /** 20 bytes */
  readonly public_key_hash: string;
  /** 8 byte */
  readonly nonce: number;
  /** 8 byte */
  readonly fee: number;

  constructor(
    hash_mode: number,
    public_key_hash: string,
    nonce: number,
    fee: number
  ) {
    this.hash_mode = hash_mode;
    this.public_key_hash = public_key_hash;
    this.nonce = nonce;
    this.fee = fee;
  }

  static decode(
    source: ResizableByteStream
  ): StacksTransactionSpendingCondition {
    const type = source.peekUint8();
    if (type === 0x01 || type === 0x03) {
      return MultisigSpendingCondition.decode(source);
    }
    return SinglesigSpendingCondition.decode(source);
  }

  abstract encode(target: ResizableByteStream): void;
}

class SinglesigSpendingCondition extends StacksTransactionSpendingCondition {
  /** 1 byte */
  readonly public_key_encoding: number;
  /** 65 bytes */
  readonly ecdsa_signature: string;

  constructor(
    hash_mode: number,
    public_key_hash: string,
    nonce: number,
    fee: number,
    public_key_encoding: number,
    ecdsa_signature: string
  ) {
    super(hash_mode, public_key_hash, nonce, fee);
    this.public_key_encoding = public_key_encoding;
    this.ecdsa_signature = ecdsa_signature;
  }

  static decode(source: ResizableByteStream): SinglesigSpendingCondition {
    return new SinglesigSpendingCondition(
      source.readUint8(),
      source.readBytesAsHexString(20),
      source.readUint32(),
      source.readUint32(),
      source.readUint8(),
      source.readBytesAsHexString(65)
    );
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}

class MultisigAuthorizationField implements Encodeable {
  /** 1 byte */
  readonly field_id: number;
  // TODO: Expand field body if needed
  /** Variable length (see below) */
  readonly field_body: string;

  constructor(field_id: number, field_body: string) {
    this.field_id = field_id;
    this.field_body = field_body;
  }

  static decode(source: ResizableByteStream): MultisigAuthorizationField {
    const field_id = source.readUint8();
    if (field_id === 0x00 || field_id === 0x01) {
      return new MultisigAuthorizationField(
        field_id,
        source.readBytesAsHexString(33)
      );
    }
    return new MultisigAuthorizationField(
      field_id,
      source.readBytesAsHexString(65)
    );
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}

class MultisigAuthorizationFieldVec extends MessageVectorArray<MultisigAuthorizationField> {
  constructor(items?: MultisigAuthorizationField[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): MultisigAuthorizationFieldVec {
    return new this().decode(source, MultisigAuthorizationField);
  }
}

class MultisigSpendingCondition extends StacksTransactionSpendingCondition {
  readonly authorization_fields: MultisigAuthorizationFieldVec;
  /** 2 bytes */
  readonly signature_count: number;

  constructor(
    hash_mode: number,
    public_key_hash: string,
    nonce: number,
    fee: number,
    authorization_fields: MultisigAuthorizationFieldVec,
    signature_count: number
  ) {
    super(hash_mode, public_key_hash, nonce, fee);
    this.authorization_fields = authorization_fields;
    this.signature_count = signature_count;
  }

  static decode(source: ResizableByteStream): MultisigSpendingCondition {
    return new MultisigSpendingCondition(
      source.readUint8(),
      source.readBytesAsHexString(20),
      source.readUint32(),
      source.readUint32(),
      MultisigAuthorizationFieldVec.decode(source),
      source.readUint16()
    );
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}
