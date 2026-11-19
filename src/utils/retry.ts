import { ApiError, isNetworkError } from './errors';

export interface RetryOptions {
  /** How many times to try again after the first failure. */
  retries?: number;
  /** Wait before the first retry. It doubles each time: 500, 1000, 2000... */
  baseDelayMs?: number;
  /** Decides whether a failure is worth another try. `attempt` is 0 for the first retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Worth retrying: the request never arrived (offline, dropped) or the server itself failed (5xx).
 * Not worth retrying: 404 and other 4xx, because the same request would fail the same way,
 * and unknown errors, which are probably bugs.
 */
export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  return error instanceof ApiError && error.status >= 500;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `fn`, and if it fails with a retryable error, runs it again after an exponentially growing wait. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 500, shouldRetry = isRetryableError }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error, attempt)) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}
