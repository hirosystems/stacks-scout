import { RelayData } from './message/relay-data';
import { BlocksInv } from './message/blocks-inv';
import { GetBlocksInv } from './message/get-blocks-inv';
import { GetNeighbors } from './message/get-neighbors';
import { Handshake } from './message/handshake';
import { HandshakeAccept } from './message/handshake-accept';
import { HandshakeReject } from './message/handshake-reject';
import { MessageVectorArray } from './message/message-vector-array';
import { Neighbors } from './message/neighbors';
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

export interface Encodeable {
  /** Encode object _into_ the given target byte stream */
  encode(target: ResizableByteStream): void;
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
    const typeID: StacksMessageContainerTypeID = source.peekUint8();
    switch (typeID) {
      case StacksMessageContainerTypeID.Handshake:
        return Handshake.decode(source);
      case StacksMessageContainerTypeID.HandshakeAccept:
        return HandshakeAccept.decode(source);
      case StacksMessageContainerTypeID.HandshakeReject:
        return HandshakeReject.decode(source);
      case StacksMessageContainerTypeID.GetNeighbors:
        return GetNeighbors.decode(source);
      case StacksMessageContainerTypeID.Neighbors:
        return Neighbors.decode(source);
      case StacksMessageContainerTypeID.GetBlocksInv:
        return GetBlocksInv.decode(source);
      case StacksMessageContainerTypeID.BlocksInv:
        return BlocksInv.decode(source);
      default:
        throw new Error(`Unknown container type ID: ${typeID}`);
    }
  }
}
