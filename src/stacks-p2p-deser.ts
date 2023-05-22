/*

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

/*
struct StacksMessage {
  pub preamble: Preamble,
  pub relayers: Vec<RelayData>,
  pub payload: StacksMessageType
}
*/

export interface Preamble {
  readonly peer_version: number;
  readonly network_id: number;
  readonly seq: number;
  readonly burn_block_height: bigint;
  readonly burn_header_hash: string;
  readonly stable_burn_block_height: bigint;
  readonly stable_burn_header_hash: string;
  readonly additional_data: number;
  readonly signature: string;
  readonly payload_len: number;
}

export interface RelayData {
  readonly ip_addr: string;
  readonly port: number;
}

export interface HandshakeData {
  readonly nonce: string;
  readonly peer_id: string;
  readonly user_agent: string;
  readonly version: string;
}

export type StacksMessageType = string;

export interface StacksMessage {
  readonly preamble: Preamble;
  readonly relayers: RelayData[];
  readonly payload: StacksMessageType;
}
