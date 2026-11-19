// Runs before every test file. Replaces native AsyncStorage with an in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Native modules that do not exist in Jest. NetInfo's mock reports "connected" by default.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// In-memory stand-in for the keychain, so auth tests can save and read a token.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Icons are drawn by a native font. Tests only care that a screen renders, so stub them out.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
