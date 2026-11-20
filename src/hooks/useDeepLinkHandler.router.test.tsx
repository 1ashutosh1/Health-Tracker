import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { useSyncExternalStore } from 'react';

import { useAuthStore } from '../stores/authStore';
import type { User } from '../types/auth';

// This renders the REAL src/app (root layout, guards, route files). Only the screens inside are replaced
// with labels, so the test is about navigation: what opens, and where Back goes.
function mockLabel(text: string) {
  const { Text } = jest.requireActual('react-native');
  return <Text>{text}</Text>;
}
jest.mock('../screens/LoginScreen', () => ({
  LoginScreen: () => {
    const { usePendingDeepLink } = jest.requireActual('./usePendingDeepLink');
    return mockLabel(usePendingDeepLink() ? 'login screen (link waiting)' : 'login screen');
  },
}));
jest.mock('../screens/SummaryScreen', () => ({ SummaryScreen: () => mockLabel('summary screen') }));
jest.mock('../screens/CheckinListScreen', () => ({ CheckinListScreen: () => mockLabel('list screen') }));
jest.mock('../screens/CheckinFormScreen', () => ({ CheckinFormScreen: () => mockLabel('form screen') }));
jest.mock('../screens/CheckinDetailScreen', () => ({
  CheckinDetailScreen: ({ id }: { id: string }) => mockLabel(`detail screen ${id}`),
}));
jest.mock('../screens/NotFoundScreen', () => ({ NotFoundScreen: () => mockLabel('not found screen') }));

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 1,
  Inter_500Medium: 1,
  Inter_600SemiBold: 1,
  Inter_700Bold: 1,
}));
// expo-font needs expo-asset, which npm nests under expo/ where Jest cannot find it. Fonts are not under test.
jest.mock('expo-font', () => ({}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => true),
}));
jest.mock('./useNetworkMonitor', () => ({ useNetworkMonitor: () => {} }));
jest.mock('./useNetworkSync', () => ({ useNetworkSync: () => {} }));

// The URL the app was opened with, controlled by hand. expo-linking's real useURL reads the native side.
let mockCurrentUrl: string | null = null;
const mockUrlListeners = new Set<() => void>();
function useMockURL() {
  return useSyncExternalStore(
    (listener) => {
      mockUrlListeners.add(listener);
      return () => mockUrlListeners.delete(listener);
    },
    () => mockCurrentUrl,
  );
}
// Importing expo-router/testing-library installs its own expo-linking mock, which would override a jest.mock()
// here. So patch that mock directly. This runs before the app (and useDeepLinkHandler) is first loaded.
jest.requireMock('expo-linking').useURL = useMockURL;

const USER: User = { id: 'u1', email: 'a@b.c', name: 'A' };

/** A new URL arrives while the app is running (warm start). */
async function receiveUrl(url: string) {
  mockCurrentUrl = url;
  await act(async () => mockUrlListeners.forEach((notify) => notify()));
}

async function signIn() {
  await act(async () => useAuthStore.setState({ status: 'signedIn', user: USER, token: 't' }));
}

async function renderApp(initialUrl: string, status: 'signedIn' | 'signedOut') {
  // hydrate() reads storage, which is empty in tests. Seed the session the way hydrate would leave it.
  useAuthStore.setState(
    status === 'signedIn'
      ? { status, user: USER, token: 't', pendingDeepLink: null }
      : { status, user: null, token: null, pendingDeepLink: null },
  );
  mockCurrentUrl = initialUrl;
  await renderRouter('./src/app', { initialUrl });
}

beforeEach(() => {
  mockCurrentUrl = null;
  mockUrlListeners.clear();
  jest.spyOn(useAuthStore.getState(), 'hydrate').mockResolvedValue();
});

describe('deep link healthtracker://checkin/:id', () => {
  it('cold start, signed in: opens the detail, and Back goes to the tabs', async () => {
    await renderApp('/checkin/ck_3', 'signedIn');

    expect(await screen.findByText('detail screen ck_3')).toBeTruthy();
    expect(screen).toHavePathname('/checkin/ck_3');

    await act(async () => router.back());

    expect(screen).toHavePathname('/');
    expect(screen.getByText('summary screen')).toBeTruthy();
  });

  it('cold start, signed in: the check-in opens once, not twice', async () => {
    await renderApp('/checkin/ck_3', 'signedIn');
    await screen.findByText('detail screen ck_3');

    await act(async () => router.back());

    expect(screen.queryByText('detail screen ck_3')).toBeNull(); // not a second copy underneath
  });

  it('signed out: remembers the link, shows Login, and after login opens the detail with the tabs under it', async () => {
    await renderApp('/login', 'signedOut');
    expect(await screen.findByText('login screen')).toBeTruthy();

    await receiveUrl('healthtracker://checkin/ck_3');
    expect(useAuthStore.getState().pendingDeepLink).toBe('ck_3');
    expect(await screen.findByText('login screen (link waiting)')).toBeTruthy();

    await signIn();

    expect(await screen.findByText('detail screen ck_3')).toBeTruthy();
    expect(useAuthStore.getState().pendingDeepLink).toBeNull();

    await act(async () => router.back());
    expect(screen.getByText('summary screen')).toBeTruthy();
  });

  it('a link to an unknown path is not remembered', async () => {
    await renderApp('/login', 'signedOut');
    await receiveUrl('healthtracker://banana');
    expect(useAuthStore.getState().pendingDeepLink).toBeNull();
  });

  it('is not re-opened at the next login, and a logout drops a link that was never opened', async () => {
    await renderApp('/login', 'signedOut');
    await receiveUrl('healthtracker://checkin/ck_3');
    await signIn();
    await screen.findByText('detail screen ck_3');

    await act(async () => useAuthStore.getState().reset()); // log out
    expect(useAuthStore.getState().pendingDeepLink).toBeNull(); // the old URL is still in useURL, but was handled

    await signIn();
    expect(screen.queryByText('detail screen ck_3')).toBeNull();
    expect(screen.getByText('summary screen')).toBeTruthy();
  });
});

describe('unknown paths', () => {
  it('shows the not-found screen', async () => {
    await renderApp('/banana', 'signedIn');
    expect(await screen.findByText('not found screen')).toBeTruthy();
  });
});
