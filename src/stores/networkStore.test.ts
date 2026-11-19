import { useNetworkStore } from './networkStore';

beforeEach(() => {
  useNetworkStore.setState({ isOnline: true, lastChangedAt: null });
});

afterEach(() => jest.restoreAllMocks());

describe('networkStore', () => {
  it('starts online, with no change recorded', () => {
    expect(useNetworkStore.getState()).toMatchObject({ isOnline: true, lastChangedAt: null });
  });

  it('records when the connection flips', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5000);

    useNetworkStore.getState().setOnline(false);

    expect(useNetworkStore.getState()).toMatchObject({ isOnline: false, lastChangedAt: 5000 });
  });

  it('ignores repeats of the same state, so lastChangedAt only moves on a real change', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1000);
    useNetworkStore.getState().setOnline(false);

    now.mockReturnValue(2000);
    useNetworkStore.getState().setOnline(false);

    expect(useNetworkStore.getState().lastChangedAt).toBe(1000);
  });
});
