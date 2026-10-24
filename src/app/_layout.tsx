import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';

import { TokenProvider } from '@/features/token/token-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createQueryClient } from '@/lib/query-client';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TokenProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ title: 'Payback' }} />
            <Stack.Screen name="token" options={{ title: 'API token' }} />
          </Stack>
        </ThemeProvider>
      </TokenProvider>
    </QueryClientProvider>
  );
}
