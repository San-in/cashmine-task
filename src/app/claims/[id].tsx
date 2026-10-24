import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui';
import { ClaimStatusScreen } from '@/features/claims/claim-status-screen';
import { RequireToken } from '@/features/token/require-token';

export default function ClaimStatusRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RequireToken>
      <Screen>
        <ClaimStatusScreen id={id} />
      </Screen>
    </RequireToken>
  );
}
