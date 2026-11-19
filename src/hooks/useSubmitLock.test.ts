import { act, renderHook } from '@testing-library/react-native';

import { useSubmitLock } from './useSubmitLock';

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useSubmitLock', () => {
  it('runs fn once however many times run() is called before it finishes', async () => {
    const { result } = await renderHook(() => useSubmitLock());
    const pending = deferred();
    const fn = jest.fn(() => pending.promise);

    let all!: Promise<unknown>;
    await act(async () => {
      // Synchronous, like a fast triple tap: React has not re-rendered in between.
      all = Promise.all([result.current.run(fn), result.current.run(fn), result.current.run(fn)]);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      pending.resolve('done');
      await all;
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('returns the result of fn, and undefined for a call that was ignored', async () => {
    const { result } = await renderHook(() => useSubmitLock());
    const pending = deferred();

    let first!: Promise<string | undefined>;
    let second!: Promise<string | undefined>;
    await act(async () => {
      first = result.current.run(() => pending.promise);
      second = result.current.run(() => Promise.resolve('ignored'));
    });
    await act(async () => {
      pending.resolve('saved');
      await first;
    });

    await expect(first).resolves.toBe('saved');
    await expect(second).resolves.toBeUndefined();
  });

  it('unlocks after fn throws, so the user can try again', async () => {
    const { result } = await renderHook(() => useSubmitLock());

    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });
    expect(result.current.isSubmitting).toBe(false);

    const retry = jest.fn(() => Promise.resolve('ok'));
    await act(async () => {
      await result.current.run(retry);
    });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('allows a second run after the first has finished', async () => {
    const { result } = await renderHook(() => useSubmitLock());
    const fn = jest.fn(() => Promise.resolve('ok'));

    await act(async () => {
      await result.current.run(fn);
      await result.current.run(fn);
    });

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
