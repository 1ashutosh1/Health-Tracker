import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '../utils/errors';
import { useAuthStore } from '../stores/authStore';
import { useLogin } from './useLogin';

const credentials = { email: 'demo@health.app', password: 'Password123' };

afterEach(() => {
  useAuthStore.setState({ login: originalLogin });
});
const originalLogin = useAuthStore.getState().login;

/** A login that stays "in flight" until the test resolves or rejects it. */
function deferredLogin() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const login = jest.fn(() => promise);
  useAuthStore.setState({ login });
  return { login, resolve, reject };
}

describe('useLogin', () => {
  it('sends one request however many times it is called while submitting', async () => {
    const { login, resolve } = deferredLogin();
    const { result } = await renderHook(() => useLogin());

    // Three synchronous calls, like a fast triple tap: state has not re-rendered in between.
    let all!: Promise<unknown>;
    await act(async () => {
      all = Promise.all([result.current.login(credentials), result.current.login(credentials), result.current.login(credentials)]);
    });

    expect(login).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolve();
      await all;
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes the server error message and unlocks so the user can retry', async () => {
    const { login, reject } = deferredLogin();
    const { result } = await renderHook(() => useLogin());

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.login(credentials);
    });
    await act(async () => {
      reject(new ApiError(401, 'Incorrect email or password'));
      await first;
    });

    expect(result.current.error).toBe('Incorrect email or password');
    expect(result.current.isSubmitting).toBe(false);

    // Retry is allowed again, and a new attempt clears the old error.
    login.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.login(credentials);
    });
    expect(login).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it('reset() clears the error', async () => {
    const { reject } = deferredLogin();
    const { result } = await renderHook(() => useLogin());

    let attempt!: Promise<void>;
    await act(async () => {
      attempt = result.current.login(credentials);
    });
    await act(async () => {
      reject(new ApiError(500, 'Server down'));
      await attempt;
    });
    expect(result.current.error).toBe('Server down');

    await act(async () => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
