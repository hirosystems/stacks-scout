import { ResizableByteStream } from '../resizable-byte-stream';
import {
  BurnchainHeaderHash,
  HandshakeData,
  MessageSignature,
  NeighborAddress,
  PeerAddress,
  Preamble,
  RelayData,
  RelayDataVec,
  StacksMessageEnvelope,
} from '../stacks-p2p-deser';

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
    const handshake = new HandshakeData(
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
    const encodedLength = byteStream.position;
    expect(encodedLength).toBeGreaterThan(1);
    byteStream.seek(0);

    const decodedEnvelope = StacksMessageEnvelope.decode(byteStream);
    expect(decodedEnvelope).toEqual(envelope);
  });
});
