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
  readonly maxSize: number;
  private cursor = 0;

  constructor(initialSize = DEFAULT_INITIAL_SIZE, maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    // @ts-expect-error - maxByteLength is not in the types yet
    this.arrayBuffer = new ArrayBuffer(initialSize, { maxByteLength: maxSize });
    this.dataView = new DataView(this.arrayBuffer);
  }

  private growToFit(byteSize: number) {
    // Check if buffer is already able to fit the bytes
    if (this.cursor + byteSize <= this.arrayBuffer.byteLength) {
      return;
    }

    // Check if buffer can be resized to fit the bytes
    if (this.cursor + byteSize > this.maxSize) {
      throw new Error('ResizableByteStream exceeded maximum size');
    }

    const nextSize = Math.min(
      this.maxSize,
      Math.max(this.arrayBuffer.byteLength * 2, this.cursor + byteSize)
    );
    if (nextSize > this.maxSize) {
      throw new Error('ResizableByteStream already at maximum size');
    }
    // @ts-expect-error - resize is not in the types yet
    this.arrayBuffer.resize(nextSize);
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

  readUint8() {
    const value = this.dataView.getUint8(this.cursor);
    this.cursor += INT_SIZE.I8;
    return value;
  }

  readInt8() {
    const value = this.dataView.getInt8(this.cursor);
    this.cursor += INT_SIZE.I8;
    return value;
  }

  readUint16(littleEndian?: boolean) {
    const value = this.dataView.getUint16(this.cursor, littleEndian);
    this.cursor += INT_SIZE.I16;
    return value;
  }

  readInt16(littleEndian?: boolean) {
    const value = this.dataView.getInt16(this.cursor, littleEndian);
    this.cursor += INT_SIZE.I16;
    return value;
  }

  readUint32(littleEndian?: boolean) {
    const value = this.dataView.getUint32(this.cursor, littleEndian);
    this.cursor += INT_SIZE.I32;
    return value;
  }

  readInt32(littleEndian?: boolean) {
    const value = this.dataView.getInt32(this.cursor, littleEndian);
    this.cursor += INT_SIZE.I32;
    return value;
  }

  readUint64(littleEndian?: boolean) {
    const value = this.dataView.getBigUint64(this.cursor, littleEndian);
    this.cursor += INT_SIZE.I64;
    return value;
  }

  readInt64(littleEndian?: boolean) {
    const value = this.dataView.getBigInt64(this.cursor, littleEndian);
    this.cursor += INT_SIZE.I64;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const value = new Uint8Array(this.arrayBuffer, this.cursor, length);
    this.cursor += length;
    return value;
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
