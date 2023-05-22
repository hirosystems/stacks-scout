import { ResizableByteStream } from '../resizable-byte-stream';
import { INT } from '../util';

describe('ResizableByteStream', () => {
  it('write buffer exact fit', () => {
    const buff = new ResizableByteStream(4, 4);
    buff.writeBytes(Buffer.from('01020304', 'hex'));
    const result = buff.toString();
    expect(result).toBe('01020304');
  });

  it('write buffer grow to fit', () => {
    const buff = new ResizableByteStream(0, 4);
    buff.writeBytes(Buffer.from('01020304', 'hex'));
    const result = buff.toString();
    expect(result).toBe('01020304');
  });

  it('write buffer too large', () => {
    const buff = new ResizableByteStream(0, 4);
    expect(() => {
      buff.writeBytes(Buffer.from('0102030405', 'hex'));
    }).toThrow();
  });

  it('write-read i8', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeInt8(INT.MIN_I8);
    expect(bytes.position).toBe(1);
    bytes.seek(0);
    expect(bytes.readInt8()).toBe(INT.MIN_I8);
  });

  it('write-read u8', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeUint8(INT.MAX_U8);
    expect(bytes.position).toBe(1);
    bytes.seek(0);
    expect(bytes.readUint8()).toBe(INT.MAX_U8);
  });

  it('write-read i16', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeInt16(INT.MIN_I16);
    expect(bytes.position).toBe(2);
    bytes.seek(0);
    expect(bytes.readInt16()).toBe(INT.MIN_I16);
  });

  it('write-read u16', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeUint16(INT.MAX_U16);
    expect(bytes.position).toBe(2);
    bytes.seek(0);
    expect(bytes.readUint16()).toBe(INT.MAX_U16);
  });

  it('write-read i32', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeInt32(INT.MIN_I32);
    expect(bytes.position).toBe(4);
    bytes.seek(0);
    expect(bytes.readInt32()).toBe(INT.MIN_I32);
  });

  it('write-read u32', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeUint32(INT.MAX_U32);
    expect(bytes.position).toBe(4);
    bytes.seek(0);
    expect(bytes.readUint32()).toBe(INT.MAX_U32);
  });

  it('write-read i64', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeInt64(INT.MIN_I64);
    expect(bytes.position).toBe(8);
    bytes.seek(0);
    expect(bytes.readInt64()).toBe(INT.MIN_I64);
  });

  it('write-read u64', () => {
    const bytes = new ResizableByteStream(0);
    bytes.writeUint64(INT.MAX_U64);
    expect(bytes.position).toBe(8);
    bytes.seek(0);
    expect(bytes.readUint64()).toBe(INT.MAX_U64);
  });

  it('write-read bytes as hex string', () => {
    const hexStr = '010203040506';
    const bytes = new ResizableByteStream(0);
    bytes.writeBytesFromHexString(hexStr);
    expect(bytes.position).toBe(hexStr.length / 2);
    bytes.seek(0);
    expect(bytes.readBytesAsHexString(hexStr.length / 2)).toBe(hexStr);
  });

  it('write-read bytes as ascii string', () => {
    const asciiStr = 'hello world';
    const bytes = new ResizableByteStream(0);
    bytes.writeBytesFromAsciiString(asciiStr);
    expect(bytes.position).toBe(asciiStr.length);
    bytes.seek(0);
    expect(bytes.readBytesAsAsciiString(asciiStr.length)).toBe(asciiStr);
  });
});
