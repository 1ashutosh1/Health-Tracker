import { fireEvent, render, screen } from '@testing-library/react-native';

import { SyncBadge } from './SyncBadge';

describe('SyncBadge', () => {
  it('pending: "Pending sync", and no Retry', async () => {
    await render(<SyncBadge syncStatus="pending" onRetry={jest.fn()} />);

    expect(screen.getByLabelText('Pending sync')).toBeTruthy();
    expect(screen.queryByLabelText('Retry sync')).toBeNull();
  });

  it('failed: "Sync failed" with a tappable Retry', async () => {
    const onRetry = jest.fn();
    await render(<SyncBadge syncStatus="failed" onRetry={onRetry} />);

    expect(screen.getByLabelText('Sync failed')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retry sync'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('failed without a handler shows the badge but no Retry', async () => {
    await render(<SyncBadge syncStatus="failed" />);

    expect(screen.getByLabelText('Sync failed')).toBeTruthy();
    expect(screen.queryByLabelText('Retry sync')).toBeNull();
  });

  it('synced: nothing in a list', async () => {
    await render(<SyncBadge syncStatus="synced" />);

    expect(screen.queryByLabelText('Synced')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('synced: a small "Synced" check when asked (the detail screen)', async () => {
    await render(<SyncBadge syncStatus="synced" showSynced />);

    expect(screen.getByLabelText('Synced')).toBeTruthy();
  });
});
