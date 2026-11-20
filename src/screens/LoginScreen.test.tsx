import { render, screen } from '@testing-library/react-native';

import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from './LoginScreen';

beforeEach(() => {
  useAuthStore.setState({ status: 'signedOut', user: null, token: null, pendingDeepLink: null });
});

describe('LoginScreen deep-link note', () => {
  it('is hidden for a normal sign in', async () => {
    await render(<LoginScreen />);
    expect(screen.queryByText('Sign in to open the shared check-in')).toBeNull();
  });

  it('is shown while a shared check-in is waiting', async () => {
    useAuthStore.setState({ pendingDeepLink: 'ck_3' });
    await render(<LoginScreen />);
    expect(screen.getByText('Sign in to open the shared check-in')).toBeTruthy();
  });
});
