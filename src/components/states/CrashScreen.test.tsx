import { fireEvent, render, screen } from '@testing-library/react-native';

import { CrashScreen } from './CrashScreen';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CrashScreen', () => {
  it('says something went wrong and offers Restart', async () => {
    await render(<CrashScreen error={new Error('boom')} onRestart={jest.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy();
  });

  it('calls onRestart when Restart is tapped', async () => {
    const onRestart = jest.fn();
    await render(<CrashScreen error={new Error('boom')} onRestart={onRestart} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Restart' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('logs the error once, so it is not lost', async () => {
    const error = new Error('boom');
    await render(<CrashScreen error={error} onRestart={jest.fn()} />);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[crash] the app failed to render', error);
  });
});
