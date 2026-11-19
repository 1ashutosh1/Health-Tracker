import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { ApiError } from '../utils/errors';
import { CheckinFormScreen } from './CheckinFormScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('../services/checkinRepository');
const repository = jest.mocked(checkinRepository);

const typeInto = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);
const save = () => fireEvent.press(screen.getByText('Save check-in'));

async function fillValidForm() {
  await typeInto('Weight (kg)', '72.4');
  await typeInto('Height (cm)', '175');
  await typeInto('Sleep (hours)', '7.5');
  await typeInto('Steps', '8000');
  await typeInto('Water (litres)', '2.5');
  await fireEvent.press(screen.getByLabelText('Happy'));
}

beforeEach(() => {
  jest.resetAllMocks();
  useCheckinsStore.getState().reset();
  // Reading the saved copy from disk is async; these tests are about what happens after it.
  useCheckinsStore.setState({ hasHydrated: true });
  useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
  // The list is already loaded, so opening the form does not fetch.
  useCheckinsStore.setState({ status: 'success', lastFetchedAt: Date.now(), ownerUserId: 'u1' });
});

describe('create mode', () => {
  it('shows an error under each empty required field and does not call the server', async () => {
    await render(<CheckinFormScreen mode="create" />);

    await save();

    expect(await screen.findByText('Weight is required')).toBeTruthy();
    expect(screen.getByText('Height is required')).toBeTruthy();
    expect(screen.getByText('Sleep is required')).toBeTruthy();
    expect(screen.getByText('Steps is required')).toBeTruthy();
    expect(screen.getByText('Water is required')).toBeTruthy();
    expect(screen.getByText('Select how you feel')).toBeTruthy();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('shows the rule that was broken, e.g. weight out of range', async () => {
    await render(<CheckinFormScreen mode="create" />);

    await typeInto('Weight (kg)', '5');
    await save();

    expect(await screen.findByText('Weight must be between 20 and 400 kg')).toBeTruthy();
  });

  it('saves valid input as numbers, adds it to the store and goes back', async () => {
    const saved = makeCheckin({ id: 'ck_new' });
    repository.create.mockResolvedValue(saved);
    await render(<CheckinFormScreen mode="create" />);

    await fillValidForm();
    await save();

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        weightKg: 72.4,
        heightCm: 175,
        sleepHours: 7.5,
        steps: 8000,
        waterLitres: 2.5,
        mood: 'happy',
        notes: undefined,
      }),
    );
    expect(useCheckinsStore.getState().items).toEqual([saved]);
  });

  it('ignores a second tap on Save while the first save is running', async () => {
    let finish!: () => void;
    repository.create.mockReturnValue(new Promise((resolve) => (finish = () => resolve(makeCheckin()))));
    await render(<CheckinFormScreen mode="create" />);
    await fillValidForm();

    await save();
    // While saving, the button shows a spinner and ignores taps. (The synchronous ref lock that
    // covers a tap landing before this re-render is tested in useSubmitLock.test.ts.)
    expect(screen.getByLabelText('Save check-in').props.accessibilityState).toMatchObject({ busy: true });
    await fireEvent.press(screen.getByLabelText('Save check-in'));
    await act(async () => finish());

    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('on a server error keeps the typed input, shows a banner, and Retry saves it', async () => {
    repository.create.mockRejectedValueOnce(new ApiError(500, 'Server error')).mockResolvedValueOnce(makeCheckin());
    await render(<CheckinFormScreen mode="create" />);
    await fillValidForm();

    await save();

    expect(await screen.findByText('Server error')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Weight (kg)').props.value).toBe('72.4'); // input kept

    await fireEvent.press(screen.getByLabelText('Retry'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(repository.create).toHaveBeenCalledTimes(2);
  });

  it("prefills height from the latest check-in", async () => {
    useCheckinsStore.setState({
      items: [
        makeCheckin({ heightCm: 170, checkinDate: '2026-01-01' }),
        makeCheckin({ heightCm: 181, checkinDate: '2026-03-01' }),
      ],
    });

    await render(<CheckinFormScreen mode="create" />);

    expect(screen.getByLabelText('Height (cm)').props.value).toBe('181');
  });

  it('warns, without blocking, about unusual sleep', async () => {
    await render(<CheckinFormScreen mode="create" />);

    await typeInto('Sleep (hours)', '2');
    expect(await screen.findByText(/very little sleep/)).toBeTruthy();

    await typeInto('Sleep (hours)', '8');
    await waitFor(() => expect(screen.queryByText(/very little sleep/)).toBeNull());
  });

  it('counts note characters', async () => {
    await render(<CheckinFormScreen mode="create" />);
    expect(screen.getByText('0/500')).toBeTruthy();

    await typeInto('Notes (optional)', 'Felt great');

    expect(await screen.findByText('10/500')).toBeTruthy();
  });
});

describe('edit mode', () => {
  const existing = makeCheckin({ id: 'ck_1', weightKg: 70, notes: 'Old note', mood: 'sad' });

  beforeEach(() => {
    useCheckinsStore.setState({ items: [existing] });
    repository.getById.mockResolvedValue(existing);
  });

  it('starts with the saved values', async () => {
    await render(<CheckinFormScreen mode="edit" checkinId="ck_1" />);

    expect(await screen.findByDisplayValue('70')).toBeTruthy();
    expect(screen.getByLabelText('Notes (optional)').props.value).toBe('Old note');
    expect(screen.getByLabelText('Sad').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('updates the check-in and goes back', async () => {
    repository.update.mockResolvedValue({ ...existing, weightKg: 69.5 });
    await render(<CheckinFormScreen mode="edit" checkinId="ck_1" />);
    await screen.findByDisplayValue('70');

    await typeInto('Weight (kg)', '69.5');
    await save();

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(repository.update).toHaveBeenCalledWith('ck_1', expect.objectContaining({ weightKg: 69.5, notes: 'Old note' }));
    expect(useCheckinsStore.getState().items[0].weightKg).toBe(69.5);
  });

  it('shows "Check-in not found" when it no longer exists', async () => {
    useCheckinsStore.setState({ items: [] });
    const { NotFoundError } = jest.requireActual('../utils/errors');
    repository.getById.mockRejectedValue(new NotFoundError());

    await render(<CheckinFormScreen mode="edit" checkinId="ck_gone" />);

    expect(await screen.findByText('Check-in not found')).toBeTruthy();
  });
});
