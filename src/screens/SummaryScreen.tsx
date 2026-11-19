import { Alert } from 'react-native';

import { LargeTitleHeader } from '../components/ui/LargeTitleHeader';
import { Screen } from '../components/ui/Screen';
import { EmptyState } from '../components/states/EmptyState';
import { useAuthStore } from '../stores/authStore';

// Placeholder: the real dashboard arrives in Phase 5. The account menu is final.
export function SummaryScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const openAccountMenu = () => {
    Alert.alert(user?.name ?? 'Account', user?.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Screen>
      <LargeTitleHeader title="Summary" onAvatarPress={openAccountMenu} />
      <EmptyState
        icon="heart-outline"
        title="Your summary is on the way"
        message="Weight, sleep, steps and mood will appear here once check-ins are connected."
      />
    </Screen>
  );
}
