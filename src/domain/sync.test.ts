import { makeCheckin } from '../test-utils/makeCheckin';
import type { Checkin } from '../types/checkin';
import { ApiError, NetworkError } from '../utils/errors';
import {
  backoffDelayMs,
  buildPendingCheckin,
  formatSyncedMessage,
  isLocalId,
  mergeWithOutbox,
  syncOutbox,
  toCreateRequest,
} from './sync';

const NOW = 1_000_000;

/** An outbox item as the repository creates it. */
const pending = (clientId: string, overrides: Partial<Checkin> = {}) =>
  makeCheckin({ id: `local_${clientId}`, clientId, syncStatus: 'pending', ...overrides });

/** A stand-in server: creating is idempotent on clientId, like the real one. */
function fakeServer() {
  const records = new Map<string, Checkin>();
  const create = async (item: Checkin): Promise<Checkin> => {
    const existing = records.get(item.clientId);
    if (existing) return existing;
    const created = { ...item, id: `ck_${item.clientId}`, syncStatus: 'synced' as const };
    records.set(item.clientId, created);
    return created;
  };
  return { records, create };
}

describe('syncOutbox', () => {
  it('returns empty results for an empty outbox without calling the server', async () => {
    const createFn = jest.fn();

    const result = await syncOutbox([], createFn, NOW);

    expect(result).toEqual({ synced: [], failed: [] });
    expect(createFn).not.toHaveBeenCalled();
  });

  it('syncs everything when all succeed', async () => {
    const server = fakeServer();
    const items = [pending('a'), pending('b')];

    const result = await syncOutbox(items, server.create, NOW);

    expect(result.failed).toEqual([]);
    expect(result.synced.map((s) => s.clientId)).toEqual(['a', 'b']);
    expect(result.synced[0].serverCheckin).toMatchObject({ id: 'ck_a', syncStatus: 'synced' });
  });

  it('keeps going after a failure and reports each outcome separately', async () => {
    const server = fakeServer();
    const createFn = jest.fn(async (item: Checkin) => {
      if (item.clientId === 'b') throw new ApiError(500, 'Server error');
      return server.create(item);
    });
    const items = [
      pending('a', { checkinDate: '2026-01-01' }),
      pending('b', { checkinDate: '2026-01-02' }),
      pending('c', { checkinDate: '2026-01-03' }),
    ];

    const result = await syncOutbox(items, createFn, NOW);

    expect(result.synced.map((s) => s.clientId)).toEqual(['a', 'c']);
    expect(result.failed).toEqual([
      { clientId: 'b', error: 'Server error', attempts: 1, nextRetryAt: NOW + 4000 },
    ]);
    expect(createFn).toHaveBeenCalledTimes(3);
  });

  it('reports every item as failed when all fail', async () => {
    const createFn = jest.fn().mockRejectedValue(new NetworkError());

    const result = await syncOutbox([pending('a'), pending('b')], createFn, NOW);

    expect(result.synced).toEqual([]);
    expect(result.failed.map((f) => f.clientId)).toEqual(['a', 'b']);
    expect(result.failed[0].error).toBe('No connection. Check your network and try again.');
  });

  it('never leaks internal error text', async () => {
    const createFn = jest.fn().mockRejectedValue(new Error('TypeError at line 42 of secret.js'));

    const { failed } = await syncOutbox([pending('a')], createFn, NOW);

    expect(failed[0].error).toBe('Something went wrong. Please try again.');
  });

  describe('backoff', () => {
    it('counts attempts across runs and doubles the wait: 4s, 8s, 16s ... capped at 60s', async () => {
      expect([1, 2, 3, 4, 5, 6, 10].map(backoffDelayMs)).toEqual([4000, 8000, 16_000, 32_000, 60_000, 60_000, 60_000]);

      const createFn = jest.fn().mockRejectedValue(new ApiError(500, 'x'));
      const item = pending('a', { syncStatus: 'failed', syncAttempts: 2 });

      const { failed } = await syncOutbox([item], createFn, NOW);

      expect(failed[0]).toMatchObject({ attempts: 3, nextRetryAt: NOW + 16_000 });
    });

    it('skips an item whose retry time is still in the future', async () => {
      const server = fakeServer();
      const createFn = jest.fn(server.create);
      const waiting = pending('wait', { syncStatus: 'failed', syncAttempts: 1, nextRetryAt: NOW + 1 });
      const ready = pending('ready');

      const result = await syncOutbox([waiting, ready], createFn, NOW);

      expect(createFn).toHaveBeenCalledTimes(1);
      expect(result.synced.map((s) => s.clientId)).toEqual(['ready']);
      // Skipped means "not touched": it is in neither list, so its saved backoff stays as it was.
      expect(result.failed).toEqual([]);
    });

    it('tries an item once its retry time has arrived', async () => {
      const server = fakeServer();
      const due = pending('due', { syncStatus: 'failed', syncAttempts: 1, nextRetryAt: NOW });

      const result = await syncOutbox([due], server.create, NOW);

      expect(result.synced).toHaveLength(1);
    });

    it('force tries items even while they are waiting', async () => {
      const server = fakeServer();
      const waiting = pending('wait', { syncStatus: 'failed', syncAttempts: 3, nextRetryAt: NOW + 60_000 });

      const result = await syncOutbox([waiting], server.create, NOW, { force: true });

      expect(result.synced.map((s) => s.clientId)).toEqual(['wait']);
    });
  });

  describe('ordering', () => {
    it('sends oldest check-in date first, whatever order the outbox is in', async () => {
      const sent: string[] = [];
      const createFn = async (item: Checkin) => {
        sent.push(item.clientId);
        return item;
      };
      const items = [
        pending('newest', { checkinDate: '2026-03-03' }),
        pending('oldest', { checkinDate: '2026-03-01' }),
        pending('middle', { checkinDate: '2026-03-02' }),
      ];

      const result = await syncOutbox(items, createFn, NOW);

      expect(sent).toEqual(['oldest', 'middle', 'newest']);
      expect(result.synced.map((s) => s.clientId)).toEqual(sent);
    });

    it('breaks ties on the same date by when each was created', async () => {
      const sent: string[] = [];
      const createFn = async (item: Checkin) => {
        sent.push(item.clientId);
        return item;
      };
      const items = [
        pending('second', { checkinDate: '2026-03-01', createdAt: '2026-03-01T09:00:00.000Z' }),
        pending('first', { checkinDate: '2026-03-01', createdAt: '2026-03-01T08:00:00.000Z' }),
      ];

      await syncOutbox(items, createFn, NOW);

      expect(sent).toEqual(['first', 'second']);
    });

    it('sends one at a time, never two requests at once', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const createFn = async (item: Checkin) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return item;
      };

      await syncOutbox([pending('a'), pending('b'), pending('c')], createFn, NOW);

      expect(maxInFlight).toBe(1);
    });

    it('does not reorder or change the array it was given', async () => {
      const items = [pending('b', { checkinDate: '2026-03-02' }), pending('a', { checkinDate: '2026-03-01' })];
      const snapshot = [...items];

      await syncOutbox(items, async (item) => item, NOW);

      expect(items).toEqual(snapshot);
    });
  });

  describe('idempotent retry', () => {
    it('does not create a duplicate when the server saved the item but the reply was lost', async () => {
      const server = fakeServer();
      let replyLost = true;
      // The request reaches the server and is saved, then the connection drops before the answer arrives.
      const flaky = async (item: Checkin) => {
        const created = await server.create(item);
        if (replyLost) {
          replyLost = false;
          throw new NetworkError();
        }
        return created;
      };
      const item = pending('a');

      const first = await syncOutbox([item], flaky, NOW);
      expect(first.synced).toEqual([]);
      expect(first.failed).toHaveLength(1);
      expect(server.records.size).toBe(1);

      const retried = { ...item, syncStatus: 'failed' as const, syncAttempts: 1, nextRetryAt: first.failed[0].nextRetryAt };
      const second = await syncOutbox([retried], flaky, NOW + 10_000);

      expect(second.synced).toHaveLength(1);
      expect(second.synced[0].serverCheckin.id).toBe('ck_a');
      expect(server.records.size).toBe(1); // still exactly one
    });
  });
});

