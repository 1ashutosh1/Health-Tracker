/** Every AsyncStorage key the app uses, in one place. All are namespaced with "ht:". */
export const STORAGE_KEYS = {
  authUser: 'ht:auth-user',
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
