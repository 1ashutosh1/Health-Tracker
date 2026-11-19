import { getToken } from '../storage/secureStorage';
import type { CreateCheckinRequest, UpdateCheckinRequest } from '../types/api';
import type { Checkin } from '../types/checkin';
import * as server from './mockServer';

/**
 * The app's only door to check-in data. Like an HTTP client adding an Authorization header,
 * each call attaches the saved token, so callers never pass it around.
 * A missing token reaches the server as null and is rejected with a 401.
 */
export async function getCheckins(): Promise<Checkin[]> {
  return server.getCheckins(await getToken());
}

export async function getCheckin(id: string): Promise<Checkin> {
  return server.getCheckin(await getToken(), id);
}

export async function createCheckin(request: CreateCheckinRequest): Promise<Checkin> {
  return server.createCheckin(await getToken(), request);
}

export async function updateCheckin(id: string, changes: UpdateCheckinRequest): Promise<Checkin> {
  return server.updateCheckin(await getToken(), id, changes);
}

export async function deleteCheckin(id: string): Promise<void> {
  return server.deleteCheckin(await getToken(), id);
}
