import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useFilterStore } from '../stores/filterStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError } from '../utils/errors';
import { CheckinListScreen } from './CheckinListScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const happy = makeCheckin({ id: 'ck_a', mood: 'happy', checkinDate: '2026-03-02', weightKg: 72.4 });
const sad = makeCheckin({ id: 'ck_b', mood: 'sad', checkinDate: '2026-03-01', weightKg: 73 });

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  // Reading the saved copy from disk is async; these tests are about what happens after it.
  useCheckinsStore.setState({ hasHydrated: true });
  useFilterStore.getState().reset();
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('CheckinListScreen', () => {
  it('shows a loading state first, then the rows', async () => {
    let finish!: (items: Checkin[]) => void;
    repository.getAll.mockReturnValue(new Promise<Checkin[]>((resolve) => (finish = resolve)));

    await render(<CheckinListScreen />);
    expect(screen.getByLabelText('Loading check-ins…')).toBeTruthy();
    await act(async () => finish([happy, sad]));

    expect(await screen.findByLabelText(/Mon, Mar 2, 2026.*Weight 72.4 kilograms/)).toBeTruthy();
    expect(screen.getByLabelText(/Sun, Mar 1, 2026/)).toBeTruthy();
    expect(screen.queryByLabelText('Loading check-ins…')).toBeNull();
  });

  it('opens a check-in when its row is tapped', async () => {
    repository.getAll.mockResolvedValue([happy]);
    await render(<CheckinListScreen />);

    fireEvent.press(await screen.findByLabelText(/Mon, Mar 2, 2026/));

    expect(mockPush).toHaveBeenCalledWith('/checkin/ck_a');
  });

  it('opens the new check-in form from the + button', async () => {
    repository.getAll.mockResolvedValue([happy]);
    await render(<CheckinListScreen />);

    fireEvent.press(await screen.findByLabelText('Add check-in'));

    expect(mockPush).toHaveBeenCalledWith('/checkin/new');
  });

  it('shows the empty state with an Add check-in action when there are none', async () => {
    repository.getAll.mockResolvedValue([]);
    await render(<CheckinListScreen />);

    expect(await screen.findByText('No check-ins yet')).toBeTruthy();
    fireEvent.press(screen.getByText('Add check-in')); // the button in the empty state (the header + has no text)
    expect(mockPush).toHaveBeenCalledWith('/checkin/new');
  });

  it('shows an error with Retry when the first load fails, and Retry recovers', async () => {
    repository.getAll.mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValue([happy]);
    await render(<CheckinListScreen />);

    expect(await screen.findByText('Server error')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Retry')));

    expect(await screen.findByLabelText(/Mon, Mar 2, 2026/)).toBeTruthy();
    expect(screen.queryByText('Server error')).toBeNull();
  });

  it('keeps the cached list and shows an inline error bar when a refresh fails', async () => {
    useCheckinsStore.setState({ items: [happy], status: 'success', lastFetchedAt: Date.now() - 60_000, ownerUserId: 'u1' });
    repository.getAll.mockRejectedValue(new ApiError(500, 'Server error'));

    await render(<CheckinListScreen />);

    expect(await screen.findByText('Server error')).toBeTruthy();
    expect(screen.getByLabelText(/Mon, Mar 2, 2026/)).toBeTruthy(); // the list is still there
    expect(screen.queryByText('Something went wrong')).toBeNull(); // not the full-screen error
  });

  it('filters by mood, shows the no-match state, and Clear filters brings the list back', async () => {
    repository.getAll.mockResolvedValue([happy]);
    await render(<CheckinListScreen />);
    await screen.findByLabelText(/Mon, Mar 2, 2026/);

    fireEvent.press(screen.getByLabelText('Mood Sad'));
    expect(await screen.findByText('No check-ins match your filters')).toBeTruthy();
    expect(screen.queryByLabelText(/Mon, Mar 2, 2026/)).toBeNull();

    fireEvent.press(screen.getByText('Clear filters'));
    expect(await screen.findByLabelText(/Mon, Mar 2, 2026/)).toBeTruthy();
    expect(useFilterStore.getState().moods).toEqual([]);
  });

  it('sorts oldest first when Oldest is chosen', async () => {
    repository.getAll.mockResolvedValue([happy, sad]);
    await render(<CheckinListScreen />);
    await screen.findByLabelText(/Mon, Mar 2, 2026/);

    const dates = () =>
      screen.getAllByLabelText(/^(Mon|Sun), Mar/).map((node) => String(node.props.accessibilityLabel).split('.')[0]);
    expect(dates()).toEqual(['Mon, Mar 2, 2026', 'Sun, Mar 1, 2026']);

    await fireEvent.press(screen.getByLabelText('Oldest'));
    expect(dates()).toEqual(['Sun, Mar 1, 2026', 'Mon, Mar 2, 2026']);
  });
});
