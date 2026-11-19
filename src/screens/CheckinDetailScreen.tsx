import { EmptyState } from '../components/states/EmptyState';
import { Screen } from '../components/ui/Screen';

interface CheckinDetailScreenProps {
  id: string;
}

// Placeholder: the real detail view arrives in Phase 4. This is also the deep-link target.
export function CheckinDetailScreen({ id }: CheckinDetailScreenProps) {
  return (
    <Screen edges={['left', 'right']}>
      <EmptyState icon="document-text-outline" title="Check-in" message={`Details for ${id} will appear here.`} />
    </Screen>
  );
}
