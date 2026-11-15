import OwnerOnlyBoundary from '@/components/OwnerOnlyBoundary';
import SettingsClient from '@/components/SettingsClient';

export default function MasterUsersPage() {
  return (
    <OwnerOnlyBoundary>
      <SettingsClient section="users" />
    </OwnerOnlyBoundary>
  );
}
