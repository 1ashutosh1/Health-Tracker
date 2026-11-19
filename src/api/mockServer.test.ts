import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { STORAGE_KEYS } from '../storage/keys';
import { ApiError, NetworkError, NotFoundError } from '../utils/errors';
import type { CreateCheckinRequest } from '../types/api';
import {
  createCheckin,
  deleteCheckin,
  devConfig,
  getCheckin,
  getCheckins,
  login,
  resetMockServer,
  updateCheckin,
} from './mockServer';

const newCheckin: CreateCheckinRequest = {
  clientId: 'client-abc',
  weightKg: 73.5,
  heightCm: 172,
  sleepHours: 7,
  steps: 5000,
  waterLitres: 2,
  mood: 'happy',
  checkinDate: '2026-01-01',
};

async function tokenFor(email: string) {
  return (await login(email, 'Password123')).token;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await resetMockServer();
  devConfig.latencyMs = { min: 0, max: 0 };
  devConfig.failureRate = 0;
  devConfig.forceOffline = false;
});

describe('login', () => {
  it('signs in the seeded users and returns a public user without the password', async () => {
    const session = await login('demo@health.app', 'Password123');
    expect(session.user).toEqual({ id: 'user_demo', email: 'demo@health.app', name: 'Demo User' });
    expect(session.token).toEqual(expect.any(String));
    expect(JSON.stringify(session)).not.toContain('Password123');
  });

  it('ignores case and surrounding spaces in the email', async () => {
    await expect(login('  Demo@Health.App ', 'Password123')).resolves.toBeDefined();
  });

  it('rejects a wrong password with a 401 and a friendly message', async () => {
    const error = await login('demo@health.app', 'nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Incorrect email or password' });
  });

  it('rejects an unknown email with the same message (does not reveal which part was wrong)', async () => {
    await expect(login('ghost@health.app', 'Password123')).rejects.toMatchObject({
      message: 'Incorrect email or password',
    });
  });
});

describe('seed data', () => {
  it('gives the demo user about 10 check-ins, newest first, with weight falling from 78 to 74 kg', async () => {
    const list = await getCheckins(await tokenFor('demo@health.app'));
    expect(list).toHaveLength(10);
    expect(list[0].weightKg).toBe(74);
    expect(list[list.length - 1].weightKg).toBe(78);
    expect(new Set(list.map((c) => c.mood)).size).toBe(3);
    expect(list.every((c) => c.syncStatus === 'synced')).toBe(true);
    expect(list[0]).not.toHaveProperty('userId');
  });

  it('gives the new user no check-ins', async () => {
    expect(await getCheckins(await tokenFor('new@health.app'))).toEqual([]);
  });

  it('persists under its own key, separate from the client cache', async () => {
    await login('demo@health.app', 'Password123');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.mockServerDb)).not.toBeNull();
  });

  it('starts again from the seed if the stored database is corrupt', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.mockServerDb, '{"oops":true}');
    await resetMockServerKeepStorage();
    expect(await getCheckins(await tokenFor('demo@health.app'))).toHaveLength(10);
  });
});

// resetMockServer also clears storage, so for the corrupt-data test we only drop the in-memory copy.
async function resetMockServerKeepStorage() {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.mockServerDb);
  await resetMockServer();
  if (stored) await AsyncStorage.setItem(STORAGE_KEYS.mockServerDb, stored);
}

describe('authentication', () => {
  it('rejects a missing or forged token with 401', async () => {
    await expect(getCheckins(null)).rejects.toMatchObject({ status: 401 });
    await expect(getCheckins('mock-token.user_nobody')).rejects.toMatchObject({ status: 401 });
    await expect(getCheckins('garbage')).rejects.toMatchObject({ status: 401 });
  });
});

