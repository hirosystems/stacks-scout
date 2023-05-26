import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';

export abstract class Principal implements Encodeable {
  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

export class StandardPrincipal extends Principal {
  /** The standard principal's 1-byte version */
  readonly version: number;
  /** The standard principal's 20-byte Hash160 */
  readonly hash160: string;

  constructor(version: number, hash160: string) {
    super();
    this.version = version;
    this.hash160 = hash160;
  }

  static decode(source: ResizableByteStream): StandardPrincipal {
    return new StandardPrincipal(
      source.readUint8(),
      source.readBytesAsHexString(20)
    );
  }
}

export class ContractName implements Encodeable {
  /* A 1-byte length of the contract name, up to 128 */
  readonly name_length: number;
  /* The contract name */
  readonly name: string;

  constructor(name_length: number, name: string) {
    this.name_length = name_length;
    this.name = name;
  }

  static decode(source: ResizableByteStream): ContractName {
    const len = source.readUint8();
    return new ContractName(
      len,
      source.readBytesAsBuffer(len).toString('ascii')
    );
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}

export class ContractPrincipal extends StandardPrincipal {
  /* The contract name */
  readonly name: ContractName;

  constructor(version: number, hash160: string, name: ContractName) {
    super(version, hash160);
    this.name = name;
  }

  static decode(source: ResizableByteStream): ContractPrincipal {
    return new ContractPrincipal(
      source.readUint8(),
      source.readBytesAsHexString(20),
      ContractName.decode(source)
    );
  }
}
