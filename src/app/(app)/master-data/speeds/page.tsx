import OwnerOnlyBoundary from '@/components/OwnerOnlyBoundary';
import SettingsClient from '@/components/SettingsClient';

export default function MasterSpeedsPage() {
  return (
    <OwnerOnlyBoundary>
      <SettingsClient section="speeds" />
    </OwnerOnlyBoundary>
  );
}
