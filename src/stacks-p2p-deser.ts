import { ResizableByteStream } from './resizable-byte-stream';

/*
SIP-003:
https://github.com/stacksgov/sips/blob/main/sips/sip-003/sip-003-peer-network.md

All Stacks messages have three components:
  * A fixed-length preamble which describes some metadata about the peer's view of the network.
  * A variable-length but bound-sized relayers vector which describes the order of peers that relayed a message.
  * A variable-length payload, which encodes a specific peer message as a typed container.

All Stacks messages are represented as:
struct StacksMessage {
  pub preamble: Preamble,
  pub relayers: Vec<RelayData>,
  pub payload: StacksMessageType
}

The preamble has the following fields:
struct Preamble {
  /// A 4-byte scalar to encode the semantic version of this software.
  /// The only valid value is 0x15000000 (i.e. version 21.0.0.0).
  pub peer_version: u32,

  /// A 4-byte scalar to encode which network this peer belongs to.
  /// Valid values are:
  ///   0x15000000 -- this is "mainnet"
  ///   0x15000001 -- this is "testnet"
  pub network_id: u32,

  /// A 4-byte scalar to encode the message sequence number. A peer will
  /// maintain a sequence number for each neighbor it talks to, and will
  /// increment it each time it sends a new message (wrapping around if
  /// necessary).
  pub seq: u32,

  /// This is the height of the last burn chain block this peer processed.
  /// If the peer is all caught up, this is the height of the burn chain tip.
  pub burn_block_height: u64,

  /// This is the burn block hash calculated at the burn_block_height above.
  /// It uniquely identifies a burn chain block.
  pub burn_header_hash: BurnchainHeaderHash,

  /// This is the height of the last stable block height -- i.e. the largest
  /// block height at which a block can be considered stable in the burn
  /// chain history.  In Bitcoin, this is at least 7 blocks behind block_height.
  pub stable_burn_block_height: u64,

  /// This is the hash of the last stable block's header.
  pub stable_burn_header_hash: BurnchainHeaderHash,

  /// This is a pointer to additional data that follows the payload.
  /// This is a reserved field; for now, it should all be 0's.
  pub additional_data: u32,

  /// This is a signature over the entire message (preamble and payload).
  /// When generating this value, the signature bytes below must all be 0's.
  pub signature: MessageSignature;

  /// This is the length of the message payload.
  pub payload_len: u32;
}

A payload is a typed container, and may be any of the following enumerated types:
enum StacksMessageType {
  Handshake(HandshakeData),
  HandshakeAccept(HandshakeAcceptData),
  HandshakeReject,
  GetNeighbors,
  Neighbors(NeighborsData),
  GetBlocksInv(GetBlocksData),
  BlocksInv(BlocksInvData),
  GetPoxInv(GetPoxInv),
  PoxInv(PoxInvData),
  BlocksAvailable(BlocksAvailableData),
  MicroblocksAvailable(MicroblocksAvailableData),
  Blocks(BlocksData),
  Microblocks(MicroblocksData),
  Transaction(StacksTransaction),
  Nack(NackData),
  Ping,
  Pong
}
*/

interface Encodeable {
  /** Encode object _into_ the given target byte stream */
  encode(target: ResizableByteStream): void;
}

interface Decodeable<T> {
  /** Decode object _from_ the given source byte stream */
  new (source: ResizableByteStream): T;
}

/**
 * A scalar is a number represented by 1, 2, 4, or 8 bytes, and is unsigned. Scalars
 * requiring 2, 4, and 8 bytes are encoded in network byte order (i.e. big-endian).
 */
export const enum StacksMessageScalar {
  Bytes1,
  Bytes2,
  Bytes4,
  Bytes8,
}

/** Byte buffers of fixed length. Byte buffers have known length and are transmitted as-is. */
export interface StacksMessageByteBuffer {
  readonly messageByteLength: number;
}

/**
 * Vectors are encoded as length-prefixed arrays. The first 4 bytes of a vector are a scalar that encodes the vector's length.
 * Vectors are recursively defined in terms of other scalars, byte buffers, vectors, and typed containers.
 */
export interface StacksMessageVector<
  T extends StacksMessageType = StacksMessageType
> {
  readonly items: T[];
}

