import { ResizableByteStream } from '../../resizable-byte-stream';
import { Encodeable } from '../../stacks-p2p-deser';

export class StacksTransactionPayload implements Encodeable {
  static decode(source: ResizableByteStream): StacksTransactionPayload {
    throw new Error('Not implemented');
  }
  encode(target: ResizableByteStream): void {
    throw new Error('Not implemented');
  }
}
