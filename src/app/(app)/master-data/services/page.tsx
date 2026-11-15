import OwnerOnlyBoundary from '@/components/OwnerOnlyBoundary';
import SettingsClient from '@/components/SettingsClient';

export default function MasterServicesPage() {
  return (
    <OwnerOnlyBoundary>
      <SettingsClient section="services" />
    </OwnerOnlyBoundary>
  );
}
