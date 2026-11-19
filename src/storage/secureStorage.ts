import * as SecureStore from 'expo-secure-store';

import { SECURE_KEYS } from './keys';

/** The auth token lives in the OS keychain / keystore, never in plain AsyncStorage. */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.authToken);
  } catch (error) {
    console.warn('[secureStorage] could not read the token', error);
    return null;
  }
}

export async function setToken(token: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.authToken, token);
    return true;
  } catch (error) {
    console.warn('[secureStorage] could not save the token', error);
    return false;
  }
}

export async function clearToken(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.authToken);
    return true;
  } catch (error) {
    console.warn('[secureStorage] could not delete the token', error);
    return false;
  }
}
