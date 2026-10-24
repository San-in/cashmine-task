import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { maskToken, useTokenContext } from '@/features/token/token-context';
import { useTheme } from '@/hooks/use-theme';

export function TokenForm({ onDone }: { onDone?: () => void }) {
  const theme = useTheme();
  const { state, saveToken, clearToken } = useTokenContext();
  const [value, setValue] = useState('');
  const current = state.status === 'ready' ? state.token : null;
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed) return;
    saveToken(trimmed);
    setValue('');
    onDone?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">CashMine</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Enter your API token to see your payback. It is kept only in this browser.
        </ThemedText>
      </View>

      <Card>
        {current ? (
          <ThemedText type="small" themeColor="textSecondary">
            Current token: {maskToken(current)}
          </ThemedText>
        ) : null}
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={submit}
          placeholder={current ? 'New token' : 'Token'}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          secureTextEntry
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          accessibilityLabel="API token"
        />
        <Button title={current ? 'Save new token' : 'Continue'} onPress={submit} disabled={!trimmed} />
        {current ? (
          <Button
            title="Forget token"
            variant="secondary"
            onPress={() => {
              clearToken();
              onDone?.();
            }}
          />
        ) : null}
      </Card>

      {state.status === 'ready' && !state.persisted ? (
        <Banner tone="warning">
          <ThemedText type="small">
            This browser blocked storage, so you will need to enter the token again next time.
          </ThemedText>
        </Banner>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
