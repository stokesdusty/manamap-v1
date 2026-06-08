import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dev'>;

type ActionId =
  | 'populate-store'
  | 'host-pod'
  | 'request-me'
  | 'accept-mine'
  | 'log-game-with-me'
  | 'full-scene'
  | 'pod-for-tracker'
  | 'invite-spelltable'
  | 'invite-convoke'
  | 'reset';

interface Action {
  id: ActionId;
  label: string;
  desc: string;
  invalidates: string[][];
  body?: Record<string, unknown>;
  danger?: boolean;
  openTracker?: true;
}

const ACTIONS: Action[] = [
  {
    id: 'populate-store',
    label: 'Populate Store',
    desc: 'Check in 4 bots + open LFG sessions at your current store',
    invalidates: [['nearby'], ['lfg', 'feed'], ['pods', 'feed']],
  },
  {
    id: 'host-pod',
    label: 'Host a Pod',
    desc: 'Bot creates a pod you can request to join',
    invalidates: [['pods', 'feed']],
  },
  {
    id: 'request-me',
    label: 'Send Me a Request',
    desc: 'Bot sends a connection request to your inbox',
    invalidates: [['connections']],
  },
  {
    id: 'accept-mine',
    label: 'Accept My Requests',
    desc: 'Bots accept all pending requests you sent them',
    invalidates: [['connections']],
  },
  {
    id: 'log-game-with-me',
    label: 'Log Game With Me',
    desc: 'Bot logs a game you must confirm (you win by default)',
    invalidates: [['games', 'pending']],
  },
  {
    id: 'full-scene',
    label: 'Full Scene',
    desc: 'Populate store + host pod + send request + log game',
    invalidates: [['nearby'], ['lfg', 'feed'], ['pods', 'feed'], ['connections'], ['games', 'pending']],
  },
  {
    id: 'pod-for-tracker',
    label: '♥ Life Tracker Pod',
    desc: 'Create a 4-player commander pod with bots and open the life tracker',
    invalidates: [['pods', 'feed']],
    body: { seats: 4 },
    openTracker: true,
  },
  {
    id: 'invite-spelltable',
    label: '🌐 SpellTable Invite',
    desc: 'Bot sends you a play-online invite with a fake SpellTable room link',
    invalidates: [['notifications']],
  },
  {
    id: 'invite-convoke',
    label: '📹 Convoke Invite',
    desc: 'Bot sends you a play-online invite with a fake Convoke room link',
    invalidates: [['notifications']],
  },
  {
    id: 'reset',
    label: 'Reset',
    desc: 'Clear all bot presence/LFG/pods/pending connections/pending games',
    invalidates: [['nearby'], ['lfg', 'feed'], ['pods', 'feed'], ['connections'], ['games', 'pending']],
    danger: true,
  },
];

export function DevScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<ActionId | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const run = useCallback(
    async (action: Action) => {
      setLoading(action.id);
      setLastResult(null);
      try {
        const { data } = await api.post<Record<string, unknown>>(
          `/v1/dev/${action.id}`,
          action.body ?? {},
        );
        for (const key of action.invalidates) {
          void qc.invalidateQueries({ queryKey: key });
        }
        setLastResult(JSON.stringify(data, null, 2));
        if (action.openTracker && typeof data['podId'] === 'string') {
          navigation.navigate('LifeTracker', { podId: data['podId'] });
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Unknown error');
        Alert.alert('Error', msg);
      } finally {
        setLoading(null);
      }
    },
    [qc, navigation],
  );

  const confirmAndRun = useCallback(
    (action: Action) => {
      if (!action.danger) {
        void run(action);
        return;
      }
      Alert.alert(action.label, 'This clears all bot data. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => void run(action) },
      ]);
    },
    [run],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Dev Panel</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [
              styles.card,
              action.danger && styles.cardDanger,
              pressed && styles.cardPressed,
              loading === action.id && styles.cardLoading,
            ]}
            onPress={() => confirmAndRun(action)}
            disabled={loading !== null}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardText}>
                <Text style={[styles.cardLabel, action.danger && styles.labelDanger]}>
                  {action.label}
                </Text>
                <Text style={styles.cardDesc}>{action.desc}</Text>
              </View>
              {loading === action.id ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : null}
            </View>
          </Pressable>
        ))}

        {lastResult ? (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>Last result</Text>
            <Text style={styles.resultBody}>{lastResult}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            DEV_TOOLS mode — not visible in production
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  closeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardDanger: {
    borderColor: colors.error,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardLoading: {
    opacity: 0.5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  labelDanger: {
    color: colors.error,
  },
  cardDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  result: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  resultLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultBody: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
});
