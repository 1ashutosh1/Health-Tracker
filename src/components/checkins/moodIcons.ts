import type { Mood } from '../../types/checkin';
import type { IconName } from '../../types/ui';

/** One icon per mood, used by the list row, the picker, the filter chips and the detail screen. */
export const MOOD_ICONS: Record<Mood, IconName> = {
  happy: 'happy-outline',
  neutral: 'remove-circle-outline',
  sad: 'sad-outline',
};
