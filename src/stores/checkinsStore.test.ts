import * as checkinRepository from '../services/checkinRepository';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError } from '../utils/errors';
import { useCheckinsStore } from './checkinsStore';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

/** A getAll() that stays pending until the test settles it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const state = () => useCheckinsStore.getState();

beforeEach(() => {
  jest.resetAllMocks();
  state().reset();
});

describe('fetchAll', () => {
  it('goes idle -> loading -> success and stores the items', async () => {
    const items = [makeCheckin(), makeCheckin()];
    const request = deferred<Checkin[]>();
    repository.getAll.mockReturnValue(request.promise);
    expect(state().status).toBe('idle');

    const done = state().fetchAll('u1');
    expect(state().status).toBe('loading');
    expect(state().lastFetchedAt).toBeNull();

    request.resolve(items);
    await done;

    expect(state()).toMatchObject({ status: 'success', error: null, ownerUserId: 'u1', items });
    expect(state().lastFetchedAt).not.toBeNull();
  });

  it('shares one request between concurrent callers', async () => {
    const request = deferred<Checkin[]>();
    repository.getAll.mockReturnValue(request.promise);

    const first = state().fetchAll('u1');
    const second = state().fetchAll('u1');
    request.resolve([]);
    await Promise.all([first, second]);

    expect(repository.getAll).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('allows a new request once the previous one finished', async () => {
    repository.getAll.mockResolvedValue([]);
    await state().fetchAll('u1');
    await state().fetchAll('u1');
    expect(repository.getAll).toHaveBeenCalledTimes(2);
  });

  it('stores a readable error and clears the in-flight request so Retry works', async () => {
    repository.getAll.mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValue([]);

    await state().fetchAll('u1');
    expect(state()).toMatchObject({ status: 'error', error: 'Server error', lastFetchedAt: null });

    await state().fetchAll('u1');
    expect(state()).toMatchObject({ status: 'success', error: null });
  });

  it('keeps the old items on screen when a refresh fails', async () => {
    const items = [makeCheckin()];
    repository.getAll.mockResolvedValueOnce(items).mockRejectedValueOnce(new ApiError(500, 'Server error'));

    await state().fetchAll('u1');
    const fetchedAt = state().lastFetchedAt;
    await state().fetchAll('u1');

    expect(state()).toMatchObject({ status: 'error', error: 'Server error', items });
    // Still marked stale-able: the failed refresh did not pretend to be a fresh fetch.
    expect(state().lastFetchedAt).toBe(fetchedAt);
  });

  it('ignores a result that arrives after logout', async () => {
    const request = deferred<Checkin[]>();
    repository.getAll.mockReturnValue(request.promise);

    const done = state().fetchAll('u1');
    state().reset(); // logout
    request.resolve([makeCheckin()]);
    await done;

    expect(state()).toMatchObject({ items: [], status: 'idle', ownerUserId: null, lastFetchedAt: null });
  });

  it('ignores an error that arrives after logout', async () => {
    const request = deferred<Checkin[]>();
    repository.getAll.mockReturnValue(request.promise);

    const done = state().fetchAll('u1');
    state().reset();
    request.reject(new ApiError(500, 'late failure'));
    await done;

    expect(state()).toMatchObject({ status: 'idle', error: null });
  });

  it("ignores user A's result when user B has signed in since", async () => {
    const forA = deferred<Checkin[]>();
    const forB = deferred<Checkin[]>();
    repository.getAll.mockReturnValueOnce(forA.promise).mockReturnValueOnce(forB.promise);
    const bItem = makeCheckin({ id: 'b1' });

    const a = state().fetchAll('userA');
    state().reset();
    const b = state().fetchAll('userB');
    // A's response lands late, B's lands after it.
    forA.resolve([makeCheckin({ id: 'a1' })]);
    await a;
    expect(state().items).toEqual([]);
    forB.resolve([bItem]);
    await b;

    expect(state().items).toEqual([bItem]);
    expect(state().ownerUserId).toBe('userB');
    expect(repository.getAll).toHaveBeenCalledTimes(2);
  });

  it('asks again once if the data changed locally while the request was running', async () => {
    const created = makeCheckin({ id: 'new' });
    const first = deferred<Checkin[]>();
    repository.getAll.mockReturnValueOnce(first.promise).mockResolvedValueOnce([created]);

    const done = state().fetchAll('u1');
    state().upsert(created); // the user saved a check-in while the list was loading
    first.resolve([]); // this response was produced before that save
    await done;

    expect(repository.getAll).toHaveBeenCalledTimes(2);
    expect(state().items).toEqual([created]);
  });
});

describe('upsert / removeLocal / reset', () => {
  it('upsert adds a new item at the top', () => {
    const a = makeCheckin({ id: 'a' });
    const b = makeCheckin({ id: 'b' });
    state().upsert(a);
    state().upsert(b);
    expect(state().items.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('upsert replaces an existing item in place', () => {
    const a = makeCheckin({ id: 'a', weightKg: 70 });
    const b = makeCheckin({ id: 'b' });
    state().upsert(a);
    state().upsert(b);
    state().upsert({ ...a, weightKg: 69 });
    expect(state().items.map((c) => [c.id, c.weightKg])).toEqual([
      ['b', 70],
      ['a', 69],
    ]);
  });

  it('removeLocal removes by id and ignores unknown ids', () => {
    state().upsert(makeCheckin({ id: 'a' }));
    state().upsert(makeCheckin({ id: 'b' }));
    state().removeLocal('a');
    state().removeLocal('nope');
    expect(state().items.map((c) => c.id)).toEqual(['b']);
  });

  it('reset returns to the starting state', async () => {
    repository.getAll.mockResolvedValue([makeCheckin()]);
    await state().fetchAll('u1');
    state().reset();
    expect(state()).toMatchObject({ items: [], status: 'idle', error: null, lastFetchedAt: null, ownerUserId: null });
  });
});
