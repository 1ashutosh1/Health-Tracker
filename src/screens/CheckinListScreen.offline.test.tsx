import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { runSync } from '../services/syncService';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useFilterStore } from '../stores/filterStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { NetworkError } from '../utils/errors';
import { CheckinListScreen } from './CheckinListScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../services/checkinRepository');
jest.mock('../services/syncService');
const repository = jest.mocked(checkinRepository);
const sync = jest.mocked(runSync);

const OFFLINE_TEXT = "You're offline. New check-ins will sync when you reconnect.";

const synced = makeCheckin({ id: 'ck_a', checkinDate: '2026-03-02', weightKg: 72.4 });
const pending = makeCheckin({
  id: 'local_p',
  clientId: 'p',
  syncStatus: 'pending',
  checkinDate: '2026-03-03',
  weightKg: 71.9,
});
const failed = makeCheckin({
  id: 'local_f',
  clientId: 'f',
  syncStatus: 'failed',
  syncError: 'Server error',
  checkinDate: '2026-03-04',
  weightKg: 71.5,
});

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  useCheckinsStore.setState({ hasHydrated: true });
  useOutboxStore.getState().reset();
  useFilterStore.getState().reset();
  useNetworkStore.setState({ isOnline: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
  repository.getAll.mockResolvedValue([synced]);
});

describe('offline banner', () => {
  it('shows saved check-ins and the banner when offline, without fetching or showing an error', async () => {
    useCheckinsStore.setState({ items: [synced], ownerUserId: 'u1', lastFetchedAt: Date.now() - 600_000 });
    useNetworkStore.setState({ isOnline: false });

    await render(<CheckinListScreen />);

    expect(screen.getByText(OFFLINE_TEXT)).toBeTruthy();
    expect(screen.getByLabelText(/Mon, Mar 2, 2026.*Weight 72.4 kilograms/)).toBeTruthy();
    expect(repository.getAll).not.toHaveBeenCalled();
    expect(screen.queryByText(/Retry/)).toBeNull();
  });

  it('has no banner while online', async () => {
    await render(<CheckinListScreen />);
    await screen.findByLabelText(/Mon, Mar 2, 2026/);

    expect(screen.queryByText(OFFLINE_TEXT)).toBeNull();
  });

  it('a failed request with saved data shows the list and the offline banner, not an error bar', async () => {
    useCheckinsStore.setState({ items: [synced], ownerUserId: 'u1', lastFetchedAt: Date.now() - 600_000 });
    repository.getAll.mockRejectedValue(new NetworkError());

    await render(<CheckinListScreen />);

    expect(await screen.findByText(OFFLINE_TEXT)).toBeTruthy();
    expect(screen.getByLabelText(/Mon, Mar 2, 2026/)).toBeTruthy();
    expect(screen.queryByText('No connection. Check your network and try again.')).toBeNull();
  });

  it('with nothing saved, offline is a full error with Retry (nothing to show)', async () => {
    useNetworkStore.setState({ isOnline: false });

    await render(<CheckinListScreen />);

    expect(screen.getByText('No connection. Check your network and try again.')).toBeTruthy();
    expect(screen.getByLabelText('Retry')).toBeTruthy();
  });
});

describe('before the saved copy is read', () => {
  it('says loading, not "No check-ins yet"', async () => {
    useCheckinsStore.setState({ hasHydrated: false });

    await render(<CheckinListScreen />);

    expect(screen.getByLabelText('Loading check-ins…')).toBeTruthy();
    expect(screen.queryByText('No check-ins yet')).toBeNull();
  });
});

describe('sync status on rows', () => {
  beforeEach(() => {
    useCheckinsStore.setState({ items: [synced], ownerUserId: 'u1', lastFetchedAt: Date.now() });
  });

  it('shows a pending check-in first, with an orange "Pending sync" badge', async () => {
    useOutboxStore.getState().add(pending);

    await render(<CheckinListScreen />);

    expect(screen.getByLabelText('Pending sync')).toBeTruthy();
    expect(screen.getByLabelText(/Tue, Mar 3, 2026.*Pending sync\./)).toBeTruthy();
  });

  it('shows nothing extra on synced rows', async () => {
    await render(<CheckinListScreen />);

    expect(screen.queryByLabelText('Pending sync')).toBeNull();
    expect(screen.queryByLabelText('Sync failed')).toBeNull();
    expect(screen.queryByLabelText('Synced')).toBeNull();
  });

  it('a failed check-in shows "Sync failed" and Retry, which forces a sync', async () => {
    useOutboxStore.getState().add(failed);
    await render(<CheckinListScreen />);

    expect(screen.getByLabelText('Sync failed')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry sync'));

    expect(sync).toHaveBeenCalledWith({ force: true });
    expect(mockPush).not.toHaveBeenCalled(); // tapping Retry does not also open the row
  });

  it('opens a pending check-in by its local id', async () => {
    useOutboxStore.getState().add(pending);
    await render(<CheckinListScreen />);

    await fireEvent.press(screen.getByLabelText(/Tue, Mar 3, 2026/));

    expect(mockPush).toHaveBeenCalledWith('/checkin/local_p');
  });

  it('lists pending and synced check-ins together', async () => {
    useOutboxStore.getState().add(pending);
    await render(<CheckinListScreen />);

    expect(screen.getAllByLabelText(/Weight/)).toHaveLength(2);
  });
});

describe('"Synced 2 check-ins" notice', () => {
  it('appears after a sync and goes away by itself', async () => {
    jest.useFakeTimers();
    useCheckinsStore.setState({ items: [synced], ownerUserId: 'u1', lastFetchedAt: Date.now() });
    await render(<CheckinListScreen />);
    expect(screen.queryByText('Synced 2 check-ins')).toBeNull();

    await act(async () => useOutboxStore.getState().setLastSynced(2));
    expect(screen.getByText('Synced 2 check-ins')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(4100);
    });
    expect(screen.queryByText('Synced 2 check-ins')).toBeNull();
    jest.useRealTimers();
  });

  it('uses the singular for one', async () => {
    useCheckinsStore.setState({ items: [synced], ownerUserId: 'u1', lastFetchedAt: Date.now() });
    await render(<CheckinListScreen />);

    await act(async () => useOutboxStore.getState().setLastSynced(1));

    expect(screen.getByText('Synced 1 check-in')).toBeTruthy();
  });
});
