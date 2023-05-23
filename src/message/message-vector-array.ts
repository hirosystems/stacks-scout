import { ResizableByteStream } from '../resizable-byte-stream';
import type { Encodeable } from '../stacks-p2p-deser';

/**
 * Vectors are encoded as length-prefixed arrays. The first 4 bytes of a vector are a
 * scalar that encodes the vector's length. As such, a vector may not have more than
 * 2^32 - 1 items. Vectors are recursively defined in terms of other scalars, byte
 * buffers, vectors, and typed containers.
 */
export class MessageVectorArray<T extends Encodeable>
  extends Array<T>
  implements Encodeable
{
  constructor(items?: T[]) {
    if (typeof items === 'undefined') {
      super();
    } else {
      super(items.length);
      for (let i = 0; i < items.length; i++) {
        this[i] = items[i];
      }
    }
  }
  decode(
    source: ResizableByteStream,
    element: { decode: (source: ResizableByteStream) => T }
  ) {
    const len = source.readUint32();
    this.length = len;
    for (let i = 0; i < len; i++) {
      this[i] = element.decode(source);
    }
    return this;
  }
  encode(target: ResizableByteStream): void {
    target.writeUint32(this.length);
    for (let i = 0; i < this.length; i++) {
      this[i].encode(target);
    }
  }
}
