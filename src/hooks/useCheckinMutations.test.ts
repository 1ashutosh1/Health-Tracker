import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin, CheckinFields } from '../types/checkin';
import { ApiError, NetworkError, NotFoundError } from '../utils/errors';
import { useCreateCheckin, useDeleteCheckin, useUpdateCheckin } from './useCheckinMutations';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fields: CheckinFields = {
  weightKg: 72,
  heightCm: 175,
  sleepHours: 7,
  steps: 5000,
  waterLitres: 2,
  mood: 'happy',
  notes: undefined,
  checkinDate: '2026-11-19',
};

const store = () => useCheckinsStore.getState();

beforeEach(() => {
  jest.resetAllMocks();
  store().reset();
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('useCreateCheckin', () => {
  it('saves, adds the new check-in to the store and resolves true', async () => {
    const saved = makeCheckin({ id: 'ck_new' });
    repository.create.mockResolvedValue(saved);
    const { result } = await renderHook(() => useCreateCheckin());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate(fields);
    });

    expect(ok).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(fields);
    expect(store().items).toEqual([saved]);
    expect(result.current).toMatchObject({ isSubmitting: false, error: null });
  });

  it('sends one request for a fast double tap and shows isSubmitting meanwhile', async () => {
    const request = deferred<Checkin>();
    repository.create.mockReturnValue(request.promise);
    const { result } = await renderHook(() => useCreateCheckin());

    let results!: Promise<boolean[]>;
    await act(async () => {
      results = Promise.all([result.current.mutate(fields), result.current.mutate(fields)]);
    });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      request.resolve(makeCheckin());
      await results;
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(store().items).toHaveLength(1); // not two
    await expect(results).resolves.toEqual([true, false]); // the duplicate is reported as "not saved by this call"
  });

  it('on failure: resolves false, exposes the message, stores nothing, and allows Retry', async () => {
    repository.create.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(makeCheckin({ id: 'ck_ok' }));
    const { result } = await renderHook(() => useCreateCheckin());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate(fields);
    });
    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/connection/i);
    expect(store().items).toEqual([]);

    await act(async () => {
      ok = await result.current.mutate(fields);
    });
    expect(ok).toBe(true);
    expect(result.current.error).toBeNull(); // a new attempt clears the old error
  });

  it('reset() clears the error', async () => {
    repository.create.mockRejectedValue(new ApiError(500, 'Server error'));
    const { result } = await renderHook(() => useCreateCheckin());
    await act(async () => {
      await result.current.mutate(fields);
    });
    expect(result.current.error).toBe('Server error');

    await act(async () => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it('does not put the result in the store if the user signed out while saving', async () => {
    const request = deferred<Checkin>();
    repository.create.mockReturnValue(request.promise);
    const { result } = await renderHook(() => useCreateCheckin());

    let done!: Promise<boolean>;
    await act(async () => {
      done = result.current.mutate(fields);
    });
    useAuthStore.setState({ status: 'signedOut', user: null });
    await act(async () => {
      request.resolve(makeCheckin());
      await done;
    });

    expect(store().items).toEqual([]);
  });
});

describe('useUpdateCheckin', () => {
  it('sends the changes and replaces the item in the store', async () => {
    const original = makeCheckin({ id: 'ck_1', weightKg: 70 });
    const updated = { ...original, weightKg: 72 };
    store().upsert(original);
    repository.update.mockResolvedValue(updated);
    const { result } = await renderHook(() => useUpdateCheckin('ck_1'));

    await act(async () => {
      await result.current.mutate(fields);
    });

    expect(repository.update).toHaveBeenCalledWith('ck_1', expect.objectContaining({ weightKg: 72 }));
    expect(store().items).toEqual([updated]);
  });

  it('always sends `notes`, so clearing the notes box really clears them', async () => {
    repository.update.mockResolvedValue(makeCheckin({ id: 'ck_1' }));
    const { result } = await renderHook(() => useUpdateCheckin('ck_1'));

    await act(async () => {
      await result.current.mutate({ ...fields, notes: undefined });
    });

    const [, changes] = repository.update.mock.calls[0];
    expect(Object.keys(changes)).toContain('notes');
  });

  it('keeps the store untouched when the update fails', async () => {
    const original = makeCheckin({ id: 'ck_1', weightKg: 70 });
    store().upsert(original);
    repository.update.mockRejectedValue(new ApiError(500, 'Server error'));
    const { result } = await renderHook(() => useUpdateCheckin('ck_1'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate(fields);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Server error');
    expect(store().items).toEqual([original]);
  });
});

describe('useDeleteCheckin', () => {
  it('removes the item at once (optimistic), before the server answers', async () => {
    const item = makeCheckin({ id: 'ck_1' });
    const other = makeCheckin({ id: 'ck_2' });
    store().upsert(item);
    store().upsert(other);
    const request = deferred<void>();
    repository.remove.mockReturnValue(request.promise);
    const { result } = await renderHook(() => useDeleteCheckin('ck_1'));

    let done!: Promise<boolean>;
    await act(async () => {
      done = result.current.mutate();
    });

    expect(store().items.map((c) => c.id)).toEqual(['ck_2']); // already gone, server still pending
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      request.resolve();
      await done;
    });
    await expect(done).resolves.toBe(true);
    expect(store().items.map((c) => c.id)).toEqual(['ck_2']);
  });

  it('puts the item back and shows the error when the server refuses', async () => {
    const item = makeCheckin({ id: 'ck_1' });
    store().upsert(item);
    repository.remove.mockRejectedValue(new ApiError(500, 'Could not delete'));
    const { result } = await renderHook(() => useDeleteCheckin('ck_1'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate();
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Could not delete');
    expect(store().items).toEqual([item]);
  });

  it('treats "already deleted" (404) as success and does not restore', async () => {
    store().upsert(makeCheckin({ id: 'ck_1' }));
    repository.remove.mockRejectedValue(new NotFoundError());
    const { result } = await renderHook(() => useDeleteCheckin('ck_1'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate();
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(store().items).toEqual([]);
  });

  it('sends one delete for a double tap', async () => {
    store().upsert(makeCheckin({ id: 'ck_1' }));
    const request = deferred<void>();
    repository.remove.mockReturnValue(request.promise);
    const { result } = await renderHook(() => useDeleteCheckin('ck_1'));

    let all!: Promise<boolean[]>;
    await act(async () => {
      all = Promise.all([result.current.mutate(), result.current.mutate()]);
    });
    await act(async () => {
      request.resolve();
      await all;
    });

    expect(repository.remove).toHaveBeenCalledTimes(1);
  });
});
