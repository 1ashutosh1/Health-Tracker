import { useLocalSearchParams } from 'expo-router';

import { CheckinDetailScreen } from '../../../screens/CheckinDetailScreen';

export default function CheckinDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CheckinDetailScreen id={id} />;
}
