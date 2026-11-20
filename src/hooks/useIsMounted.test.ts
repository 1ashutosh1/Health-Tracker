import { renderHook } from '@testing-library/react-native';

import { useIsMounted } from './useIsMounted';

describe('useIsMounted', () => {
  it('is true while mounted and false after unmount', async () => {
    const { result, unmount } = await renderHook(() => useIsMounted());
    expect(result.current()).toBe(true);

    await unmount();
    expect(result.current()).toBe(false);
  });

  it('returns the same function on every render, so it is safe in dependency lists', async () => {
    const { result, rerender } = await renderHook(() => useIsMounted());
    const first = result.current;
    await rerender({});
    expect(result.current).toBe(first);
  });
});
