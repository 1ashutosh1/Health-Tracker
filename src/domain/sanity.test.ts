import AsyncStorage from '@react-native-async-storage/async-storage';

describe('jest setup', () => {
  it('runs a test', () => {
    expect(1 + 1).toBe(2);
  });

  it('mocks AsyncStorage in memory', async () => {
    await AsyncStorage.setItem('ht:sanity', 'ok');
    expect(await AsyncStorage.getItem('ht:sanity')).toBe('ok');
  });
});
