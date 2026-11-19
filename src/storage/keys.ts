/** Every AsyncStorage key the app uses, in one place. All are namespaced with "ht:". */
export const STORAGE_KEYS = {
  authUser: 'ht:auth-user',
  /** The check-ins last fetched from the server, so the app can show them offline. */
  checkinsCache: 'ht:checkins-cache',
  /** Check-ins created on the device that the server has not accepted yet. */
  outbox: 'ht:outbox',
  /** The mock server's own database. Deliberately separate from the client's cache keys. */
  mockServerDb: 'ht:mock-server-db',
} as const;

/**
 * expo-secure-store only accepts letters, digits, ".", "-" and "_" in a key, so ":" is not allowed.
 * We keep the same "ht" namespace but use "." as the separator.
 */
export const SECURE_KEYS = {
  authToken: 'ht.auth-token',
} as const;
