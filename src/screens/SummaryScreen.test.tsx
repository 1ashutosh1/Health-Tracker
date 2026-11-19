import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { subDays } from 'date-fns';
import { Alert } from 'react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError } from '../utils/errors';
import { toDateString } from '../utils/format';
import { SummaryScreen } from './SummaryScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const daysAgo = (n: number) => toDateString(subDays(new Date(), n));

// Weight 78 -> 74.5 over three check-ins. 174 cm at 74.5 kg is BMI 24.6 ("Normal").
const started = makeCheckin({ id: 'ck_1', checkinDate: daysAgo(40), weightKg: 78, heightCm: 174 });
const middle = makeCheckin({ id: 'ck_2', checkinDate: daysAgo(10), weightKg: 76, heightCm: 174 });
const latest = makeCheckin({ id: 'ck_3', checkinDate: daysAgo(3), weightKg: 74.5, heightCm: 174 });

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'Sam' } });
});

describe('SummaryScreen', () => {
  it('shows a loading state first, then the dashboard', async () => {
    let finish!: (items: Checkin[]) => void;
    repository.getAll.mockReturnValue(new Promise<Checkin[]>((resolve) => (finish = resolve)));

    await render(<SummaryScreen />);
    expect(screen.getByLabelText('Loading your summary…')).toBeTruthy();

    await act(async () => finish([started, middle, latest]));

    expect(await screen.findByText('Highlights')).toBeTruthy();
    expect(screen.queryByLabelText('Loading your summary…')).toBeNull();
  });

  it('shows the hero weight with an arrow-and-sentence trend', async () => {
    repository.getAll.mockResolvedValue([started, middle, latest]);
    await render(<SummaryScreen />);

    expect(
      await screen.findByLabelText('Current weight, 74.5 kilograms. Down 3.5 kilograms since you started.'),
    ).toBeTruthy();
    expect(screen.getByText('Down 3.5 kg since you started')).toBeTruthy();
  });

  it('shows "Up" for a gain', async () => {
    repository.getAll.mockResolvedValue([started, { ...latest, weightKg: 79.2 }]);
    await render(<SummaryScreen />);

    expect(await screen.findByText('Up 1.2 kg since you started')).toBeTruthy();
  });

  it('shows all five tiles with sentence labels', async () => {
    repository.getAll.mockResolvedValue([started, middle, latest]);
    await render(<SummaryScreen />);

    expect(await screen.findByLabelText(/^Starting weight, 78 kilograms, on /)).toBeTruthy();
    expect(screen.getByLabelText('Weight change, down 3.5 kilograms since your first check-in')).toBeTruthy();
    expect(screen.getByLabelText('Body mass index, 24.6, Normal')).toBeTruthy();
    expect(screen.getByLabelText('Total check-ins, 3')).toBeTruthy();
    expect(screen.getByLabelText('Latest check-in, 3 days ago')).toBeTruthy();
    expect(screen.getByText('-3.5 kg')).toBeTruthy(); // the sign is text, not only color
  });

  it('updates with no refetch when a check-in is added, edited or deleted', async () => {
    repository.getAll.mockResolvedValue([started, latest]);
    await render(<SummaryScreen />);
    expect(await screen.findByLabelText('Total check-ins, 2')).toBeTruthy();

    // Added with a much higher weight.
    await act(async () =>
      useCheckinsStore.getState().upsert(makeCheckin({ id: 'ck_new', checkinDate: daysAgo(0), weightKg: 90, heightCm: 174 })),
    );
    expect(screen.getByLabelText('Total check-ins, 3')).toBeTruthy();
    expect(screen.getByText('Up 12 kg since you started')).toBeTruthy();
    expect(screen.getByLabelText('Latest check-in, Today')).toBeTruthy();

    // Edited down.
    await act(async () =>
      useCheckinsStore.getState().upsert(makeCheckin({ id: 'ck_new', checkinDate: daysAgo(0), weightKg: 70, heightCm: 174 })),
    );
    expect(screen.getByText('Down 8 kg since you started')).toBeTruthy();

    // Deleted.
    await act(async () => useCheckinsStore.getState().removeLocal('ck_new'));
    expect(screen.getByLabelText('Total check-ins, 2')).toBeTruthy();
    expect(screen.getByText('Down 3.5 kg since you started')).toBeTruthy();

    expect(repository.getAll).toHaveBeenCalledTimes(1);
  });

  it('filters the chart by range, and says so when a range has no check-ins', async () => {
    repository.getAll.mockResolvedValue([started, middle, latest]);
    await render(<SummaryScreen />);

    // Default is the past month: the 40 day old check-in is outside it.
    expect(await screen.findByLabelText(/^Weight chart, past month\. 2 check-ins\./)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('All time'));
    expect(screen.getByLabelText(/^Weight chart, all time\. 3 check-ins\./)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Past week'));
    expect(screen.getByLabelText(/^Weight chart, past week\. One check-in: 74.5 kilograms/)).toBeTruthy();
  });

  it('says so when the selected range has no check-ins, and the headline numbers stay', async () => {
    repository.getAll.mockResolvedValue([started, middle]); // newest is 10 days old
    await render(<SummaryScreen />);

    await fireEvent.press(await screen.findByLabelText('Past week'));

    expect(screen.getByLabelText('Weight chart, past week. No check-ins in this period.')).toBeTruthy();
    expect(screen.getByText('No check-ins in this period')).toBeTruthy();
    expect(screen.getByText('Down 2 kg since you started')).toBeTruthy(); // not affected by the chart range
  });

  it('shows a single check-in as one dot with "No change yet"', async () => {
    repository.getAll.mockResolvedValue([latest]);
    await render(<SummaryScreen />);

    expect(await screen.findByText('No change yet')).toBeTruthy();
    expect(screen.getByLabelText(/^Weight chart, past month\. One check-in: 74.5 kilograms on /)).toBeTruthy();
    expect(screen.getByLabelText('Weight change, no change since your first check-in')).toBeTruthy();
    expect(screen.getByLabelText('Total check-ins, 1')).toBeTruthy();
  });

  it('shows a friendly empty state for a user with no check-ins, with an add action', async () => {
    repository.getAll.mockResolvedValue([]);
    await render(<SummaryScreen />);

    expect(await screen.findByText('Start tracking your progress')).toBeTruthy();
    expect(screen.queryByText('Highlights')).toBeNull();

    fireEvent.press(screen.getByText('Add your first check-in'));
    expect(mockPush).toHaveBeenCalledWith('/checkin/new');
  });

  it('shows an error with Retry when the first load fails, and Retry recovers', async () => {
    repository.getAll.mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValue([latest]);
    await render(<SummaryScreen />);

    expect(await screen.findByText('Server error')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Retry')));

    expect(await screen.findByText('Highlights')).toBeTruthy();
    expect(screen.queryByText('Server error')).toBeNull();
  });

  it('keeps the numbers on screen and shows a banner when a refresh fails', async () => {
    repository.getAll.mockResolvedValueOnce([latest]).mockRejectedValueOnce(new ApiError(500, 'Server error'));
    await render(<SummaryScreen />);
    expect(await screen.findByText('Highlights')).toBeTruthy();

    await act(async () => useCheckinsStore.getState().fetchAll('u1'));

    expect(screen.getByText('Server error')).toBeTruthy();
    expect(screen.getByText('Highlights')).toBeTruthy();
    expect(screen.getByLabelText('Total check-ins, 1')).toBeTruthy();
  });

  it('offers sign out from the avatar', async () => {
    repository.getAll.mockResolvedValue([latest]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<SummaryScreen />);

    fireEvent.press(await screen.findByLabelText('Account'));

    expect(alert).toHaveBeenCalledWith('Sam', 'a@b.c', expect.arrayContaining([expect.objectContaining({ text: 'Sign out' })]));
  });
});