describe('mergeWithOutbox', () => {
  it('puts pending items first, then the server list', () => {
    const server = [makeCheckin({ id: 'ck_1' }), makeCheckin({ id: 'ck_2' })];
    const outbox = [pending('x')];

    expect(mergeWithOutbox(outbox, server).map((c) => c.id)).toEqual(['local_x', 'ck_1', 'ck_2']);
  });

  it('drops an outbox item the server already has (same clientId), keeping the server copy', () => {
    const serverCopy = makeCheckin({ id: 'ck_9', clientId: 'x', weightKg: 71 });
    const outbox = [pending('x', { weightKg: 70 }), pending('y')];

    const merged = mergeWithOutbox(outbox, [serverCopy]);

    expect(merged.map((c) => c.id)).toEqual(['local_y', 'ck_9']);
    expect(merged.find((c) => c.clientId === 'x')?.weightKg).toBe(71);
  });

  it('never lists the same clientId twice even if the outbox itself has a duplicate', () => {
    const merged = mergeWithOutbox([pending('x'), pending('x')], []);

    expect(merged).toHaveLength(1);
  });

  it('works with an empty outbox, an empty server list, or both', () => {
    const server = [makeCheckin()];
    expect(mergeWithOutbox([], server)).toEqual(server);
    expect(mergeWithOutbox([pending('x')], [])).toHaveLength(1);
    expect(mergeWithOutbox([], [])).toEqual([]);
  });

  it('does not change its inputs', () => {
    const outbox = [pending('x')];
    const server = [makeCheckin()];

    mergeWithOutbox(outbox, server);

    expect(outbox).toHaveLength(1);
    expect(server).toHaveLength(1);
  });
});

describe('local check-ins', () => {
  const fields = {
    weightKg: 72,
    heightCm: 175,
    sleepHours: 7,
    steps: 5000,
    waterLitres: 2,
    mood: 'happy' as const,
    notes: 'ok',
    checkinDate: '2026-11-19',
  };

  it('buildPendingCheckin makes a "local_" item that is pending, with the clientId kept', () => {
    const item = buildPendingCheckin(fields, 'abc', '2026-11-19T10:00:00.000Z');

    expect(item).toMatchObject({
      ...fields,
      id: 'local_abc',
      clientId: 'abc',
      syncStatus: 'pending',
      createdAt: '2026-11-19T10:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z',
    });
  });

  it('isLocalId tells device-only ids from server ids', () => {
    expect(isLocalId('local_abc')).toBe(true);
    expect(isLocalId('ck_abc')).toBe(false);
  });

  it('toCreateRequest sends the fields and the clientId, and nothing local', () => {
    const request = toCreateRequest({ ...buildPendingCheckin(fields, 'abc', 'now'), syncError: 'x', syncAttempts: 2, nextRetryAt: 5 });

    expect(request).toEqual({ ...fields, clientId: 'abc' });
  });
});

describe('formatSyncedMessage', () => {
  it('uses the singular for one and the plural otherwise', () => {
    expect(formatSyncedMessage(1)).toBe('Synced 1 check-in');
    expect(formatSyncedMessage(2)).toBe('Synced 2 check-ins');
  });
});
