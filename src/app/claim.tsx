import { ClaimScreen } from '@/features/claims/claim-screen';
import { RequireToken } from '@/features/token/require-token';

export default function ClaimRoute() {
  return (
    <RequireToken>
      <ClaimScreen />
    </RequireToken>
  );
}
