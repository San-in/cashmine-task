import { ActivityScreen } from '@/features/activity/activity-screen';
import { RequireToken } from '@/features/token/require-token';

export default function ActivityRoute() {
  return (
    <RequireToken>
      <ActivityScreen />
    </RequireToken>
  );
}