/** Encoded as 1-byte */
export const enum StacksMessageContainerTypeID {
  Handshake = 0,
  HandshakeAccept = 1,
  HandshakeReject = 2,
  GetNeighbors = 3,
  Neighbors = 4,
  GetBlocksInv = 5,
  BlocksInv = 6,
  GetPoxInv = 7,
  PoxInv = 8,
  BlocksAvailable = 9,
  MicroblocksAvailable = 10,
  Blocks = 11,
  Microblocks = 12,
  Transaction = 13,
  Nack = 14,
  Ping = 15,
  Pong = 16,
  NatPunchRequest = 17,
  NatPunchReply = 18,
}

/**
 * Typed containers of variable length.
 * A typed container is encoded as a 1-byte type identifier, followed by zero or more encoded structures. Typed
 * containers are used in practice to encode type variants, such as types of message payloads or types of
 * transactions. Typed containers are recursively-defined in terms of other scalars, byte buffers, vectors,
 * and type containers. Unlike a vector, there is no length field for a typed container -- the parser will begin
 * consuming the container's items immediately following the 1-byte type identifier.
 */
export abstract class StacksMessageTypedContainer implements Encodeable {
  abstract encode(target: ResizableByteStream): void;
  abstract readonly containerType: StacksMessageContainerTypeID;
  static decode(source: ResizableByteStream): StacksMessageTypedContainer {
    const typeID: StacksMessageContainerTypeID = source.readUint8();
    switch (typeID) {
      case StacksMessageContainerTypeID.Handshake:
        return HandshakeData.decode(source);
      case StacksMessageContainerTypeID.HandshakeAccept:
        return HandshakeAccept.decode(source);
      case StacksMessageContainerTypeID.HandshakeReject:
        return HandshakeReject.decode(source);
      default:
        throw new Error(`Unknown container type ID: ${typeID}`);
    }
  }
}

export type StacksMessageType =
  | StacksMessageScalar
  | StacksMessageByteBuffer
  | StacksMessageVector
  | StacksMessageTypedContainer;

/**
 * This is called just "StacksMessage" in the SIP, using "envelope" for disambiguation.
 * All Stacks messages are represented as:
 */
export class StacksMessageEnvelope implements Encodeable {
  /** A fixed-length preamble which describes some metadata about the peer's view of the network. */
  readonly preamble: Preamble;
  /** A variable-length but bound-sized relayers vector which describes the order of peers that relayed a message. */
  readonly relayers: RelayDataVec;
  /** A variable-length payload, which encodes a specific peer message as a typed container. */
  readonly payload: StacksMessageTypedContainer;

  constructor(
    preamble: Preamble,
    relayers: RelayDataVec,
    payload: StacksMessageTypedContainer
  ) {
    this.preamble = preamble;
    this.relayers = relayers;
    this.payload = payload;
  }
  static decode(source: ResizableByteStream): StacksMessageEnvelope {
    return new StacksMessageEnvelope(
      Preamble.decode(source),
      RelayDataVec.decode(source),
      StacksMessageTypedContainer.decode(source)
    );
  }
  encode(target: ResizableByteStream): void {
    this.preamble.encode(target);
    this.relayers.encode(target);
    this.payload.encode(target);
  }
}

export class Preamble implements Encodeable {
  /**
   * (u32)
   * A 4-byte scalar to encode the semantic version of this software.
   * The only valid value is 0x15000000 (i.e. version 21.0.0.0).
   */
  readonly peer_version: number;
  /**
   * (u32)
   * A 4-byte scalar to encode which network this peer belongs to.
   * Valid values are:
   *   0x15000000 -- this is "mainnet"
   *   0x15000001 -- this is "testnet"
   */
  readonly network_id: number;
  /**
   * (u32)
   * A 4-byte scalar to encode the message sequence number. A peer will
   * maintain a sequence number for each neighbor it talks to, and will
   * increment it each time it sends a new message (wrapping around if
   * necessary).
   */
  readonly seq: number;
  /**
   * (u64)
   * This is the height of the last burn chain block this peer processed.
   * If the peer is all caught up, this is the height of the burn chain tip.
   */
  readonly burn_block_height: bigint;
  /**
   * This is the burn block hash calculated at the burn_block_height above.
   * It uniquely identifies a burn chain block.`
   */
  readonly burn_header_hash: BurnchainHeaderHash;
  /**
   * (u64)
   * This is the height of the last stable block height -- i.e. the largest
   * block height at which a block can be considered stable in the burn
   * chain history.  In Bitcoin, this is at least 7 blocks behind block_height.
   */
  readonly stable_burn_block_height: bigint;
  /**
   * This is the hash of the last stable block's header.
   */
  readonly stable_burn_header_hash: BurnchainHeaderHash;
  /**
   * (u32) This is a pointer to additional data that follows the payload.
   * This is a reserved field; for now, it should all be 0's.
   */
  readonly additional_data: number;
  /**
   * This is a signature over the entire message (preamble and payload).
   * When generating this value, the signature bytes below must all be 0's.
   */
  readonly signature: MessageSignature;
  /**
   * (u32) This is the length of the message payload.
   */
  readonly payload_len: number;

