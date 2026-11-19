import { ApiError, getErrorMessage, isNetworkError, NetworkError, NotFoundError } from './errors';

describe('error classes', () => {
  it('ApiError carries the HTTP status and works with instanceof', () => {
    const error = new ApiError(500, 'Server exploded');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toBe('Server exploded');
    expect(error.name).toBe('ApiError');
  });

  it('NotFoundError is a 404 ApiError', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.status).toBe(404);
    expect(error.name).toBe('NotFoundError');
  });

  it('NetworkError has a default message and is not an ApiError', () => {
    const error = new NetworkError();
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.message).not.toBe('');
  });
});

describe('isNetworkError', () => {
  it('is true for NetworkError', () => {
    expect(isNetworkError(new NetworkError())).toBe(true);
  });

  it('is true for the TypeError that fetch throws when offline', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('is false for server errors, including 404', () => {
    expect(isNetworkError(new ApiError(500, 'boom'))).toBe(false);
    expect(isNetworkError(new NotFoundError())).toBe(false);
  });

  it('is false for unrelated errors and non-errors', () => {
    expect(isNetworkError(new TypeError('x is not a function'))).toBe(false);
    expect(isNetworkError(new Error('Network request failed'))).toBe(false);
    expect(isNetworkError('Network request failed')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('uses the message of API and network errors', () => {
    expect(getErrorMessage(new ApiError(401, 'Incorrect email or password'))).toBe('Incorrect email or password');
    expect(getErrorMessage(new NetworkError('Offline'))).toBe('Offline');
  });

  it('turns a raw fetch failure into the friendly network message', () => {
    expect(getErrorMessage(new TypeError('Network request failed'))).toBe(new NetworkError().message);
  });

  it('hides unknown errors behind the fallback', () => {
    expect(getErrorMessage(new Error('undefined is not a function'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getErrorMessage('boom', 'Custom fallback')).toBe('Custom fallback');
  });
});
