import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';

import { STORAGE_KEYS } from '../storage/keys';
import { getItem, removeItem, setItem } from '../storage/storage';
import type { CreateCheckinRequest, UpdateCheckinRequest } from '../types/api';
import type { AuthSession, User } from '../types/auth';
import type { Checkin } from '../types/checkin';
import { ApiError, NetworkError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { buildSeedDb, isMockDb, type MockDb, type ServerCheckin } from './mockDb';

/**
 * A fake remote REST server that lives inside the app.
 * It has its own database (persisted, so data survives restarts like a real backend)
 * and behaves like a network service: latency, offline errors and random failures.
 * The rest of the app never imports this file. It goes through authApi and checkinsApi.
 */

export interface DevConfig {
  /** Every request waits a random time between min and max milliseconds. */
  latencyMs: { min: number; max: number };
  /** 0 to 1. The chance that a request fails with a 500. */
  failureRate: number;
  /** Pretend the phone has no connection, whatever NetInfo says. */
  forceOffline: boolean;
}

/** Mutable on purpose: change it at runtime (for example from a dev menu) to test slow or flaky networks. */
export const devConfig: DevConfig = {
  latencyMs: { min: 600, max: 1500 },
  failureRate: 0,
  forceOffline: false,
};

// ---------- the database ----------

// One shared load, so two early requests never read storage twice and diverge.
let dbPromise: Promise<MockDb> | null = null;

function getDb(): Promise<MockDb> {
  dbPromise ??= (async () => {
    const stored = await getItem<unknown>(STORAGE_KEYS.mockServerDb);
    if (isMockDb(stored)) return stored;
    const seeded = buildSeedDb();
    await setItem(STORAGE_KEYS.mockServerDb, seeded);
    return seeded;
  })();
  return dbPromise;
}

async function saveDb(db: MockDb): Promise<void> {
  await setItem(STORAGE_KEYS.mockServerDb, db);
}

/** Wipes the server's data. The next request re-seeds it. Used by tests and a future dev menu. */
export async function resetMockServer(): Promise<void> {
  dbPromise = null;
  await removeItem(STORAGE_KEYS.mockServerDb);
}

// ---------- what every request goes through ----------

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function isOffline(): Promise<boolean> {
  if (devConfig.forceOffline) return true;
  const state = await NetInfo.fetch();
  // `null` means "unknown yet". Only a definite false counts as offline.
  return state.isConnected === false;
}

/** Network behavior shared by every endpoint. Throws before the endpoint touches any data. */
async function simulateRequest(label: string): Promise<void> {
  logger.debug(`[mockServer] ${label}`);

  // A phone with no connection fails fast; it does not wait for the "server".
  if (await isOffline()) throw new NetworkError();

  const { min, max } = devConfig.latencyMs;
  await wait(min + Math.random() * Math.max(0, max - min));

  if (Math.random() < devConfig.failureRate) {
    throw new ApiError(500, 'Something went wrong on our side. Please try again.');
  }
}

// ---------- tokens ----------

const TOKEN_PREFIX = 'mock-token.';

const tokenFor = (userId: string) => `${TOKEN_PREFIX}${userId}`;

/** Resolves a bearer token to the signed-in user's id, or throws 401. */
async function authenticate(token: string | null): Promise<{ db: MockDb; userId: string }> {
  const db = await getDb();
  const userId = token?.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null;
  if (!userId || !db.users.some((u) => u.id === userId)) {
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }
  return { db, userId };
}

/** Strips the server-only `userId` column before data is sent to the client. */
function toClientCheckin({ userId: _userId, ...checkin }: ServerCheckin): Checkin {
  return { ...checkin };
}

const findOwned = (db: MockDb, userId: string, id: string) =>
  db.checkins.find((c) => c.id === id && c.userId === userId);

// ---------- endpoints ----------

export async function login(email: string, password: string): Promise<AuthSession> {
  await simulateRequest('POST /login');
  const db = await getDb();

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email === normalizedEmail && u.password === password);
  if (!user) throw new ApiError(401, 'Incorrect email or password');

  const publicUser: User = { id: user.id, email: user.email, name: user.name };
  return { token: tokenFor(user.id), user: publicUser };
}

export async function getCheckins(token: string | null): Promise<Checkin[]> {
  await simulateRequest('GET /checkins');
  const { db, userId } = await authenticate(token);

  return db.checkins
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.checkinDate.localeCompare(a.checkinDate) || b.createdAt.localeCompare(a.createdAt))
    .map(toClientCheckin);
}

export async function getCheckin(token: string | null, id: string): Promise<Checkin> {
  await simulateRequest(`GET /checkins/${id}`);
  const { db, userId } = await authenticate(token);

  const found = findOwned(db, userId, id);
  // Someone else's check-in looks exactly like a missing one, so ids cannot be probed.
  if (!found) throw new NotFoundError('Check-in not found');
  return toClientCheckin(found);
}

/** Idempotent: sending the same `clientId` again returns the record that already exists. */
export async function createCheckin(token: string | null, request: CreateCheckinRequest): Promise<Checkin> {
  await simulateRequest('POST /checkins');
  const { db, userId } = await authenticate(token);

  const existing = db.checkins.find((c) => c.userId === userId && c.clientId === request.clientId);
  if (existing) return toClientCheckin(existing);

  const now = new Date().toISOString();
  const created: ServerCheckin = {
    ...request,
    id: `ck_${randomUUID()}`,
    userId,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  };
  db.checkins.push(created);
  await saveDb(db);
  return toClientCheckin(created);
}

export async function updateCheckin(
  token: string | null,
  id: string,
  changes: UpdateCheckinRequest,
): Promise<Checkin> {
  await simulateRequest(`PATCH /checkins/${id}`);
  const { db, userId } = await authenticate(token);

  const found = findOwned(db, userId, id);
  if (!found) throw new NotFoundError('Check-in not found');

  Object.assign(found, changes, { updatedAt: new Date().toISOString() });
  await saveDb(db);
  return toClientCheckin(found);
}

export async function deleteCheckin(token: string | null, id: string): Promise<void> {
  await simulateRequest(`DELETE /checkins/${id}`);
  const { db, userId } = await authenticate(token);

  const index = db.checkins.findIndex((c) => c.id === id && c.userId === userId);
  if (index === -1) throw new NotFoundError('Check-in not found');

  db.checkins.splice(index, 1);
  await saveDb(db);
}
