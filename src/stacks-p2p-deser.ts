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

export interface MessageEncodeable {
  /** Encode object _into_ the given target byte stream */
  encode(target: ResizableByteStream): void;
}

export interface MessageDecodeable {
  /** Decode object _from_ the given source byte stream */
  new (source: ResizableByteStream): this;
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
export interface StacksMessageTypedContainer {
  readonly containerType: StacksMessageContainerTypeID;
}

export type StacksMessageType =
  | StacksMessageScalar
  | StacksMessageByteBuffer
  | StacksMessageTypedContainer;

/**
 * This is called just "StacksMessage" in the SIP, using "envelope" for disambiguation.
 * All Stacks messages are represented as:
 */
export interface StacksMessageEnvelope {
  readonly preamble: Preamble;
  readonly relayers: RelayData[];
  readonly payload: StacksMessageType;
}

export interface Preamble {
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
}

/** This is a container for the hash of a burn chain block header, encoded as a 32-byte cryptographic hash. */
export interface BurnchainHeaderHash {
  /** (32 bytes, hex encoded) */
  readonly hash: string;
}

/**
 * This is a fixed-length container for storing a recoverable secp256k1 signature. The first byte is the recovery
 * code; the next 32 bytes are the r parameter, and the last 32 bytes are the s parameter. Because there are up to
 * two valid signature values for a secp256k1 curve, only the signature with the lower value for s will be accepted.
 */
export interface MessageSignature {
  /** (65-bytes, hex encoded) */
  readonly signature: string;
}

export interface RelayData {
  /** The peer that relayed a message */
  readonly peer: NeighborAddress;
  /** (u32) The sequence number of that message */
  readonly seq: number;
}

export interface NeighborAddress {
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
}

/** This is a fixed-length container for an IPv4 or an IPv6 address. */
export interface PeerAddress {
  /** (16-byted) fixed-length container for an IPv4 or an IPv6 address. */
  readonly ip_address: string;
}

export interface HandshakeData extends StacksMessageTypedContainer {
  readonly containerType: StacksMessageContainerTypeID.Handshake;

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
}

export interface HandshakeAccept extends StacksMessageTypedContainer {
  readonly containerType: StacksMessageContainerTypeID.HandshakeAccept;

  /** The remote peer's handshake data */
  readonly handshake: HandshakeData;
  /**
   * (u32) Maximum number of seconds the recipient peer expects this peer
   * to wait between sending messages before the recipient will declare this peer as dead.
   */
  readonly heartbeat_interval: number;
}

export interface HandshakeReject extends StacksMessageTypedContainer {
  readonly containerType: StacksMessageContainerTypeID.HandshakeReject;
}
