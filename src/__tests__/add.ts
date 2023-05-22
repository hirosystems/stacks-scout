import { PeerAddress } from '../peer-handler';
import { add, timeout } from '../util';

it('adds', () => {
  const result = add(1, 2);
  expect(result).toBe(3);
});

it('socket address', () => {
  const addr1 = new PeerAddress('1.2.3.4', 1234);
  const addr2 = new PeerAddress('1.2.3.4', 1234);
  expect(addr1).toBe(addr2);
});

it('timeout should reject when aborted with reason', async () => {
  const abortController = new AbortController();
  const abortError = new Error('test abort');
  const promise = timeout(1000, abortController.signal);
  setImmediate(() => abortController.abort(abortError));
  await expect(promise).rejects.toThrow(abortError);
});

it('timeout should reject when aborted without reason', async () => {
  const abortController = new AbortController();
  const promise = timeout(1000, abortController.signal);
  setImmediate(() => abortController.abort());
  await expect(promise).rejects.toThrow('This operation was aborted');
});

it('timeout should reject when already aborted', async () => {
  const abortController = new AbortController();
  abortController.abort();
  await new Promise(setImmediate);
  const promise = timeout(1000, abortController.signal);
  await expect(promise).rejects.toThrow('This operation was aborted');
});
