import { ResizableByteStream } from '../resizable-byte-stream';
import {
  StacksMessageTypedContainer,
  StacksMessageContainerTypeID,
  Encodeable,
} from '../stacks-p2p-deser';
import { PeerAddress } from './peer-address';

export class Handshake implements StacksMessageTypedContainer, Encodeable {
  static readonly containerType = StacksMessageContainerTypeID.Handshake;
  readonly containerType = Handshake.containerType;

  /** Address of the peer sending the handshake */
  readonly addrbytes: PeerAddress;
  /** (u16) */
  readonly port: number;
  /**
   * (u16) Bit field of services this peer offers.
   * Supported bits:
   * -- SERVICE_RELAY = 0x0001 -- must be set if the node relays messages for other nodes.
   */
  readonly services: number;
  /**
   * (33-bytes, hex encoded) This peer's public key
   */
  readonly node_public_key: string;
  /** (u64) Burn chain block height at which this key will expire */
  readonly expire_block_height: bigint;
  /**
   * (ASCII string that encodes a URL, 1-byte length prefix, string's bytes as-is)
   * HTTP(S) URL to where this peer's block data can be fetched
   */
  readonly data_url: string;

  constructor(
    addrbytes: PeerAddress,
    port: number,
    services: number,
    node_public_key: string,
    expire_block_height: bigint,
    data_url: string
  ) {
    if (node_public_key.length !== 66) {
      throw new Error('node_public_key must be a 33 byte hex string');
    }
    this.addrbytes = addrbytes;
    this.port = port;
    this.services = services;
    this.node_public_key = node_public_key;
    this.expire_block_height = expire_block_height;
    this.data_url = data_url;
  }
  static decode(source: ResizableByteStream): Handshake {
    if (source.readUint8() !== this.containerType) {
      throw new Error('Invalid container type');
    }
    return new Handshake(
      PeerAddress.decode(source),
      source.readUint16(),
      source.readUint16(),
      source.readBytesAsHexString(33),
      source.readUint64(),
      source.readBytesAsAsciiString(source.readUint8())
    );
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.addrbytes.encode(target);
    target.writeUint16(this.port);
    target.writeUint16(this.services);
    target.writeBytesFromHexString(this.node_public_key);
    target.writeUint64(this.expire_block_height);
    target.writeUint8(this.data_url.length);
    target.writeBytesFromAsciiString(this.data_url);
  }
}
