import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';
import { PeerAddress } from './peer-address';

export class NatPunchReply implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.NatPunchReply;
  readonly containerType = NatPunchReply.containerType;

  /** The public IP address, as reported by the remote peer */
  readonly addrbytes: PeerAddress;
  /** (u16) The public port */
  readonly port: number;
  /** (u32) The nonce from the paired NatPunchRequest */
  readonly nonce: number;

  constructor(addrbytes: PeerAddress, port: number, nonce: number) {
    this.addrbytes = addrbytes;
    this.port = port;
    this.nonce = nonce;
  }

  static decode(source: ResizableByteStream): NatPunchReply {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new NatPunchReply(
      PeerAddress.decode(source),
      source.readUint16(),
      source.readUint32()
    );
  }

  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.addrbytes.encode(target);
    target.writeUint16(this.port);
    target.writeUint32(this.nonce);
  }
}
