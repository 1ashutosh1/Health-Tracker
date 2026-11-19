import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import * as checkinRepository from '../services/checkinRepository';
import { runSync } from '../services/syncService';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { NetworkError, OFFLINE_EDIT_MESSAGE } from '../utils/errors';
import { CheckinDetailScreen } from './CheckinDetailScreen';

const mockBack = jest.fn();
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn(), setParams: mockSetParams, canGoBack: () => true }),
  Stack: { Screen: () => null },
}));
jest.mock('../services/checkinRepository');
jest.mock('../services/syncService');
const repository = jest.mocked(checkinRepository);
const sync = jest.mocked(runSync);

const OFFLINE_TEXT = "You're offline. New check-ins will sync when you reconnect.";

const synced = makeCheckin({ id: 'ck_1', checkinDate: '2026-03-02', weightKg: 72.4 });
const pending = makeCheckin({ id: 'local_p', clientId: 'p', syncStatus: 'pending', checkinDate: '2026-03-03', weightKg: 71 });
const failed = makeCheckin({
  id: 'local_f',
  clientId: 'f',
  syncStatus: 'failed',
  syncError: 'Something went wrong on our side. Please try again.',
  checkinDate: '2026-03-04',
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useCheckinsStore.getState().reset();
  useOutboxStore.getState().reset();
  useNetworkStore.setState({ isOnline: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
  useCheckinsStore.setState({ items: [synced], ownerUserId: 'u1', lastFetchedAt: Date.now() });
  repository.getById.mockResolvedValue(synced);
});

const lastAlert = () => jest.mocked(Alert.alert).mock.calls.at(-1) as [string, string | undefined, AlertButton[]?];

describe('sync status', () => {
  it('a synced check-in shows a small "Synced" check', async () => {
    await render(<CheckinDetailScreen id="ck_1" />);

    expect(screen.getByLabelText('Synced')).toBeTruthy();
  });

  it('a pending check-in shows "Pending sync", opens from the outbox and never asks the server', async () => {
    useOutboxStore.getState().add(pending);

    await render(<CheckinDetailScreen id="local_p" />);

    expect(screen.getByLabelText('Pending sync')).toBeTruthy();
    expect(screen.getByLabelText(/^Weight, 71 kilograms/)).toBeTruthy();
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('a failed check-in shows why, and Retry forces a sync', async () => {
    useOutboxStore.getState().add(failed);
    await render(<CheckinDetailScreen id="local_f" />);

    expect(screen.getByLabelText('Sync failed')).toBeTruthy();
    expect(screen.getByText('Something went wrong on our side. Please try again.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Retry sync'));

    expect(sync).toHaveBeenCalledWith({ force: true });
  });

  it('moves the route to the server id once a pending check-in has synced', async () => {
    useOutboxStore.getState().add(pending);
    await render(<CheckinDetailScreen id="local_p" />);
    expect(mockSetParams).not.toHaveBeenCalled();

    await act(async () => {
      useCheckinsStore.getState().upsertMany([{ ...pending, id: 'ck_99', syncStatus: 'synced' }]);
      useOutboxStore.getState().markSynced(['p']);
    });

    expect(mockSetParams).toHaveBeenCalledWith({ id: 'ck_99' });
    expect(screen.queryByText('Check-in not found')).toBeNull();
  });
});

describe('offline', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOnline: false });
  });

  it('shows the saved check-in and the banner, with no request and no error', async () => {
    await render(<CheckinDetailScreen id="ck_1" />);

    expect(screen.getByText(OFFLINE_TEXT)).toBeTruthy();
    expect(screen.getByLabelText(/^Weight, 72.4 kilograms/)).toBeTruthy();
    expect(repository.getById).not.toHaveBeenCalled();
  });

  it('deleting a synced check-in explains that you must reconnect, and does not ask to confirm', async () => {
    await render(<CheckinDetailScreen id="ck_1" />);

    await fireEvent.press(screen.getByLabelText('Delete check-in'));

    expect(lastAlert()[0]).toBe('Offline');
    expect(lastAlert()[1]).toBe(OFFLINE_EDIT_MESSAGE);
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('deleting a pending check-in still works offline', async () => {
    useOutboxStore.getState().add(pending);
    await render(<CheckinDetailScreen id="local_p" />);

    await fireEvent.press(screen.getByLabelText('Delete check-in'));
    expect(lastAlert()[0]).toBe('Delete this check-in?');

    const confirm = lastAlert()[2]?.find((b) => b.text === 'Delete');
    await act(async () => confirm?.onPress?.());

    expect(repository.remove).toHaveBeenCalledWith('local_p');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows the reason if the repository refuses the delete (a stale screen)', async () => {
    repository.assertEditable.mockImplementation(() => {
      throw new NetworkError(OFFLINE_EDIT_MESSAGE);
    });
    useOutboxStore.getState().add(pending);
    await render(<CheckinDetailScreen id="local_p" />);

    await fireEvent.press(screen.getByLabelText('Delete check-in'));
    const confirm = lastAlert()[2]?.find((b) => b.text === 'Delete');
    await act(async () => confirm?.onPress?.());

    expect(await screen.findByText(OFFLINE_EDIT_MESSAGE)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
