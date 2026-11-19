import { useLocalSearchParams } from 'expo-router';

import { CheckinFormScreen } from '../../../screens/CheckinFormScreen';

export default function EditCheckinRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CheckinFormScreen checkinId={id} />;
}
