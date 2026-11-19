import { create } from 'zustand';

interface NetworkState {
  /** Starts true: until NetInfo says otherwise, assume a connection so the first fetch is not skipped. */
  isOnline: boolean;
  /** When `isOnline` last flipped. null until it has. */
  lastChangedAt: number | null;
  setOnline: (isOnline: boolean) => void;
}

export const useNetworkStore = create<NetworkState>()((set, get) => ({
  isOnline: true,
  lastChangedAt: null,

  setOnline: (isOnline) => {
    // NetInfo repeats itself (for example when the connection type changes). Only real flips count.
    if (get().isOnline === isOnline) return;
    set({ isOnline, lastChangedAt: Date.now() });
  },
}));
