// Max size is 32 megabytes by default
const DEFAULT_MAX_SIZE = 32 * 1024 * 1024;

// Initial size is 500 kilobytes by default
const DEFAULT_INITIAL_SIZE = 500 * 1024;

const enum INT_SIZE {
  I8 = 1,
  I16 = 2,
  I32 = 4,
  I64 = 8,
}

export class ResizableByteStream {
  readonly arrayBuffer: ArrayBuffer;
  private dataView: DataView;
  private cursor = 0;

  constructor(initialSize = DEFAULT_INITIAL_SIZE, maxSize = DEFAULT_MAX_SIZE) {
    // @ts-expect-error - maxByteLength is not in the types yet
    this.arrayBuffer = new ArrayBuffer(initialSize, { maxByteLength: maxSize });
    this.dataView = new DataView(this.arrayBuffer);
  }

  private growToFit(byteSize: number) {
    const requiredSize = this.cursor + byteSize;
    // Check if buffer is already able to fit the bytes
    if (requiredSize <= this.arrayBuffer.byteLength) {
      return;
    }

    // Double the size each time we need to grow
    let nextSize = this.arrayBuffer.byteLength * 2;
    if (nextSize < requiredSize) {
      nextSize = requiredSize;
    }

    // @ts-expect-error - resize is not in the types yet
    this.arrayBuffer.resize(nextSize);
  }

  get maxByteSize() {
    // @ts-expect-error - maxByteLength is not in the types yet
    return this.arrayBuffer.maxByteLength;
  }

  get position() {
    return this.cursor;
  }

  seek(offset: number) {
    this.cursor = offset;
  }

  writeUint8(value: number) {
    this.growToFit(INT_SIZE.I8);
    this.dataView.setUint8(this.cursor, value);
    this.cursor += INT_SIZE.I8;
  }

  writeInt8(value: number) {
    this.growToFit(INT_SIZE.I8);
    this.dataView.setInt8(this.cursor, value);
    this.cursor += INT_SIZE.I8;
  }

  writeUint16(value: number, littleEndian?: boolean) {
    this.growToFit(INT_SIZE.I16);
    this.dataView.setUint16(this.cursor, value, littleEndian);
    this.cursor += INT_SIZE.I16;
  }

  writeInt16(value: number, littleEndian?: boolean) {
    this.growToFit(INT_SIZE.I16);
    this.dataView.setInt16(this.cursor, value, littleEndian);
    this.cursor += INT_SIZE.I16;
  }

  writeUint32(value: number, littleEndian?: boolean) {
    this.growToFit(INT_SIZE.I32);
    this.dataView.setUint32(this.cursor, value, littleEndian);
    this.cursor += INT_SIZE.I32;
  }

  writeInt32(value: number, littleEndian?: boolean) {
    this.growToFit(INT_SIZE.I32);
    this.dataView.setInt32(this.cursor, value, littleEndian);
    this.cursor += INT_SIZE.I32;
  }

  writeUint64(value: bigint, littleEndian?: boolean) {
    this.growToFit(INT_SIZE.I64);
    this.dataView.setBigUint64(this.cursor, value, littleEndian);
    this.cursor += INT_SIZE.I64;
  }

  writeInt64(value: bigint, littleEndian?: boolean) {
    this.growToFit(INT_SIZE.I64);
    this.dataView.setBigInt64(this.cursor, value, littleEndian);
    this.cursor += INT_SIZE.I64;
  }

  writeBytes(bytes: Uint8Array | ArrayBuffer) {
    const buff = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.growToFit(buff.byteLength);
    new Uint8Array(this.arrayBuffer, this.cursor).set(buff);
    this.cursor += buff.byteLength;
  }

  writeBytesFromHexString(hex: string) {
    this.writeBytes(Buffer.from(hex, 'hex'));
  }

  writeBytesFromAsciiString(str: string) {
    this.writeBytes(Buffer.from(str, 'ascii'));
  }

  peekUint8() {
    return this.dataView.getUint8(this.cursor);
  }

  readUint8() {
    const value = this.peekUint8();
    this.cursor += INT_SIZE.I8;
    return value;
  }

  peekInt8() {
    return this.dataView.getInt8(this.cursor);
  }

  readInt8() {
    const value = this.peekInt8();
    this.cursor += INT_SIZE.I8;
    return value;
  }

  peekUint16(littleEndian?: boolean) {
    return this.dataView.getUint16(this.cursor, littleEndian);
  }

  readUint16(littleEndian?: boolean) {
    const value = this.peekUint16(littleEndian);
    this.cursor += INT_SIZE.I16;
    return value;
  }

  peekInt16(littleEndian?: boolean) {
    return this.dataView.getInt16(this.cursor, littleEndian);
  }

  readInt16(littleEndian?: boolean) {
    const value = this.peekInt16(littleEndian);
    this.cursor += INT_SIZE.I16;
    return value;
  }

  peekUint32(littleEndian?: boolean) {
    return this.dataView.getUint32(this.cursor, littleEndian);
  }

  readUint32(littleEndian?: boolean) {
    const value = this.peekUint32(littleEndian);
    this.cursor += INT_SIZE.I32;
    return value;
  }

  peekInt32(littleEndian?: boolean) {
    return this.dataView.getInt32(this.cursor, littleEndian);
  }

  readInt32(littleEndian?: boolean) {
    const value = this.peekInt32(littleEndian);
    this.cursor += INT_SIZE.I32;
    return value;
  }

  peekUint64(littleEndian?: boolean) {
    return this.dataView.getBigUint64(this.cursor, littleEndian);
  }

  readUint64(littleEndian?: boolean) {
    const value = this.peekUint64(littleEndian);
    this.cursor += INT_SIZE.I64;
    return value;
  }

  peekInt64(littleEndian?: boolean) {
    return this.dataView.getBigInt64(this.cursor, littleEndian);
  }

  readInt64(littleEndian?: boolean) {
    const value = this.peekInt64(littleEndian);
    this.cursor += INT_SIZE.I64;
    return value;
  }

  peekBytes(length: number): Uint8Array {
    return new Uint8Array(this.arrayBuffer, this.cursor, length);
  }

  readBytes(length: number): Uint8Array {
    const value = this.peekBytes(length);
    this.cursor += length;
    return value;
  }

  /** Same as `readBytes` but creates a copy in memory */
  readBytesCopied(length: number): Uint8Array {
    const value = this.readBytes(length);
    return new Uint8Array(value);
  }

  readBytesAsHexString(length: number): string {
    const value = this.readBytes(length);
    return Buffer.from(
      value.buffer,
      value.byteOffset,
      value.byteLength
    ).toString('hex');
  }

  readBytesAsAsciiString(length: number): string {
    const value = this.readBytes(length);
    return Buffer.from(
      value.buffer,
      value.byteOffset,
      value.byteLength
    ).toString('ascii');
  }

  // Return a Nodejs Buffer without any copies
  asBuffer(): Buffer {
    return Buffer.from(this.arrayBuffer, 0, this.cursor);
  }

  // toString should return the hex representation of the buffer
  toString(): string {
    return this.asBuffer().toString('hex');
  }

  toHex(): string {
    return '0x' + this.asBuffer().toString('hex');
  }
}
