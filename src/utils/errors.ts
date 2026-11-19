/** The server answered with an error status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    // Keeps `instanceof` working when classes are compiled down to ES5-style functions.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The request never reached the server (offline, timeout, dropped connection). Safe to retry. */
export class NetworkError extends Error {
  constructor(message = 'No connection. Check your network and try again.') {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'NetworkError';
  }
}

/** The requested resource does not exist (404). */
export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

// What React Native's fetch throws when the network is down.
const FETCH_NETWORK_FAILURE = /network request failed|failed to fetch|network error/i;

/** True for failures that mean "offline", as opposed to "the server said no". */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof TypeError && FETCH_NETWORK_FAILURE.test(error.message);
}
