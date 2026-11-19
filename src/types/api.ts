import type { CheckinFields } from './checkin';

/** Shape of the JSON body the (mock) server sends with a non-2xx response. */
export interface ApiErrorBody {
  message: string;
  code?: string;
}

/** `clientId` is the idempotency key: sending the same one twice never creates two check-ins. */
export interface CreateCheckinRequest extends CheckinFields {
  clientId: string;
}

export type UpdateCheckinRequest = Partial<CheckinFields>;
