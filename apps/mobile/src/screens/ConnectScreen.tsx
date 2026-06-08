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
import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { ConnectionItem, Game, ManaColor } from '@manamap/shared';
import { BellButton } from '../navigation/TabNavigator';
import { ManaPip } from '../components/ManaPip';
import {
  useAcceptConnection,
  useConnections,
  useDeclineConnection,
} from '../hooks/useConnections';
import { useConfirmGame, useDisputeGame, usePendingGames } from '../hooks/useGames';
import { useProfile } from '../hooks/useMe';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabParamList, RootStackParamList } from '../navigation/types';

type ConnectScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Connections'>,
  NativeStackScreenProps<RootStackParamList>
>;

// ---------------------------------------------------------------------------
// ConnectionCard
// ---------------------------------------------------------------------------

function ConnectionCard({
  item,
  onAccept,
  onDecline,
  onPress,
  isPending,
}: {
  item: ConnectionItem;
  onAccept?: () => void;
  onDecline?: () => void;
  onPress?: () => void;
  isPending: boolean;
}) {
  const initial = item.peer.displayName.charAt(0).toUpperCase();
  const isIncoming = item.direction === 'received' && item.status === 'pending';

  return (
    <Pressable
      style={({ pressed }) => [row.root, pressed && onPress && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={row.avatar}>
        <Text style={row.avatarText}>{initial}</Text>
      </View>

      {item.peer.avatarColors.length > 0 && (
        <View style={row.pipsWrap}>
          {(item.peer.avatarColors as ManaColor[]).slice(0, 3).map((c) => (
            <ManaPip key={c} color={c} size={12} />
          ))}
        </View>
      )}

      {item.status === 'accepted' && onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}

      <View style={row.info}>
        <Text style={row.name} numberOfLines={1}>{item.peer.displayName}</Text>
        {item.peer.commander ? (
          <Text style={row.sub} numberOfLines={1}>{item.peer.commander}</Text>
        ) : (item.peer.vibes ?? []).length > 0 ? (
          <Text style={row.sub}>{(item.peer.vibes as string[]).join(' · ')}</Text>
        ) : null}
        {item.status === 'accepted' && item.peer.homeStoreName ? (
          <View style={row.storeRow}>
            <Ionicons name="storefront-outline" size={11} color={colors.textTertiary} />
            <Text style={row.storeText} numberOfLines={1}>{item.peer.homeStoreName}</Text>
          </View>
        ) : null}
        {item.status === 'accepted' && (item.peer.spelltable || item.peer.convokeGames) ? (
          <View style={row.onlineRow}>
            {item.peer.spelltable ? (
              <View style={row.onlineBadge}>
                <Ionicons name="videocam-outline" size={10} color={colors.accent} />
                <Text style={row.onlineText}>SpellTable</Text>
              </View>
            ) : null}
            {item.peer.convokeGames ? (
              <View style={row.onlineBadge}>
                <Ionicons name="globe-outline" size={10} color={colors.accent} />
                <Text style={row.onlineText}>Convoke</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {item.note ? <Text style={row.note} numberOfLines={1}>{item.note}</Text> : null}
      </View>

      {isIncoming && (
        <View style={row.actions}>
          <Pressable
            style={({ pressed }) => [row.declineBtn, pressed && { opacity: 0.6 }]}
            onPress={onDecline}
            hitSlop={4}
          >
            <Ionicons name="close" size={18} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [row.acceptBtn, pressed && { opacity: 0.8 }, isPending && row.disabled]}
            onPress={isPending ? undefined : onAccept}
            hitSlop={4}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Ionicons name="checkmark" size={18} color={colors.textInverse} />
            )}
          </Pressable>
        </View>
      )}

      {item.status === 'pending' && item.direction === 'sent' && (
        <View style={row.sentBadge}>
          <Text style={row.sentText}>Sent</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ConfirmResultsSection
// ---------------------------------------------------------------------------

function ConfirmResultsSection({ myId }: { myId: string }) {
  const { data: pending = [], isLoading } = usePendingGames();
  const { mutate: confirmGame, isPending: confirming, variables: confirmingId } = useConfirmGame();
  const { mutate: disputeGame, isPending: disputing, variables: disputingId } = useDisputeGame();

  if (isLoading || pending.length === 0) return null;

  function handleDispute(gameId: string) {
    Alert.alert('Dispute game?', 'This marks the result as disputed and no Encounters are recorded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dispute',
        style: 'destructive',
        onPress: () => disputeGame(gameId),
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Confirm results ({pending.length})</Text>
      {pending.map((game: Game) => {
        const others = game.players.filter((p) => p.userId !== myId);
        const myPlayer = game.players.find((p) => p.userId === myId);
        const winner = game.players.find((p) => p.userId === game.winnerId);
        const isConfirming = confirming && confirmingId === game.id;
        const isDisputing = disputing && disputingId === game.id;

        return (
          <View key={game.id} style={cr.card}>
            <View style={cr.header}>
              <Ionicons name="game-controller-outline" size={16} color={colors.textTertiary} />
              <Text style={cr.players} numberOfLines={1}>
                {others.map((p) => p.displayName).join(', ')} logged a game
              </Text>
            </View>

            <View style={cr.details}>
              <Text style={cr.detail}>
                Winner: <Text style={cr.detailBold}>{winner?.displayName ?? '?'}</Text>
              </Text>
              {myPlayer?.deck ? (
                <Text style={cr.detail}>Your deck: {myPlayer.deck}</Text>
              ) : null}
            </View>

            <View style={cr.actions}>
              <Pressable
                style={({ pressed }) => [cr.disputeBtn, (pressed || isDisputing) && { opacity: 0.6 }]}
                onPress={() => handleDispute(game.id)}
                disabled={isDisputing || isConfirming}
              >
                {isDisputing ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={cr.disputeText}>Dispute</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [cr.confirmBtn, (pressed || isConfirming) && { opacity: 0.8 }]}
                onPress={() => confirmGame(game.id)}
                disabled={isConfirming || isDisputing}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={cr.confirmText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const cr = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    ...shadows.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  players: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  details: { gap: 2 },
  detail: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  detailBold: { fontFamily: typography.fontFamily.semiBold, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  disputeBtn: {
    flex: 1,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.error + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  confirmBtn: {
    flex: 2,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  confirmText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
});

// ---------------------------------------------------------------------------
// ConnectScreen
// ---------------------------------------------------------------------------

export function ConnectScreen({ navigation }: ConnectScreenProps) {
  const qc = useQueryClient();
  const { data, isLoading } = useConnections();
  const { mutate: accept, isPending: accepting, variables: acceptingId } = useAcceptConnection();
  const { mutate: decline } = useDeclineConnection();
  const { data: profile } = useProfile();

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: ['connections'] });
      void qc.invalidateQueries({ queryKey: ['games', 'pending'] });
    }, [qc]),
  );

  function handleAccept(connectionId: string) {
    accept(connectionId, {
      onSuccess: (result) => {
        navigation.navigate('Connected', { connectionId: result.id, isNew: true });
      },
      onError: () => {
        Alert.alert('Error', 'Could not accept request. Please try again.');
      },
    });
  }

  function handleDecline(connectionId: string) {
    Alert.alert('Decline request?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => decline(connectionId) },
    ]);
  }

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const accepted = data?.accepted ?? [];
  const hasContent = incoming.length > 0 || outgoing.length > 0 || accepted.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Connect</Text>
        <BellButton />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {profile && <ConfirmResultsSection myId={profile.id} />}

          {!hasContent && (
            <View style={styles.emptyInline}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No connections yet</Text>
              <Text style={styles.emptyHint}>Scan a player's code to send a request</Text>
            </View>
          )}

          {incoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Incoming requests ({incoming.length})
              </Text>
              {incoming.map((item) => (
                <ConnectionCard
                  key={item.id}
                  item={item}
                  isPending={accepting && acceptingId === item.id}
                  onAccept={() => handleAccept(item.id)}
                  onDecline={() => handleDecline(item.id)}
                />
              ))}
            </View>
          )}

          {outgoing.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Sent requests</Text>
              {outgoing.map((item) => (
                <ConnectionCard key={item.id} item={item} isPending={false} />
              ))}
            </View>
          )}

          {accepted.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Connected ({accepted.length})</Text>
              {accepted.map((item) => (
                <ConnectionCard
                  key={item.id}
                  item={item}
                  isPending={false}
                  onPress={() => navigation.navigate('Connected', { connectionId: item.id })}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.textPrimary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyInline: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  scroll: { paddingVertical: spacing.md, gap: spacing.xl, paddingBottom: spacing.xxxl },
  section: { gap: spacing.xs },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

const row = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.avatar,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.accent,
  },
  pipsWrap: {
    position: 'absolute',
    left: spacing.xl + 32,
    bottom: spacing.md + 2,
    flexDirection: 'row',
    gap: 2,
  },
  info: { flex: 1 },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  storeText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    flexShrink: 1,
  },
  onlineRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 3,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  onlineText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
  note: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  disabled: { opacity: 0.6 },
  sentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  sentText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
});
