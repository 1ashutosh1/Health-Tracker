import { randomUUID } from 'expo-crypto';

import * as checkinsApi from '../api/checkinsApi';
import { makeCheckin } from '../test-utils/makeCheckin';
import { ApiError, NetworkError, NotFoundError } from '../utils/errors';
import * as repository from './checkinRepository';

jest.mock('../api/checkinsApi');
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
const api = jest.mocked(checkinsApi);

const fields = {
  weightKg: 72,
  heightCm: 175,
  sleepHours: 7,
  steps: 5000,
  waterLitres: 2,
  mood: 'happy' as const,
  notes: undefined,
  checkinDate: '2026-11-19',
};

let uuidCounter = 0;

beforeEach(() => {
  jest.resetAllMocks();
  uuidCounter = 0;
  jest.mocked(randomUUID).mockImplementation(() => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`);
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('reads', () => {
  it('getAll retries a network failure and then succeeds', async () => {
    const list = [makeCheckin()];
    api.getCheckins.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(list);

    const promise = repository.getAll();
    await jest.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toBe(list);
    expect(api.getCheckins).toHaveBeenCalledTimes(2);
  });

  it('getById does not retry a NotFoundError', async () => {
    api.getCheckin.mockRejectedValue(new NotFoundError());

    await expect(repository.getById('ck_missing')).rejects.toBeInstanceOf(NotFoundError);
    expect(api.getCheckin).toHaveBeenCalledTimes(1);
    expect(api.getCheckin).toHaveBeenCalledWith('ck_missing');
  });
});

describe('writes', () => {
  it('create sends a fresh clientId with the fields', async () => {
    api.createCheckin.mockResolvedValue(makeCheckin());

    await repository.create(fields);
    await repository.create(fields);

    const [first, second] = api.createCheckin.mock.calls.map(([request]) => request);
    expect(first).toMatchObject(fields);
    expect(first.clientId).toBe('00000000-0000-4000-8000-000000000001');
    expect(second.clientId).toBe('00000000-0000-4000-8000-000000000002');
  });

  it('create is never retried automatically', async () => {
    api.createCheckin.mockRejectedValue(new ApiError(500, 'boom'));

    await expect(repository.create(fields)).rejects.toThrow('boom');
    expect(api.createCheckin).toHaveBeenCalledTimes(1);
  });

  it('update and remove are not retried either', async () => {
    api.updateCheckin.mockRejectedValue(new NetworkError());
    api.deleteCheckin.mockRejectedValue(new NetworkError());

    await expect(repository.update('ck_1', { weightKg: 70 })).rejects.toBeInstanceOf(NetworkError);
    await expect(repository.remove('ck_1')).rejects.toBeInstanceOf(NetworkError);

    expect(api.updateCheckin).toHaveBeenCalledTimes(1);
    expect(api.deleteCheckin).toHaveBeenCalledTimes(1);
  });
});
