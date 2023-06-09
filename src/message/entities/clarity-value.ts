import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';
import { logger } from '../../util';
import { MessageVectorArray } from '../message-vector-array';
import { ContractPrincipal, Principal, StandardPrincipal } from './principal';

type ClarityValueType = string | bigint | Principal | ClarityValue;

export class ClarityValue implements Encodeable {
  readonly type_id: number;
  readonly value: ClarityValueType;

  constructor(type_id: number, value: ClarityValueType) {
    this.type_id = type_id;
    this.value = value;
  }

  static decode(source: ResizableByteStream): ClarityValue {
    const type_id = source.readUint8();
    let content: ClarityValueType;
    switch (type_id) {
      case 0x00: // 0x00: 128-bit signed integer
        {
          // parse two's complement integer
          const hex = source.readBytesAsHexString(16);
          const bigIntVal = BigInt('0x' + hex);
          content =
            parseInt(hex[0], 16) >= 8 ? -(~bigIntVal + BigInt(1)) : bigIntVal;
        }
        break;
      case 0x01: // 0x01: 128-bit unsigned integer
        content = BigInt('0x' + source.readBytesAsHexString(16));
        break;
      case 0x02: // 0x02: buffer
        {
          const buffLen = source.readUint32();
          content = source.readBytesAsHexString(buffLen);
        }
        break;
      case 0x03: // 0x03: boolean true
      case 0x04: // 0x04: boolean false
        content = '';
        break;
      case 0x05: // 0x05: standard principal
        content = StandardPrincipal.decode(source);
        break;
      case 0x06: // 0x06: contract principal
        content = ContractPrincipal.decode(source);
        break;
      case 0x07: // 0x07: Ok response
      case 0x08: // 0x08: Err response
        content = ClarityValue.decode(source);
        break;
      case 0x09: // 0x09: None option
        content = '';
        break;
      case 0x0a: // 0x0a: Some option
        content = ClarityValue.decode(source);
        break;
      case 0x0b: // 0x0b: List
        content = ClarityValueVec.decode(source);
        break;
      case 0x0c: // 0x0c: Tuple
        content = ClarityTuple.decode(source);
        break;
      case 0x0d: // 0x0d: StringASCII
        content = ClarityStringAscii.decode(source);
        break;
      case 0x0e: // 0x0e: StringUTF8
        content = ClarityStringUtf8.decode(source);
        break;
      default:
        logger.warn(`Unknown Clarity type ID: ${type_id}`);
        content = '';
        break;
    }
    return new ClarityValue(type_id, content);
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

export class ClarityTuple implements Encodeable {
  readonly len: number;
  readonly content: Record<string, ClarityValue>;

  constructor(len: number, content: Record<string, ClarityValue>) {
    this.len = len;
    this.content = content;
  }

  static decode(source: ResizableByteStream): ClarityTuple {
    const len = source.readUint32();
    const content: Record<string, ClarityValue> = {};
    for (let i = 0; i < len; i++) {
      const nameLen = source.readUint8();
      const nameVal = source.readBytesAsBuffer(nameLen).toString('ascii');
      const keyVal = ClarityValue.decode(source);
      content[nameVal] = keyVal;
    }
    return new ClarityTuple(len, content);
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

export class ClarityStringAscii implements Encodeable {
  readonly len: number;
  readonly content: string;

  constructor(len: number, content: string) {
    this.len = len;
    this.content = content;
  }

  static decode(source: ResizableByteStream): ClarityStringAscii {
    const len = source.readUint32();
    const content = source.readBytesAsBuffer(len).toString('ascii');
    return new ClarityStringAscii(len, content);
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

export class ClarityStringUtf8 implements Encodeable {
  readonly len: number;
  readonly content: string;

  constructor(len: number, content: string) {
    this.len = len;
    this.content = content;
  }

  static decode(source: ResizableByteStream): ClarityStringUtf8 {
    const len = source.readUint32();
    const content = source.readBytesAsBuffer(len).toString('utf8');
    return new ClarityStringUtf8(len, content);
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

export class ClarityValueVec extends MessageVectorArray<ClarityValue> {
  constructor(items?: ClarityValue[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): ClarityValueVec {
    return new this().decode(source, ClarityValue);
  }
}
