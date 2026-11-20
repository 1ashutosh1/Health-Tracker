import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '../stores/authStore';
import { NotFoundScreen } from './NotFoundScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

describe('NotFoundScreen', () => {
  it('signed in: explains the link and goes to the Summary tab', async () => {
    useAuthStore.setState({ status: 'signedIn', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    await render(<NotFoundScreen />);

    expect(screen.getByText('Page not found')).toBeTruthy();
    await fireEvent.press(screen.getByText('Go to Summary'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('signed out: the tabs are guarded, so it goes to Sign in instead', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null });
    await render(<NotFoundScreen />);

    await fireEvent.press(screen.getByText('Go to Sign in'));

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
