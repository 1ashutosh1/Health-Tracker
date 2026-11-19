import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Typed JSON wrapper over AsyncStorage.
 * Storage can fail (disk full, corrupt value), and a broken cache must never crash the app.
 * So reads return null on any failure, and writes report success as a boolean.
 */
export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (error) {
    console.warn(`[storage] could not read "${key}"`, error);
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storage] could not write "${key}"`, error);
    return false;
  }
}

export async function removeItem(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] could not remove "${key}"`, error);
    return false;
  }
}
