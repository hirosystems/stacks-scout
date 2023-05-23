import { Handshake } from '../message/handshake';
import { HandshakeAccept } from '../message/handshake-accept';
import { HandshakeReject } from '../message/handshake-reject';
import { Preamble } from '../message/preamble';
import { ResizableByteStream } from '../resizable-byte-stream';
import { PeerAddress } from '../message/peer-address';
import { NeighborAddress } from '../message/neighbor-address';
import { RelayData, RelayDataVec } from '../message/relay-data';
import { MessageSignature } from '../message/message-signature';
import { BurnchainHeaderHash } from '../message/burnchain-header-hash';
import { StacksMessageEnvelope } from '../message/stacks-message-envelope';

describe('p2p StacksMessage encoding', () => {
  it('should encode and decode a StacksMessageEnvelope', () => {
    const preamble = new Preamble(
      123,
      321,
      4,
      5n,
      new BurnchainHeaderHash('ff'.repeat(32)),
      6n,
      new BurnchainHeaderHash('ee'.repeat(32)),
      7,
      new MessageSignature('dd'.repeat(65)),
      8
    );
    const neighborAddress = new NeighborAddress(
      new PeerAddress('0f'.repeat(16)),
      4000,
      '0e'.repeat(20)
    );
    const relayData = new RelayData(neighborAddress, 455);
    const relayVec = new RelayDataVec([relayData]);
    const handshake = new Handshake(
      new PeerAddress('0d'.repeat(16)),
      5000,
      0,
      '0c'.repeat(33),
      50n,
      'http://test.local'
    );
    const envelope = new StacksMessageEnvelope(preamble, relayVec, handshake);

    const byteStream = new ResizableByteStream();
    envelope.encode(byteStream);
    byteStream.seek(0);

    const decodedEnvelope = StacksMessageEnvelope.decode(byteStream);
    expect(decodedEnvelope).toEqual(envelope);
  });

  it('should encode and decode handshake accept payload', () => {
    const handshake = new Handshake(
      new PeerAddress('0d'.repeat(16)),
      5000,
      0,
      '0c'.repeat(33),
      50n,
      'http://test.local'
    );
    const handshakeAccept = new HandshakeAccept(handshake, 1234);

    const byteStream = new ResizableByteStream();
    handshakeAccept.encode(byteStream);
    byteStream.seek(0);

    const decodedHandshakeAccept = HandshakeAccept.decode(byteStream);
    expect(decodedHandshakeAccept).toEqual(handshakeAccept);
  });

  it('should encode and decode handshake reject payload', () => {
    const handshakeReject = new HandshakeReject();

    const byteStream = new ResizableByteStream();
    handshakeReject.encode(byteStream);
    byteStream.seek(0);

    const decodedHandshakeReject = HandshakeReject.decode(byteStream);
    expect(decodedHandshakeReject).toEqual(handshakeReject);
  });
});
