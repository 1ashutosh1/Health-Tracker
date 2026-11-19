import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { SummaryScreen } from './SummaryScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const OFFLINE_TEXT = "You're offline. New check-ins will sync when you reconnect.";

const saved = makeCheckin({ id: 'ck_a', checkinDate: '2026-03-01', weightKg: 78, heightCm: 175 });
const pending = makeCheckin({
  id: 'local_p',
  clientId: 'p',
  syncStatus: 'pending',
  checkinDate: '2026-03-10',
  weightKg: 75,
  heightCm: 175,
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useCheckinsStore.getState().reset();
  useCheckinsStore.setState({ hasHydrated: true });
  useOutboxStore.getState().reset();
  useNetworkStore.setState({ isOnline: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
  useCheckinsStore.setState({ items: [saved], ownerUserId: 'u1', lastFetchedAt: Date.now() });
});

describe('SummaryScreen offline', () => {
  it('shows the dashboard from saved data with the offline banner, and does not fetch', async () => {
    useNetworkStore.setState({ isOnline: false });

    await render(<SummaryScreen />);

    expect(screen.getByText(OFFLINE_TEXT)).toBeTruthy();
    expect(screen.getByLabelText('Total check-ins, 1')).toBeTruthy();
    expect(repository.getAll).not.toHaveBeenCalled();
  });

  it('counts pending check-ins in the dashboard, and the latest one drives the headline numbers', async () => {
    useNetworkStore.setState({ isOnline: false });
    useOutboxStore.getState().add(pending);

    await render(<SummaryScreen />);

    expect(screen.getByLabelText('Total check-ins, 2')).toBeTruthy();
    expect(screen.getByLabelText(/^Current weight, 75 kilograms/)).toBeTruthy();
  });

  it('updates when a pending check-in is added while the screen is open', async () => {
    await render(<SummaryScreen />);
    expect(screen.getByLabelText('Total check-ins, 1')).toBeTruthy();

    await act(async () => useOutboxStore.getState().add(pending));

    expect(screen.getByLabelText('Total check-ins, 2')).toBeTruthy();
  });

  it('shows "Synced 1 check-in" after a sync', async () => {
    await render(<SummaryScreen />);

    await act(async () => useOutboxStore.getState().setLastSynced(1));

    expect(screen.getByText('Synced 1 check-in')).toBeTruthy();
  });
});

describe('signing out with unsynced check-ins', () => {
  const alertButtons = () => jest.mocked(Alert.alert).mock.calls.at(-1) as [string, string | undefined, AlertButton[]];

  it('warns that they would be lost', async () => {
    useOutboxStore.getState().add(pending);
    useOutboxStore.getState().add({ ...pending, id: 'local_q', clientId: 'q' });
    await render(<SummaryScreen />);

    await fireEvent.press(screen.getByLabelText('Account'));

    expect(alertButtons()[1]).toBe('2 check-ins have not synced yet and will be lost if you sign out.');
  });

  it('uses the singular for one', async () => {
    useOutboxStore.getState().add(pending);
    await render(<SummaryScreen />);

    await fireEvent.press(screen.getByLabelText('Account'));

    expect(alertButtons()[1]).toBe('1 check-in has not synced yet and will be lost if you sign out.');
  });

  it('shows the email as before when everything is synced', async () => {
    await render(<SummaryScreen />);

    await fireEvent.press(screen.getByLabelText('Account'));

    expect(alertButtons()[1]).toBe('a@b.c');
  });
});
