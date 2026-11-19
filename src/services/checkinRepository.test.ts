import { randomUUID } from 'expo-crypto';

import * as checkinsApi from '../api/checkinsApi';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import { makeCheckin } from '../test-utils/makeCheckin';
import { ApiError, NetworkError, NotFoundError, OFFLINE_EDIT_MESSAGE } from '../utils/errors';
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
  useOutboxStore.getState().reset();
  useNetworkStore.setState({ isOnline: true });
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

const CLIENT_ID = '00000000-0000-4000-8000-000000000001';
const outbox = () => useOutboxStore.getState().items;

describe('create: offline and online', () => {
  it('online: returns the server copy and leaves the outbox empty', async () => {
    const saved = makeCheckin({ id: 'ck_new' });
    api.createCheckin.mockResolvedValue(saved);

    await expect(repository.create(fields)).resolves.toBe(saved);
    expect(outbox()).toEqual([]);
  });

  it('offline: saves to the outbox as a pending "local_" item without calling the server', async () => {
    useNetworkStore.setState({ isOnline: false });

    const created = await repository.create(fields);

    expect(api.createCheckin).not.toHaveBeenCalled();
    expect(created).toMatchObject({
      ...fields,
      id: `local_${CLIENT_ID}`,
      clientId: CLIENT_ID,
      syncStatus: 'pending',
    });
    expect(outbox()).toEqual([created]);
  });

  it('online but the request never reached the server: falls back to the outbox with the same clientId', async () => {
    api.createCheckin.mockRejectedValue(new NetworkError());

    const created = await repository.create(fields);

    expect(created).toMatchObject({ syncStatus: 'pending', clientId: CLIENT_ID });
    // Same id that was sent, so if that request did arrive, the later sync cannot make a second one.
    expect(api.createCheckin.mock.calls[0][0].clientId).toBe(CLIENT_ID);
    expect(outbox()).toEqual([created]);
  });

  it('also treats the raw fetch failure as "no connection"', async () => {
    api.createCheckin.mockRejectedValue(new TypeError('Network request failed'));

    await expect(repository.create(fields)).resolves.toMatchObject({ syncStatus: 'pending' });
  });

  it('a server error is thrown to the form and nothing is saved', async () => {
    api.createCheckin.mockRejectedValue(new ApiError(400, 'Weight is invalid'));

    await expect(repository.create(fields)).rejects.toThrow('Weight is invalid');
    expect(outbox()).toEqual([]);
  });
});

describe('createFromOutbox', () => {
  it('sends the fields with the clientId and none of the local bookkeeping', async () => {
    api.createCheckin.mockResolvedValue(makeCheckin());
    const item = makeCheckin({
      ...fields,
      id: 'local_x',
      clientId: 'x',
      syncStatus: 'failed',
      syncError: 'boom',
      syncAttempts: 2,
      nextRetryAt: 5,
    });

    await repository.createFromOutbox(item);

    expect(api.createCheckin).toHaveBeenCalledWith({ ...fields, clientId: 'x' });
  });
});

describe('update / remove: pending items', () => {
  const pendingItem = makeCheckin({ id: 'local_p', clientId: 'p', syncStatus: 'pending', weightKg: 70 });

  beforeEach(() => {
    useOutboxStore.getState().add(pendingItem);
  });

  it('edits the outbox only, even offline, and never calls the server', async () => {
    useNetworkStore.setState({ isOnline: false });

    const updated = await repository.update('local_p', { weightKg: 68 });

    expect(updated).toMatchObject({ id: 'local_p', weightKg: 68, syncStatus: 'pending' });
    expect(outbox()[0].weightKg).toBe(68);
    expect(api.updateCheckin).not.toHaveBeenCalled();
  });

  it('deletes from the outbox only, even offline', async () => {
    useNetworkStore.setState({ isOnline: false });

    await repository.remove('local_p');

    expect(outbox()).toEqual([]);
    expect(api.deleteCheckin).not.toHaveBeenCalled();
  });

  it('refuses to edit or delete while the item is being sent, so the change cannot be lost', async () => {
    useOutboxStore.getState().setSyncing(true);

    await expect(repository.update('local_p', { weightKg: 1 })).rejects.toThrow(/being synced/);
    await expect(repository.remove('local_p')).rejects.toThrow(/being synced/);
    expect(outbox()[0].weightKg).toBe(70);
  });

  it('says so when the local id is stale because the sync already finished', async () => {
    await expect(repository.update('local_gone', {})).rejects.toThrow(/just finished syncing/);
    await expect(repository.remove('local_gone')).rejects.toThrow(/just finished syncing/);
  });

  it('getById answers from the outbox without asking the server', async () => {
    await expect(repository.getById('local_p')).resolves.toBe(outbox()[0]);
    await expect(repository.getById('local_nope')).rejects.toBeInstanceOf(NotFoundError);
    expect(api.getCheckin).not.toHaveBeenCalled();
  });
});

describe('update / remove: synced items while offline', () => {
  beforeEach(() => {
    useNetworkStore.setState({ isOnline: false });
  });

  it('refuses with the documented message and does not call the server', async () => {
    await expect(repository.update('ck_1', { weightKg: 70 })).rejects.toThrow(OFFLINE_EDIT_MESSAGE);
    await expect(repository.remove('ck_1')).rejects.toThrow(OFFLINE_EDIT_MESSAGE);

    expect(api.updateCheckin).not.toHaveBeenCalled();
    expect(api.deleteCheckin).not.toHaveBeenCalled();
  });

  it('the error is a NetworkError, so the UI treats it as "offline" and not as a bug', async () => {
    await expect(repository.update('ck_1', {})).rejects.toBeInstanceOf(NetworkError);
  });

  it('assertEditable throws for a synced item offline and passes online', () => {
    expect(() => repository.assertEditable('ck_1')).toThrow(OFFLINE_EDIT_MESSAGE);
    useNetworkStore.setState({ isOnline: true });
    expect(() => repository.assertEditable('ck_1')).not.toThrow();
  });
});
