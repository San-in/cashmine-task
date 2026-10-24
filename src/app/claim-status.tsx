import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui';
import { ClaimStatusScreen } from '@/features/claims/claim-status-screen';
import { RequireToken } from '@/features/token/require-token';

// A query param instead of /claims/[id]: the static web host has no dynamic routes,
// and this page must survive a reload while a claim is pending.
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
