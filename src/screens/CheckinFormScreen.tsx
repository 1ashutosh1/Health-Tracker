import { EmptyState } from '../components/states/EmptyState';
import { Screen } from '../components/ui/Screen';

interface CheckinFormScreenProps {
  /** Present when editing an existing check-in, absent when creating one. */
  checkinId?: string;
}

// Placeholder: the real form arrives in Phase 4.
export function CheckinFormScreen({ checkinId }: CheckinFormScreenProps) {
  return (
    <Screen edges={['left', 'right']}>
      <EmptyState
        icon="create-outline"
        title={checkinId ? 'Edit check-in' : 'New check-in'}
        message="The check-in form will appear here."
      />
    </Screen>
  );
}