describe('getCheckin', () => {
  it('returns one check-in', async () => {
    const token = await tokenFor('demo@health.app');
    const [first] = await getCheckins(token);
    expect(await getCheckin(token, first.id)).toEqual(first);
  });

  it('throws NotFoundError (404) for an unknown id', async () => {
    const token = await tokenFor('demo@health.app');
    await expect(getCheckin(token, 'ck_missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it("treats another user's check-in as not found", async () => {
    const [demoCheckin] = await getCheckins(await tokenFor('demo@health.app'));
    const newUserToken = await tokenFor('new@health.app');
    await expect(getCheckin(newUserToken, demoCheckin.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('createCheckin', () => {
  it('creates a check-in with a server id for the signed-in user only', async () => {
    const token = await tokenFor('new@health.app');
    const created = await createCheckin(token, newCheckin);

    expect(created.id).toMatch(/^ck_/);
    expect(created.clientId).toBe('client-abc');
    expect(created.syncStatus).toBe('synced');
    expect(await getCheckins(token)).toHaveLength(1);
    expect(await getCheckins(await tokenFor('demo@health.app'))).toHaveLength(10);
  });

  it('is idempotent: the same clientId returns the existing record instead of a duplicate', async () => {
    const token = await tokenFor('new@health.app');
    const first = await createCheckin(token, newCheckin);
    const second = await createCheckin(token, { ...newCheckin, weightKg: 99 });

    expect(second).toEqual(first);
    expect(await getCheckins(token)).toHaveLength(1);
  });

  it('survives two concurrent requests with the same clientId', async () => {
    const token = await tokenFor('new@health.app');
    const [a, b] = await Promise.all([createCheckin(token, newCheckin), createCheckin(token, newCheckin)]);
    expect(a.id).toBe(b.id);
    expect(await getCheckins(token)).toHaveLength(1);
  });
});

describe('updateCheckin and deleteCheckin', () => {
  it('updates only the given fields and bumps updatedAt', async () => {
    const token = await tokenFor('demo@health.app');
    const [first] = await getCheckins(token);
    const updated = await updateCheckin(token, first.id, { weightKg: 70 });

    expect(updated.weightKg).toBe(70);
    expect(updated.steps).toBe(first.steps);
    expect(updated.updatedAt >= first.updatedAt).toBe(true);
  });

  it('throws NotFoundError when updating or deleting something that does not exist', async () => {
    const token = await tokenFor('demo@health.app');
    await expect(updateCheckin(token, 'ck_missing', { steps: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteCheckin(token, 'ck_missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes a check-in', async () => {
    const token = await tokenFor('demo@health.app');
    const [first] = await getCheckins(token);
    await deleteCheckin(token, first.id);
    expect(await getCheckins(token)).toHaveLength(9);
    await expect(getCheckin(token, first.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('network behavior', () => {
  it('throws NetworkError when forceOffline is on, without changing data', async () => {
    const token = await tokenFor('new@health.app');
    devConfig.forceOffline = true;
    await expect(createCheckin(token, newCheckin)).rejects.toBeInstanceOf(NetworkError);
    devConfig.forceOffline = false;
    expect(await getCheckins(token)).toEqual([]);
  });

  it('throws NetworkError when NetInfo says the device is offline', async () => {
    jest.spyOn(NetInfo, 'fetch').mockResolvedValueOnce({ isConnected: false } as never);
    await expect(login('demo@health.app', 'Password123')).rejects.toBeInstanceOf(NetworkError);
  });

  it('throws ApiError(500) at the configured failure rate, without changing data', async () => {
    const token = await tokenFor('new@health.app');
    devConfig.failureRate = 1;
    await expect(createCheckin(token, newCheckin)).rejects.toMatchObject({ status: 500 });
    devConfig.failureRate = 0;
    expect(await getCheckins(token)).toEqual([]);
  });

  it('waits at least the configured latency', async () => {
    devConfig.latencyMs = { min: 50, max: 50 };
    const started = Date.now();
    await login('demo@health.app', 'Password123');
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });
});
