import { LargeTitleHeader } from '../components/ui/LargeTitleHeader';
import { Screen } from '../components/ui/Screen';
import { EmptyState } from '../components/states/EmptyState';

// Placeholder: the real list arrives in Phase 4.
export function CheckinListScreen() {
  return (
    <Screen>
      <LargeTitleHeader title="Check-ins" />
      <EmptyState
        icon="list-outline"
        title="No check-ins yet"
        message="Your check-in history will be listed here."
      />
    </Screen>
  );
}
