import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { CheckinFields } from '../types/checkin';
import { NetworkError, OFFLINE_EDIT_MESSAGE } from '../utils/errors';
import { useCreateCheckin, useDeleteCheckin, useUpdateCheckin } from './useCheckinMutations';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

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

describe('mutations with pending (offline) check-ins', () => {
  it('create: a pending result is already in the outbox, so it is not added to the server cache too', async () => {
    repository.create.mockResolvedValue(makeCheckin({ id: 'local_a', clientId: 'a', syncStatus: 'pending' }));
    const { result } = await renderHook(() => useCreateCheckin());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate(fields);
    });

    expect(ok).toBe(true);
    expect(store().items).toEqual([]);
  });

  it('update: an edited pending item is not copied into the server cache either', async () => {
    repository.update.mockResolvedValue(makeCheckin({ id: 'local_a', syncStatus: 'pending' }));
    const { result } = await renderHook(() => useUpdateCheckin('local_a'));

    await act(async () => {
      await result.current.mutate(fields);
    });

    expect(store().items).toEqual([]);
  });

  it('delete: offline on a synced item fails with the reason and never removes it, not even for a moment', async () => {
    const synced = makeCheckin({ id: 'ck_1' });
    store().upsert(synced);
    repository.assertEditable.mockImplementation(() => {
      throw new NetworkError(OFFLINE_EDIT_MESSAGE);
    });
    const changes: number[] = [];
    const stop = useCheckinsStore.subscribe((s) => changes.push(s.items.length));
    const { result } = await renderHook(() => useDeleteCheckin('ck_1'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.mutate();
    });
    stop();

    expect(ok).toBe(false);
    expect(result.current.error).toBe(OFFLINE_EDIT_MESSAGE);
    expect(repository.remove).not.toHaveBeenCalled();
    expect(changes).toEqual([]); // the store never changed
    expect(store().items).toEqual([synced]);
  });
});
