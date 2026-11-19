import AsyncStorage from '@react-native-async-storage/async-storage';

import { getItem, removeItem, setItem } from './storage';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('storage', () => {
  it('round-trips typed JSON', async () => {
    await setItem('ht:test', { a: 1, list: ['x'] });
    expect(await getItem<{ a: number; list: string[] }>('ht:test')).toEqual({ a: 1, list: ['x'] });
  });

  it('returns null for a missing key', async () => {
    expect(await getItem('ht:missing')).toBeNull();
  });

  it('removes a key', async () => {
    await setItem('ht:test', 1);
    await removeItem('ht:test');
    expect(await getItem('ht:test')).toBeNull();
  });

  it('returns null instead of throwing when the stored value is corrupt JSON', async () => {
    await AsyncStorage.setItem('ht:test', '{not json');
    expect(await getItem('ht:test')).toBeNull();
  });

  it('reports a failed write as false instead of throwing', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    expect(await setItem('ht:test', 1)).toBe(false);
  });
});
