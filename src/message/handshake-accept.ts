import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  Encodeable,
  StacksMessageContainerTypeID,
} from '../stacks-p2p-deser';
import { Handshake } from './handshake';

export class HandshakeAccept
  implements StacksMessageTypedContainer, Encodeable
{
  static readonly containerType = StacksMessageContainerTypeID.HandshakeAccept;
  readonly containerType = HandshakeAccept.containerType;

  /** The remote peer's handshake data */
  readonly handshake: Handshake;
  /**
   * (u32) Maximum number of seconds the recipient peer expects this peer
   * to wait between sending messages before the recipient will declare this peer as dead.
   */
  readonly heartbeat_interval: number;

  constructor(handshake: Handshake, heartbeat_interval: number) {
    this.handshake = handshake;
    this.heartbeat_interval = heartbeat_interval;
  }
  static decode(source: ResizableByteStream): HandshakeAccept {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new HandshakeAccept(Handshake.decode(source), source.readUint32());
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.handshake.encode(target);
    target.writeUint32(this.heartbeat_interval);
  }
}
