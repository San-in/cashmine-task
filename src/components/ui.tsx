import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.tint }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
        (pressed || inactive) && { opacity: inactive ? 0.5 : 0.8 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.onTint : theme.text} />
      ) : (
        <ThemedText type="smallBold" style={{ color: primary ? theme.onTint : theme.text }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>
  );
}

/** Scrollable page limited to a phone-sized column. */
export function Screen({ children, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      {...rest}>
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

export function LoadingState({ message, hint }: { message: string; hint?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="warning" style={styles.centerText}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

type ErrorStateProps = {
  title: string;
  message: string;
  actionTitle: string;
  onAction: () => void;
  retrying?: boolean;
};

export function ErrorState({ title, message, actionTitle, onAction, retrying }: ErrorStateProps) {
  return (
    <View style={styles.centered}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>
      <Button title={actionTitle} onPress={onAction} loading={retrying} />
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.centered}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const theme = useTheme();
  const color = tone === 'info' ? theme.tint : theme[tone];
  return <View style={[styles.banner, { borderColor: color }]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  screenContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
