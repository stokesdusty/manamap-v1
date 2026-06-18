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
import { BellButton } from '../components/BellButton';
import { useAddContact } from '../hooks/useContacts';
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
  onAddContact,
  isPending,
}: {
  item: ConnectionItem;
  onAccept?: () => void;
  onDecline?: () => void;
  onPress?: () => void;
  onAddContact?: () => void;
  isPending: boolean;
}) {
  const initial = item.peer.displayName.charAt(0).toUpperCase();
  const isIncoming = item.direction === 'received' && item.status === 'pending';
  const isSent = item.direction === 'sent' && item.status === 'pending';
  const isAccepted = item.status === 'accepted';

  const sub = item.peer.commander
    ?? (item.peer.vibes ?? []).slice(0, 2).join(' · ')
    ?? null;

  // ── Incoming request — full card with accept/decline buttons ──
  if (isIncoming) {
    return (
      <View style={row.reqCard}>
        <View style={row.reqTop}>
          <View style={[row.avatar, { width: 50, height: 50 }]}>
            <Text style={row.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={row.name} numberOfLines={1}>{item.peer.displayName}</Text>
            {item.peer.avatarColors.length > 0 && (
              <View style={row.pipsRow}>
                {(item.peer.avatarColors as ManaColor[]).slice(0, 5).map((c) => (
                  <ManaPip key={c} color={c} size={16} />
                ))}
              </View>
            )}
          </View>
        </View>

        {item.note ? (
          <View style={row.noteBlock}>
            <Text style={row.noteText}>"{item.note}"</Text>
          </View>
        ) : null}

        <View style={row.reqActions}>
          <Pressable
            style={({ pressed }) => [row.declineBtn, pressed && { opacity: 0.6 }]}
            onPress={onDecline}
          >
            <Text style={row.declineText}>Decline</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [row.acceptBtn, isPending && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
            onPress={isPending ? undefined : onAccept}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Ionicons name="checkmark" size={15} color={colors.textInverse} />
                <Text style={row.acceptText}>Accept</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Accepted connection — tappable row card ──
  if (isAccepted) {
    return (
      <Pressable
        style={({ pressed }) => [row.connCard, pressed && { opacity: 0.75 }]}
        onPress={onPress}
      >
        <View style={row.avatar}>
          <Text style={row.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={row.connName} numberOfLines={1}>{item.peer.displayName}</Text>
          <View style={row.pipsRow}>
            {(item.peer.avatarColors as ManaColor[]).slice(0, 5).map((c) => (
              <ManaPip key={c} color={c} size={15} />
            ))}
            {sub ? <Text style={row.connSub} numberOfLines={1}> · {sub}</Text> : null}
          </View>
        </View>
        {onAddContact && (
          <Pressable onPress={onAddContact} hitSlop={8} style={row.addContactBtn}>
            <Ionicons name="person-add-outline" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>
    );
  }

  // ── Sent / outgoing request ──
  if (isSent) {
    return (
      <View style={row.connCard}>
        <View style={row.avatar}>
          <Text style={row.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={row.connName} numberOfLines={1}>{item.peer.displayName}</Text>
          {item.peer.avatarColors.length > 0 && (
            <View style={row.pipsRow}>
              {(item.peer.avatarColors as ManaColor[]).slice(0, 5).map((c) => (
                <ManaPip key={c} color={c} size={15} />
              ))}
            </View>
          )}
        </View>
        <View style={row.sentBadge}>
          <Text style={row.sentText}>Sent</Text>
        </View>
      </View>
    );
  }

  return null;
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
  const { mutate: addContact } = useAddContact();

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
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Connections</Text>
        </View>
        <BellButton />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {profile && <ConfirmResultsSection myId={profile.id} />}

          {/* Requests — always rendered */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {incoming.length > 0
                ? `${incoming.length} Request${incoming.length > 1 ? 's' : ''}`
                : 'Requests'}
            </Text>
            {incoming.length > 0 ? (
              incoming.map((item) => (
                <ConnectionCard
                  key={item.id}
                  item={item}
                  isPending={accepting && acceptingId === item.id}
                  onAccept={() => handleAccept(item.id)}
                  onDecline={() => handleDecline(item.id)}
                />
              ))
            ) : (
              <View style={styles.emptyRequests}>
                <Text style={styles.emptyRequestsTitle}>You're all caught up</Text>
                <Text style={styles.emptyRequestsHint}>New requests show up here.</Text>
              </View>
            )}
          </View>

          {/* Connected */}
          {accepted.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Connections · {accepted.length}</Text>
              {accepted.map((item) => (
                <ConnectionCard
                  key={item.id}
                  item={item}
                  isPending={false}
                  onPress={() => navigation.navigate('Connected', { connectionId: item.id })}
                  onAddContact={() => addContact(item.peer.displayName)}
                />
              ))}
            </View>
          )}

          {/* Sent */}
          {outgoing.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Sent requests</Text>
              {outgoing.map((item) => (
                <ConnectionCard key={item.id} item={item} isPending={false} />
              ))}
            </View>
          )}

          {!hasContent && accepted.length === 0 && (
            <View style={styles.emptyInline}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No connections yet</Text>
              <Text style={styles.emptyHint}>Scan a player's code to send a request</Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backBtn: {
    marginLeft: -4,
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
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.xl },
  section: { gap: 11, paddingHorizontal: spacing.xl },
  sectionLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  emptyRequests: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 3,
  },
  emptyRequestsTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyRequestsHint: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    color: colors.textTertiary,
  },
});

const row = StyleSheet.create({
  // Incoming request card
  reqCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
    gap: 12,
    ...shadows.sm,
  },
  reqTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reqActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 2,
  },
  noteBlock: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  noteText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  declineBtn: {
    flex: 1,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  acceptBtn: {
    flex: 2,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    ...shadows.sm,
  },
  acceptText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },

  // Accepted / sent connection card
  connCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
    ...shadows.sm,
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
  pipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16.5,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  connName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  connSub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textTertiary,
    flexShrink: 1,
  },
  addContactBtn: {
    padding: 4,
  },
  sentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  sentText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
});
