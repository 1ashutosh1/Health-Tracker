import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { ApiError, NotFoundError } from '../utils/errors';
import { CheckinDetailScreen } from './CheckinDetailScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: () => true }),
  Stack: { Screen: () => null },
}));
jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const item = makeCheckin({
  id: 'ck_1',
  weightKg: 72.4,
  heightCm: 175,
  sleepHours: 7.5,
  steps: 8200,
  waterLitres: 2.5,
  mood: 'happy',
  notes: 'Felt strong on the run',
  checkinDate: '2026-03-02',
});

/** Taps the confirm button of the most recent Alert.alert call. */
async function confirmAlert(buttonText: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[];
  const button = buttons.find((b) => b.text === buttonText);
  await act(async () => button?.onPress?.());
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useCheckinsStore.getState().reset();
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
});

describe('CheckinDetailScreen', () => {
  it('shows the cached check-in immediately: weight header, BMI and every row', async () => {
    useCheckinsStore.setState({ items: [item] });
    repository.getById.mockResolvedValue(item);

    await render(<CheckinDetailScreen id="ck_1" />);

    expect(screen.getByLabelText(/Weight, 72.4 kilograms/)).toBeTruthy();
    expect(screen.getByText('175 cm')).toBeTruthy();
    expect(screen.getByText('23.6 · Normal')).toBeTruthy(); // 72.4 / 1.75^2
    expect(screen.getByText('7.5 hr')).toBeTruthy();
    expect(screen.getByText('8,200')).toBeTruthy();
    expect(screen.getByText('2.5 L')).toBeTruthy();
    expect(screen.getByText('Happy')).toBeTruthy();
    expect(screen.getByText('Felt strong on the run')).toBeTruthy();
    expect(screen.queryByLabelText('Loading check-in…')).toBeNull(); // no spinner for a cached item
  });

  it('shows a spinner then the data when opened by deep link (nothing cached)', async () => {
    let finish!: () => void;
    repository.getById.mockReturnValue(new Promise((resolve) => (finish = () => resolve(item))));

    await render(<CheckinDetailScreen id="ck_1" />);
    expect(screen.getByLabelText('Loading check-in…')).toBeTruthy();

    await act(async () => finish());
    expect(await screen.findByLabelText(/Weight, 72.4 kilograms/)).toBeTruthy();
  });

  it('shows "Check-in not found" with a way back', async () => {
    repository.getById.mockRejectedValue(new NotFoundError());

    await render(<CheckinDetailScreen id="ck_missing" />);

    expect(await screen.findByText('Check-in not found')).toBeTruthy();
    await fireEvent.press(screen.getByText('Go to Check-ins'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/checkins');
  });

  it('shows an error with Retry when loading fails', async () => {
    repository.getById.mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValueOnce(item);

    await render(<CheckinDetailScreen id="ck_1" />);
    expect(await screen.findByText('Server error')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(await screen.findByLabelText(/Weight, 72.4 kilograms/)).toBeTruthy();
  });

  it('does not delete until the alert is confirmed', async () => {
    useCheckinsStore.setState({ items: [item] });
    repository.getById.mockResolvedValue(item);
    await render(<CheckinDetailScreen id="ck_1" />);

    await fireEvent.press(screen.getByLabelText('Delete check-in'));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    await confirmAlert('Cancel');

    expect(repository.remove).not.toHaveBeenCalled();
    expect(useCheckinsStore.getState().items).toEqual([item]);
  });

  it('deletes after confirming, then goes back', async () => {
    useCheckinsStore.setState({ items: [item] });
    repository.getById.mockResolvedValue(item);
    repository.remove.mockResolvedValue();
    await render(<CheckinDetailScreen id="ck_1" />);

    await fireEvent.press(screen.getByLabelText('Delete check-in'));
    await confirmAlert('Delete');

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(repository.remove).toHaveBeenCalledWith('ck_1');
    expect(useCheckinsStore.getState().items).toEqual([]);
  });

  it('stays on screen, restores the check-in and shows the error when delete fails', async () => {
    useCheckinsStore.setState({ items: [item] });
    repository.getById.mockResolvedValue(item);
    repository.remove.mockRejectedValue(new ApiError(500, 'Could not delete'));
    await render(<CheckinDetailScreen id="ck_1" />);

    await fireEvent.press(screen.getByLabelText('Delete check-in'));
    await confirmAlert('Delete');

    expect(await screen.findByText('Could not delete')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(useCheckinsStore.getState().items).toEqual([item]);
    expect(screen.getByLabelText(/Weight, 72.4 kilograms/)).toBeTruthy(); // the screen never went blank
  });
});
