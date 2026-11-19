import { isOnlineFromSnapshot } from './network';

describe('isOnlineFromSnapshot', () => {
  it.each([
    [true, true, true],
    [true, null, true], // connected, internet not checked yet
    [null, null, true], // NetInfo does not know yet: do not assume offline
    [false, false, false],
    [false, null, false],
    [true, false, false], // Wi-Fi with no internet behind it
  ])('isConnected=%s isInternetReachable=%s -> online=%s', (isConnected, isInternetReachable, expected) => {
    expect(isOnlineFromSnapshot({ isConnected, isInternetReachable })).toBe(expected);
  });
});
