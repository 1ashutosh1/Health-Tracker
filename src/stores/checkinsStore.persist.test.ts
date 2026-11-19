import AsyncStorage from '@react-native-async-storage/async-storage';

import * as checkinRepository from '../services/checkinRepository';
import { STORAGE_KEYS } from '../storage/keys';
import { makeCheckin } from '../test-utils/makeCheckin';
import { ApiError, NetworkError } from '../utils/errors';
import { useCheckinsStore } from './checkinsStore';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const state = () => useCheckinsStore.getState();
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function readSaved() {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.checkinsCache);
  return JSON.parse(raw ?? 'null') as { state: Record<string, unknown>; version: number } | null;
}

beforeEach(async () => {
  // Not resetAllMocks(): that would also wipe the in-memory AsyncStorage mock these tests rely on.
  repository.getAll.mockReset();
  state().reset();
  await settle();
});

describe('saving the cache', () => {
  it('writes the items, lastFetchedAt and owner (version 1), and nothing else', async () => {
    repository.getAll.mockResolvedValue([makeCheckin({ id: 'ck_1' })]);

    await state().fetchAll('u1');
    await settle();
    const saved = await readSaved();

    expect(saved?.version).toBe(1);
    expect(Object.keys(saved?.state ?? {}).sort()).toEqual(['items', 'lastFetchedAt', 'ownerUserId']);
    expect(saved?.state).toMatchObject({ ownerUserId: 'u1' });
    expect(saved?.state.items).toHaveLength(1);
  });

  it('logging out clears the saved copy too', async () => {
    repository.getAll.mockResolvedValue([makeCheckin()]);
    await state().fetchAll('u1');

    state().reset();
    await settle();

    expect((await readSaved())?.state).toEqual({ items: [], lastFetchedAt: null, ownerUserId: null });
  });
});

describe('loading the cache', () => {
  const saved = [makeCheckin({ id: 'ck_saved' })];

  async function seed(value: unknown) {
    // Any state change makes the store write itself to storage, so let that happen before seeding.
    useCheckinsStore.setState({ hasHydrated: false });
    await settle();
    await AsyncStorage.setItem(STORAGE_KEYS.checkinsCache, JSON.stringify(value));
    await useCheckinsStore.persist.rehydrate();
  }

  it('restores items, lastFetchedAt and owner, and sets hasHydrated', async () => {
    await seed({ state: { items: saved, lastFetchedAt: 123, ownerUserId: 'u1' }, version: 1 });

    expect(state()).toMatchObject({ items: saved, lastFetchedAt: 123, ownerUserId: 'u1', hasHydrated: true });
  });

  it('does not restore request state: a restart never starts "loading" or showing an old error', async () => {
    await seed({ state: { items: saved, lastFetchedAt: 123, ownerUserId: 'u1', status: 'error', error: 'old' }, version: 1 });

    expect(state()).toMatchObject({ status: 'idle', error: null, errorIsNetwork: false });
  });

  it('ignores a corrupt cache, starts empty and still reports hasHydrated', async () => {
    await seed({ state: { items: 'garbage' }, version: 1 });

    expect(state()).toMatchObject({ items: [], lastFetchedAt: null, ownerUserId: null, hasHydrated: true });
  });

  it('keeps hasHydrated through a logout', () => {
    useCheckinsStore.setState({ hasHydrated: true });

    state().reset();

    expect(state().hasHydrated).toBe(true);
  });
});

describe('failed requests keep the saved copy', () => {
  it('a network failure marks the error as a network one and keeps the items and lastFetchedAt', async () => {
    const items = [makeCheckin()];
    repository.getAll.mockResolvedValueOnce(items).mockRejectedValueOnce(new NetworkError());
    await state().fetchAll('u1');
    const fetchedAt = state().lastFetchedAt;

    await state().fetchAll('u1');

    expect(state()).toMatchObject({ status: 'error', errorIsNetwork: true, items, lastFetchedAt: fetchedAt });
  });

  it('a server failure is not flagged as a network one', async () => {
    repository.getAll.mockRejectedValue(new ApiError(500, 'Server error'));

    await state().fetchAll('u1');

    expect(state()).toMatchObject({ status: 'error', errorIsNetwork: false });
  });

  it('a later success clears the flag', async () => {
    repository.getAll.mockRejectedValueOnce(new NetworkError()).mockResolvedValue([]);
    await state().fetchAll('u1');

    await state().fetchAll('u1');

    expect(state()).toMatchObject({ status: 'success', errorIsNetwork: false });
  });
});

describe('upsertMany', () => {
  it('adds new items and replaces existing ones by id, in one state change', () => {
    const a = makeCheckin({ id: 'a', weightKg: 70 });
    state().upsert(a);
    const listener = jest.fn();
    const stop = useCheckinsStore.subscribe(listener);

    state().upsertMany([{ ...a, weightKg: 69 }, makeCheckin({ id: 'b' })]);
    stop();

    expect(state().items.map((c) => [c.id, c.weightKg])).toEqual([
      ['b', 70],
      ['a', 69],
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an empty batch', () => {
    const listener = jest.fn();
    const stop = useCheckinsStore.subscribe(listener);

    state().upsertMany([]);
    stop();

    expect(listener).not.toHaveBeenCalled();
  });

  it('makes an in-flight fetch ask again, like upsert does, so a synced item is not overwritten by an older response', async () => {
    const created = makeCheckin({ id: 'new' });
    let finishFirst!: (items: ReturnType<typeof makeCheckin>[]) => void;
    repository.getAll
      .mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce([created]);

    const done = state().fetchAll('u1');
    state().upsertMany([created]);
    finishFirst([]);
    await done;

    expect(repository.getAll).toHaveBeenCalledTimes(2);
    expect(state().items).toEqual([created]);
  });
});