  constructor(
    peer_version: number,
    network_id: number,
    seq: number,
    burn_block_height: bigint,
    burn_header_hash: BurnchainHeaderHash,
    stable_burn_block_height: bigint,
    stable_burn_header_hash: BurnchainHeaderHash,
    additional_data: number,
    signature: MessageSignature,
    payload_len: number
  ) {
    this.peer_version = peer_version;
    this.network_id = network_id;
    this.seq = seq;
    this.burn_block_height = burn_block_height;
    this.burn_header_hash = burn_header_hash;
    this.stable_burn_block_height = stable_burn_block_height;
    this.stable_burn_header_hash = stable_burn_header_hash;
    this.additional_data = additional_data;
    this.signature = signature;
    this.payload_len = payload_len;
  }
  static decode(source: ResizableByteStream): Preamble {
    return new Preamble(
      source.readUint32(),
      source.readUint32(),
      source.readUint32(),
      source.readUint64(),
      BurnchainHeaderHash.decode(source),
      source.readUint64(),
      BurnchainHeaderHash.decode(source),
      source.readUint32(),
      MessageSignature.decode(source),
      source.readUint32()
    );
  }
  encode(target: ResizableByteStream): void {
    target.writeUint32(this.peer_version);
    target.writeUint32(this.network_id);
    target.writeUint32(this.seq);
    target.writeUint64(this.burn_block_height);
    this.burn_header_hash.encode(target);
    target.writeUint64(this.stable_burn_block_height);
    this.stable_burn_header_hash.encode(target);
    target.writeUint32(this.additional_data);
    this.signature.encode(target);
    target.writeUint32(this.payload_len);
  }
}

/** This is a container for the hash of a burn chain block header, encoded as a 32-byte cryptographic hash. */
export class BurnchainHeaderHash implements Encodeable {
  /** (32 bytes, hex encoded) */
  readonly hash: string;

  constructor(hash: string) {
    if (hash.length !== 64) {
      throw new Error('BurnchainHeaderHash must be a 32 byte hex string');
    }
    this.hash = hash;
  }
  static decode(source: ResizableByteStream): BurnchainHeaderHash {
    return new BurnchainHeaderHash(source.readBytesAsHexString(32));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.hash);
  }
}

/**
 * This is a fixed-length container for storing a recoverable secp256k1 signature. The first byte is the recovery
 * code; the next 32 bytes are the r parameter, and the last 32 bytes are the s parameter. Because there are up to
 * two valid signature values for a secp256k1 curve, only the signature with the lower value for s will be accepted.
 */
export class MessageSignature implements Encodeable {
  /** (65-bytes, hex encoded) */
  readonly signature: string;

  constructor(signature: string) {
    if (signature.length !== 130) {
      throw new Error('MessageSignature must be a 65 byte hex string');
    }
    this.signature = signature;
  }
  static decode(source: ResizableByteStream): MessageSignature {
    return new MessageSignature(source.readBytesAsHexString(65));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.signature);
  }
}

export class RelayData implements Encodeable {
  /** The peer that relayed a message */
  readonly peer: NeighborAddress;
  /** (u32) The sequence number of that message */
  readonly seq: number;

  constructor(peer: NeighborAddress, seq: number) {
    this.peer = peer;
    this.seq = seq;
  }
  static decode(source: ResizableByteStream): RelayData {
    return new RelayData(NeighborAddress.decode(source), source.readUint32());
  }
  encode(target: ResizableByteStream): void {
    this.peer.encode(target);
    target.writeUint32(this.seq);
  }
}

