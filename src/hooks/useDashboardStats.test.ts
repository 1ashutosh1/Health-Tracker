import { act, renderHook } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { useDashboardStats } from './useDashboardStats';

jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const first = makeCheckin({ id: 'ck_1', checkinDate: '2026-01-01', weightKg: 78 });
const second = makeCheckin({ id: 'ck_2', checkinDate: '2026-02-01', weightKg: 75 });

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('useDashboardStats', () => {
  it('derives stats from the loaded check-ins', async () => {
    repository.getAll.mockResolvedValue([first, second]);

    const { result } = await renderHook(() => useDashboardStats());
    await act(async () => {});

    expect(result.current.status).toBe('success');
    expect(result.current.stats).toMatchObject({ starting: 78, current: 75, difference: -3, trend: 'down', total: 2 });
  });

  it('reports empty stats (not an error) for a user with no check-ins', async () => {
    repository.getAll.mockResolvedValue([]);

    const { result } = await renderHook(() => useDashboardStats());
    await act(async () => {});

    expect(result.current.status).toBe('success');
    expect(result.current.stats).toMatchObject({ total: 0, current: null, trend: null, history: [] });
  });

  it('follows the store: add, edit and delete update the stats with no refetch', async () => {
    repository.getAll.mockResolvedValue([first]);
    const { result } = await renderHook(() => useDashboardStats());
    await act(async () => {});
    expect(result.current.stats).toMatchObject({ current: 78, difference: 0, trend: 'same' });

    await act(async () => useCheckinsStore.getState().upsert(second));
    expect(result.current.stats).toMatchObject({ current: 75, difference: -3, trend: 'down', total: 2 });

    await act(async () => useCheckinsStore.getState().upsert({ ...second, weightKg: 80 }));
    expect(result.current.stats).toMatchObject({ current: 80, difference: 2, trend: 'up' });

    await act(async () => useCheckinsStore.getState().removeLocal('ck_2'));
    expect(result.current.stats).toMatchObject({ current: 78, difference: 0, trend: 'same', total: 1 });

    expect(repository.getAll).toHaveBeenCalledTimes(1);
  });

  it('keeps the same stats object while the check-ins have not changed', async () => {
    repository.getAll.mockResolvedValue([first]);
    const { result, rerender } = await renderHook(() => useDashboardStats());
    await act(async () => {});

    const before = result.current.stats;
    await rerender({});

    expect(result.current.stats).toBe(before);
  });
});
