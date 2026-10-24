import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui';
import { TokenForm } from '@/features/token/token-form';

export default function TokenScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TokenForm onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