export class RelayDataVec extends Array<RelayData> implements Encodeable {
  constructor(items: RelayData[]) {
    super(items.length);
    for (let i = 0; i < items.length; i++) {
      this[i] = items[i];
    }
  }
  static decode(source: ResizableByteStream): RelayDataVec {
    const length = source.readUint32();
    const items: RelayData[] = new Array(length);
    for (let i = 0; i < length; i++) {
      items[i] = RelayData.decode(source);
    }
    return new RelayDataVec(items);
  }
  encode(target: ResizableByteStream): void {
    target.writeUint32(this.length);
    for (let i = 0; i < this.length; i++) {
      this[i].encode(target);
    }
  }
}
export class NeighborAddress implements Encodeable {
  /** The IPv4 or IPv6 address of this peer */
  readonly addrbytes: PeerAddress;
  /** (u16) The port this peer listens on */
  readonly port: number;
  /**
   * (20-bytes, hex encoded)
   * The RIPEMD160-SHA256 hash of the node's public key.
   * If this structure is used to advertise knowledge of another peer,
   * then this field _may_ be used as a hint to tell the receiver which
   * public key to expect when it establishes a connection.
   */
  readonly public_key_hash: string;

  constructor(addrbytes: PeerAddress, port: number, public_key_hash: string) {
    if (public_key_hash.length !== 40) {
      throw new Error('public_key_hash must be a 20 byte hex string');
    }
    this.addrbytes = addrbytes;
    this.port = port;
    this.public_key_hash = public_key_hash;
  }
  static decode(source: ResizableByteStream): NeighborAddress {
    return new NeighborAddress(
      PeerAddress.decode(source),
      source.readUint16(),
      source.readBytesAsHexString(20)
    );
  }
  encode(target: ResizableByteStream): void {
    this.addrbytes.encode(target);
    target.writeUint16(this.port);
    target.writeBytesFromHexString(this.public_key_hash);
  }
}

/** This is a fixed-length container for an IPv4 or an IPv6 address. */
export class PeerAddress implements Encodeable {
  // TODO: this is a hex encoded string but should be human-readable IP address string
  /** (16-byted) fixed-length container for an IPv4 or an IPv6 address. */
  readonly ip_address: string;

  constructor(ip_address: string) {
    if (ip_address.length !== 32) {
      throw new Error('ip_address must be a 16 byte hex string for now');
    }
    this.ip_address = ip_address;
  }
  static decode(source: ResizableByteStream): PeerAddress {
    return new PeerAddress(source.readBytesAsHexString(16));
  }
  encode(target: ResizableByteStream): void {
    target.writeBytesFromHexString(this.ip_address);
  }
}

export class HandshakeData implements StacksMessageTypedContainer, Encodeable {
  readonly containerType = StacksMessageContainerTypeID.Handshake;

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
  static decode(source: ResizableByteStream): HandshakeData {
    return new HandshakeData(
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

export class HandshakeAccept
  implements StacksMessageTypedContainer, Encodeable
{
  readonly containerType = StacksMessageContainerTypeID.HandshakeAccept;

  /** The remote peer's handshake data */
  readonly handshake: HandshakeData;
  /**
   * (u32) Maximum number of seconds the recipient peer expects this peer
   * to wait between sending messages before the recipient will declare this peer as dead.
   */
  readonly heartbeat_interval: number;

  constructor(handshake: HandshakeData, heartbeat_interval: number) {
    this.handshake = handshake;
    this.heartbeat_interval = heartbeat_interval;
  }
  static decode(source: ResizableByteStream): HandshakeAccept {
    return new HandshakeAccept(
      HandshakeData.decode(source),
      source.readUint32()
    );
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
    this.handshake.encode(target);
    target.writeUint32(this.heartbeat_interval);
  }
}

export class HandshakeReject
  implements StacksMessageTypedContainer, Encodeable
{
  readonly containerType = StacksMessageContainerTypeID.HandshakeReject;

  static decode(source: ResizableByteStream): HandshakeReject {
    return new HandshakeReject();
  }
  encode(target: ResizableByteStream): void {
    target.writeUint8(this.containerType);
  }
}
