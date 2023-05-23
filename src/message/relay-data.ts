import { MessageVectorArray } from './message-vector-array';
import { ResizableByteStream } from '../resizable-byte-stream';
import { Encodeable } from '../stacks-p2p-deser';
import { NeighborAddress } from './neighbor-address';

export class RelayDataVec extends MessageVectorArray<RelayData> {
  constructor(items?: RelayData[]) {
    super(items);
  }
  static decode(source: ResizableByteStream): RelayDataVec {
    return new this().decode(source, RelayData);
  }
}

export class RelayData implements Encodeable {
  /** The peer that relayed a message */
  readonly peer: NeighborAddress;
  /** (u32) The sequence number of that message */
  readonly seq: number;

  constructor(peer: NeighborAddress, seq: number) {
    this.peer = peer;
    this.seq = seq;
  }
  static decode(source: ResizableByteStream): RelayData {
    return new RelayData(NeighborAddress.decode(source), source.readUint32());
  }
  encode(target: ResizableByteStream): void {
    this.peer.encode(target);
    target.writeUint32(this.seq);
  }
}
