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
import type { ConnectionItem, ManaColor } from '@manamap/shared';
import { ManaPip } from '../components/ManaPip';
import {
  useAcceptConnection,
  useConnections,
  useDeclineConnection,
} from '../hooks/useConnections';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabParamList, RootStackParamList } from '../navigation/types';

type ConnectScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Connect'>,
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

      <View style={row.info}>
        <Text style={row.name} numberOfLines={1}>{item.peer.displayName}</Text>
        {item.peer.commander ? (
          <Text style={row.sub} numberOfLines={1}>{item.peer.commander}</Text>
        ) : item.peer.vibe ? (
          <Text style={row.sub}>{item.peer.vibe}</Text>
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

      {item.status === 'accepted' && onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
// ConnectScreen
// ---------------------------------------------------------------------------

export function ConnectScreen({ navigation }: ConnectScreenProps) {
  const { data, isLoading } = useConnections();
  const { mutate: accept, isPending: accepting, variables: acceptingId } = useAcceptConnection();
  const { mutate: decline } = useDeclineConnection();

  function handleAccept(connectionId: string) {
    accept(connectionId, {
      onSuccess: (result) => {
        navigation.navigate('Connected', { connectionId: result.id });
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
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !hasContent ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No connections yet</Text>
          <Text style={styles.emptyHint}>Scan a player's code to send a request</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
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
    borderRadius: radii.full,
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
