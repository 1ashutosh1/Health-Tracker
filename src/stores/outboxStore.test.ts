import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../storage/keys';
import { makeCheckin } from '../test-utils/makeCheckin';
import { useOutboxStore } from './outboxStore';

const state = () => useOutboxStore.getState();
const pending = (clientId: string) => makeCheckin({ id: `local_${clientId}`, clientId, syncStatus: 'pending' });

beforeEach(() => {
  state().reset();
});

describe('add / remove', () => {
  it('keeps items in the order they were added', () => {
    state().add(pending('a'));
    state().add(pending('b'));
    expect(state().items.map((c) => c.clientId)).toEqual(['a', 'b']);
  });

  it('removes by clientId and ignores unknown ones', () => {
    state().add(pending('a'));
    state().add(pending('b'));
    state().remove('a');
    state().remove('nope');
    expect(state().items.map((c) => c.clientId)).toEqual(['b']);
  });
});

describe('update', () => {
  it('changes the fields and refreshes updatedAt, keeping the ids', () => {
    state().add({ ...pending('a'), weightKg: 70, updatedAt: '2026-01-01T00:00:00.000Z' });

    const updated = state().update('a', { weightKg: 68 });

    expect(updated).toMatchObject({ id: 'local_a', clientId: 'a', weightKg: 68, syncStatus: 'pending' });
    expect(updated?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    expect(state().items[0]).toEqual(updated);
  });

  it('can clear the notes', () => {
    state().add({ ...pending('a'), notes: 'hello' });
    state().update('a', { notes: undefined });
    expect(state().items[0].notes).toBeUndefined();
  });

  it('turns a failed item back into a clean pending one, so editing it fixes it up for the next sync', () => {
    state().add(pending('a'));
    state().markFailed([{ clientId: 'a', error: 'Server error', attempts: 3, nextRetryAt: 99 }]);

    const updated = state().update('a', { steps: 1 });

    expect(updated).toMatchObject({ syncStatus: 'pending' });
    expect(updated).not.toHaveProperty('syncError');
    expect(updated).not.toHaveProperty('syncAttempts');
    expect(updated).not.toHaveProperty('nextRetryAt');
  });

  it('returns null for an item that is not there', () => {
    expect(state().update('nope', { steps: 1 })).toBeNull();
  });
});

describe('markFailed / markSynced', () => {
  it('records the failure on the item, leaving the others alone', () => {
    state().add(pending('a'));
    state().add(pending('b'));

    state().markFailed([{ clientId: 'a', error: 'Server error', attempts: 2, nextRetryAt: 123 }]);

    expect(state().items[0]).toMatchObject({
      syncStatus: 'failed',
      syncError: 'Server error',
      syncAttempts: 2,
      nextRetryAt: 123,
    });
    expect(state().items[1].syncStatus).toBe('pending');
  });

  it('markSynced removes a whole batch in one state change', () => {
    state().add(pending('a'));
    state().add(pending('b'));
    state().add(pending('c'));
    const listener = jest.fn();
    const unsubscribe = useOutboxStore.subscribe(listener);

    state().markSynced(['a', 'c']);
    unsubscribe();

    expect(state().items.map((c) => c.clientId)).toEqual(['b']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does nothing (and does not notify) for an empty batch', () => {
    const listener = jest.fn();
    const unsubscribe = useOutboxStore.subscribe(listener);

    state().markSynced([]);
    state().markFailed([]);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('notice and reset', () => {
  it('remembers how many were synced until dismissed', () => {
    state().setLastSynced(2);
    expect(state().lastSynced?.count).toBe(2);
    state().dismissLastSynced();
    expect(state().lastSynced).toBeNull();
  });

  it('reset empties the outbox and the sync flags', () => {
    state().add(pending('a'));
    state().setSyncing(true);
    state().setLastSynced(1);

    state().reset();

    expect(state()).toMatchObject({ items: [], isSyncing: false, lastSynced: null });
  });
});

describe('persistence', () => {
  /** Empties the store and waits for its own write to storage, so a test can then put its own data there. */
  async function resetAndSettle() {
    state().reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('writes only the items to storage, so a restart keeps pending check-ins but not transient flags', async () => {
    state().add(pending('a'));
    state().setSyncing(true);

    // zustand writes to storage asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.outbox);

    const saved = JSON.parse(raw ?? '{}') as { state: Record<string, unknown>; version: number };
    expect(saved.version).toBe(1);
    expect(Object.keys(saved.state)).toEqual(['items']);
    expect(saved.state.items).toHaveLength(1);
  });

  it('reads items back from storage on rehydrate', async () => {
    await resetAndSettle();
    await AsyncStorage.setItem(
      STORAGE_KEYS.outbox,
      JSON.stringify({ state: { items: [pending('saved')] }, version: 1 }),
    );

    await useOutboxStore.persist.rehydrate();

    expect(state().items.map((c) => c.clientId)).toEqual(['saved']);
    expect(state().hasHydrated).toBe(true);
  });

  it('starts empty, and still finishes hydrating, when the saved data is corrupt', async () => {
    await resetAndSettle();
    await AsyncStorage.setItem(STORAGE_KEYS.outbox, JSON.stringify({ state: { items: 'garbage' }, version: 1 }));

    await useOutboxStore.persist.rehydrate();

    expect(state().items).toEqual([]);
    expect(state().hasHydrated).toBe(true);
  });
});
