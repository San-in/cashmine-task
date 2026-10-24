import { BalancesScreen } from '@/features/balances/balances-screen';
import { RequireToken } from '@/features/token/require-token';

export default function HomeRoute() {
  return (
    <RequireToken>
      <BalancesScreen />
    </RequireToken>
  );
}
