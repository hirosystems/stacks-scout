import * as net from 'node:net';
import { PeerDirection, StacksPeer } from '../peer-handler';
import { Preamble } from '../message/preamble';
import { BurnchainHeaderHash } from '../message/burnchain-header-hash';
import { MessageSignature } from '../message/message-signature';
import { NeighborAddress } from '../message/neighbor-address';
import { PeerAddress } from '../message/peer-address';
import { RelayDataVec } from '../message/relay-data';
import { Handshake } from '../message/handshake';
import { StacksMessageEnvelope } from '../message/stacks-message-envelope';
import { ResizableByteStream } from '../resizable-byte-stream';
import { StacksPeerMetrics } from '../server/prometheus-server';
import { HandshakeData } from '../message/handshake-data';

function createTestHandshakeMessage() {
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
    new PeerAddress('127.0.0.1'),
    4000,
    '0e'.repeat(20)
  );
  const relayVec = new RelayDataVec([]);
  const handshake = new Handshake(
    new HandshakeData(
      new PeerAddress('127.0.0.1'),
      5000,
      0,
      '0c'.repeat(33),
      50n,
      'http://test.local'
    )
  );
  const envelope = new StacksMessageEnvelope(preamble, relayVec, handshake);
  const privKey = Buffer.from(
    '8c45db8322f3f8e36389bc4e6091e82060ed2d0db7d8ac6858cc3e90a6639715',
    'hex'
  );
  envelope.sign(privKey);
  return envelope;
}

async function createTestSocket() {
  const server = net.createServer().unref();
  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen({ host: 'localhost', port: 0 }, resolve);
  });
  const port = (server.address() as net.AddressInfo).port;

  const [readerSocket, writerSocket] = await new Promise<
    [net.Socket, net.Socket]
  >((resolve, reject) => {
    server.on('connection', (reader) => resolve([reader.unref(), writer]));
    const writer = net
      .createConnection({ host: 'localhost', port })
      .on('error', reject)
      .unref();
  });
  return { server, readerSocket, writerSocket };
}

async function writeSocketFlushed(socket: net.Socket, data: Buffer) {
  const flushed = await new Promise((resolve, reject) => {
    const flushed = socket.write(data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(flushed);
      }
    });
  });
  if (!flushed) {
    await new Promise((resolve) => {
      socket.once('drain', resolve);
    });
  }
}

describe('peer socket reading', () => {
  it('should read exactly one message sent at a time', async () => {
    const { server, readerSocket, writerSocket } = await createTestSocket();
    const peer = new StacksPeer(
      readerSocket,
      PeerDirection.Inbound,
      StacksPeerMetrics.instance
    );

    const msg = createTestHandshakeMessage();
    const msgByteStream = new ResizableByteStream();
    msg.encode(msgByteStream);
    msgByteStream.seek(0);
    const msgBuffer = msgByteStream.readBytesAsBufferCopied(
      msgByteStream.byteLength
    );

    // Write 3 messages to the socket, each in a separate write call that contains the whole message in one chunk
    for (let i = 0; i < 3; i++) {
      // write to writerSocket and ensure data is flushed
      await writeSocketFlushed(writerSocket, msgBuffer);
      // read from peer and ensure message is received
      const recvMsg = await new Promise((resolve) => {
        peer.once('messageReceived', resolve);
      });
      expect(recvMsg).toEqual(msg);
    }

    writerSocket.destroy();
    readerSocket.destroy();
    server.close();
  });

  it('should ready multiple messages sent in one chunk', async () => {
    const { server, readerSocket, writerSocket } = await createTestSocket();
    const peer = new StacksPeer(
      readerSocket,
      PeerDirection.Inbound,
      StacksPeerMetrics.instance
    );

    const msg = createTestHandshakeMessage();
    const msgByteStream = new ResizableByteStream();
    // write 3 messages to the byte stream
    for (let i = 0; i < 3; i++) {
      msg.encode(msgByteStream);
    }
    msgByteStream.seek(0);
    const msgBuffer = msgByteStream.readBytesAsBufferCopied(
      msgByteStream.byteLength
    );

    // write chunk containing multiple message to writerSocket and ensure data is flushed
    await writeSocketFlushed(writerSocket, msgBuffer);
    let chunksRead = 0;
    readerSocket.on('data', (data) => {
      chunksRead++;
    });

    // ensure peer reads all 3 messages
    const msgs = await new Promise((resolve) => {
      const msgs: StacksMessageEnvelope[] = [];
      peer.on('messageReceived', (msg) => {
        msgs.push(msg);
        if (msgs.length === 3) {
          resolve(msgs);
        }
      });
    });
    expect(msgs).toEqual([msg, msg, msg]);
    expect(chunksRead).toBe(1);
    writerSocket.destroy();
    readerSocket.destroy();
    server.close();
  });

  it('should read a message that is sent in multiple chunks', async () => {
    const { server, readerSocket, writerSocket } = await createTestSocket();
    writerSocket.setNoDelay(true);

    const peer = new StacksPeer(
      readerSocket,
      PeerDirection.Inbound,
      StacksPeerMetrics.instance
    );

    const msg = createTestHandshakeMessage();
    const msgByteStream = new ResizableByteStream();
    msg.encode(msgByteStream);
    msgByteStream.seek(0);
    const msgBuffer = msgByteStream.readBytesAsBufferCopied(
      msgByteStream.byteLength
    );

    // Break the message up into 3 chunks and write each chunk to writerSocket.
    // First chunk doesn't have the full preamble so it should be cached until the next chunk is received
    const chunk1 = msgBuffer.subarray(0, 10);
    // second chunk has the full preamble so at least the fully payload size should be known
    const chunk2 = msgBuffer.subarray(10, Preamble.BYTE_SIZE);
    // third chunk has the full payload so the message should be fully readable
    const chunk3 = msgBuffer.subarray(Preamble.BYTE_SIZE);

    // write each chunk, and ensure data is read in chunks
    await writeSocketFlushed(writerSocket, chunk1);
    await new Promise((resolve) => readerSocket.once('data', resolve));
    await writeSocketFlushed(writerSocket, chunk2);
    await new Promise((resolve) => readerSocket.once('data', resolve));
    await writeSocketFlushed(writerSocket, chunk3);

    // read from peer and ensure message is received
    const recvMsg = await new Promise((resolve) => {
      peer.once('messageReceived', resolve);
    });
    expect(recvMsg).toEqual(msg);

    writerSocket.destroy();
    readerSocket.destroy();
    server.close();
  });
});
