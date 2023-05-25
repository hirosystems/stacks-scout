import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';

export class Asset implements Encodeable {
  /** The standard principal's 1-byte version */
  readonly version: number;
  /** The standard principal's 20-byte Hash160 */
  readonly hash160: string;
  /* A 1-byte length of the contract name, up to 128 */
  readonly contract_name_length: number;
  /* The contract name */
  readonly contract_name: string;
  /* A 1-byte length of the asset name */
  readonly asset_name_length: number;
  /* The asset name */
  readonly asset_name: string;

  constructor(
    version: number,
    hash160: string,
    contract_name_length: number,
    contract_name: string,
    asset_name_length: number,
    asset_name: string
  ) {
    this.version = version;
    this.hash160 = hash160;
    this.contract_name_length = contract_name_length;
    this.contract_name = contract_name;
    this.asset_name_length = asset_name_length;
    this.asset_name = asset_name;
  }

  static decode(source: ResizableByteStream): Asset {
    const version = source.readUint8();
    const hash160 = source.readBytesAsHexString(20);
    const c_len = source.readUint8();
    const c_name = source.readBytesAsHexString(c_len);
    const a_len = source.readUint8();
    const a_name = source.readBytesAsHexString(a_len);
    return new Asset(version, hash160, c_len, c_name, a_len, a_name);
  }

  encode(target: ResizableByteStream): void {
    throw new Error('Method not implemented.');
  }
}
