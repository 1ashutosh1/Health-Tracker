import { ApiError, NetworkError, NotFoundError } from './errors';
import { isRetryableError, withRetry } from './retry';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Starts withRetry and records how it ends, so a test can advance fake timers in between. */
function track<T>(promise: Promise<T>) {
  const outcome: { value?: T; error?: unknown; settled: boolean } = { settled: false };
  promise.then(
    (value) => Object.assign(outcome, { value, settled: true }),
    (error: unknown) => Object.assign(outcome, { error, settled: true }),
  );
  return outcome;
}

describe('isRetryableError', () => {
  it('retries network failures and 5xx', () => {
    expect(isRetryableError(new NetworkError())).toBe(true);
    expect(isRetryableError(new TypeError('Network request failed'))).toBe(true);
    expect(isRetryableError(new ApiError(500, 'boom'))).toBe(true);
    expect(isRetryableError(new ApiError(503, 'unavailable'))).toBe(true);
  });

  it('does not retry 404, other 4xx or unknown errors', () => {
    expect(isRetryableError(new NotFoundError())).toBe(false);
    expect(isRetryableError(new ApiError(401, 'no'))).toBe(false);
    expect(isRetryableError(new ApiError(422, 'bad'))).toBe(false);
    expect(isRetryableError(new Error('bug'))).toBe(false);
    expect(isRetryableError('string')).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the value without waiting when the first try works', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits 500ms then 1000ms between tries (exponential backoff)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError())
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValue('ok');
    const outcome = track(withRetry(fn));

    await jest.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    expect(outcome).toMatchObject({ settled: true, value: 'ok' });
  });

  it('gives up after `retries` extra tries and throws the last error', async () => {
    const last = new ApiError(500, 'still down');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError())
      .mockRejectedValueOnce(new NetworkError())
      .mockRejectedValue(last);
    const outcome = track(withRetry(fn, { retries: 2 }));

    await jest.advanceTimersByTimeAsync(500 + 1000);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(outcome.settled).toBe(true);
    expect(outcome.error).toBe(last);
  });

  it('does not retry a NotFoundError', async () => {
    const error = new NotFoundError();
    const fn = jest.fn().mockRejectedValue(error);
    const outcome = track(withRetry(fn));

    await jest.advanceTimersByTimeAsync(10_000);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(outcome.error).toBe(error);
  });

  it('does not retry a 4xx', async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError(401, 'Unauthorized'));
    const outcome = track(withRetry(fn));

    await jest.advanceTimersByTimeAsync(10_000);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(outcome.settled).toBe(true);
  });

  it('with retries: 0 it only tries once', async () => {
    const fn = jest.fn().mockRejectedValue(new NetworkError());
    const outcome = track(withRetry(fn, { retries: 0 }));

    await jest.advanceTimersByTimeAsync(10_000);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(outcome.settled).toBe(true);
  });

  it('honours a custom baseDelayMs', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new NetworkError()).mockResolvedValue('ok');
    track(withRetry(fn, { baseDelayMs: 100 }));

    await jest.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honours a custom shouldRetry', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('flaky')).mockResolvedValue('ok');
    const outcome = track(withRetry(fn, { shouldRetry: () => true }));

    await jest.advanceTimersByTimeAsync(500);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(outcome.value).toBe('ok');
  });
});
