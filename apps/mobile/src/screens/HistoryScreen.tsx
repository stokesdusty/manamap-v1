import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { EncounterItem, ManaColor } from '@manamap/shared';
import { useEncounters } from '../hooks/useEncounters';
import { colors, radii, spacing, typography } from '../theme';
import type { RootStackScreenProps } from '../navigation/types';

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function groupLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const thisWeekStart = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const day = dayKey(iso);
  if (day === today) return 'Today';
  if (day >= thisWeekStart) return 'This week';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'This week', 'Earlier'];

function relativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return diffMin <= 1 ? 'just now' : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Source badge
// ---------------------------------------------------------------------------

const SOURCE_CONFIG = {
  PRESENCE: { label: 'Crossed paths', icon: 'radio-outline' as const, color: colors.accent },
  CONNECTION: { label: 'Connected', icon: 'person-add-outline' as const, color: '#16a34a' },
  GAME: { label: 'Played a game', icon: 'game-controller-outline' as const, color: '#9333ea' },
};

// ---------------------------------------------------------------------------
// Encounter card
// ---------------------------------------------------------------------------

const MANA_COLORS: Record<ManaColor, string> = {
  W: colors.mana.W,
  U: colors.mana.U,
  B: colors.mana.B,
  R: colors.mana.R,
  G: colors.mana.G,
};

function EncounterCard({ item, onPress }: { item: EncounterItem; onPress: () => void }) {
  const src = SOURCE_CONFIG[item.source] ?? SOURCE_CONFIG.GAME;
  const fill =
    item.peer.avatarColors.length > 0
      ? (MANA_COLORS[item.peer.avatarColors[0] as ManaColor] ?? colors.border)
      : colors.border;
  const textFill = ['W', 'G'].includes(item.peer.avatarColors[0]) ? colors.textPrimary : colors.textInverse;

  return (
    <Pressable style={({ pressed }) => [card.root, pressed && { opacity: 0.75 }]} onPress={onPress}>
      {/* Avatar */}
      <View style={[card.avatar, { backgroundColor: fill }]}>
        <Text style={[card.avatarText, { color: textFill }]}>
          {item.peer.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={card.info}>
        <Text style={card.name} numberOfLines={1}>{item.peer.displayName}</Text>

        <View style={card.metaRow}>
          <Ionicons name={src.icon} size={12} color={src.color} />
          <Text style={[card.sourceText, { color: src.color }]}>{src.label}</Text>
          {item.storeName && (
            <>
              <Text style={card.atText}> · </Text>
              <Ionicons name="storefront-outline" size={12} color={colors.textTertiary} />
              <Text style={card.atText} numberOfLines={1}>{item.storeName}</Text>
            </>
          )}
        </View>

        {item.peer.commander && (
          <Text style={card.sub} numberOfLines={1}>{item.peer.commander}</Text>
        )}
      </View>

      {/* Timestamp */}
      <Text style={card.time}>{relativeDate(item.createdAt)}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HistoryScreen
// ---------------------------------------------------------------------------

export function HistoryScreen({ navigation }: RootStackScreenProps<'History'>) {
  const { data, isLoading } = useEncounters();
  const encounters = data?.encounters ?? [];
  const crossedPathsCount = data?.crossedPathsCount ?? 0;

  // Deduplicate: one entry per peer, most recent encounter wins
  const seen = new Set<string>();
  const unique: EncounterItem[] = [];
  for (const e of encounters) {
    if (!seen.has(e.peer.id)) {
      seen.add(e.peer.id);
      unique.push(e);
    }
  }

  // Group by date section
  const sectionMap = new Map<string, EncounterItem[]>();
  for (const e of unique) {
    const label = groupLabel(e.createdAt);
    if (!sectionMap.has(label)) sectionMap.set(label, []);
    sectionMap.get(label)!.push(e);
  }
  const sections = GROUP_ORDER
    .filter((g) => sectionMap.has(g))
    .map((g) => ({ title: g, data: sectionMap.get(g)! }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-down" size={28} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.title}>History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Crossed-paths nudge */}
      {crossedPathsCount > 0 && (
        <View style={styles.nudge}>
          <Ionicons name="radio-outline" size={18} color={colors.accentInk} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nudgeText}>
              You've crossed paths with{' '}
              <Text style={styles.nudgeCount}>{crossedPathsCount}</Text>
              {` player${crossedPathsCount !== 1 ? 's' : ''} you haven't connected with yet`}
            </Text>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [{ marginTop: 6 }, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.nudgeAction}>See nearby players ›</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : unique.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyWell}>
            <Ionicons name="time-outline" size={28} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyHint}>
            Players you meet at stores or connect with will appear here
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.peer.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionLabel}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <EncounterCard
              item={item}
              onPress={() =>
                navigation.navigate('PlayerPreview', {
                  profile: item.peer,
                  lastMetStoreName: item.storeName ?? null,
                })
              }
            />
          )}
          showsVerticalScrollIndicator={false}
        />
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 19,
    letterSpacing: -0.38,
    color: colors.textPrimary,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: 12,
    marginBottom: 4,
    padding: 13,
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent + '38',
  },
  nudgeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13.5,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  nudgeCount: {
    fontFamily: typography.fontFamily.bold,
    color: colors.accentInk,
  },
  nudgeAction: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accentInk,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyWell: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 17,
    letterSpacing: -0.25,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 21,
  },
  list: { paddingBottom: spacing.xxxl },
  sectionLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 6,
  },
});

const card = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  info: { flex: 1, gap: 3 },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    letterSpacing: -0.15,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexWrap: 'nowrap',
  },
  sourceText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
  },
  atText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    flexShrink: 1,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  time: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    alignSelf: 'flex-start',
    paddingTop: 2,
    flexShrink: 0,
  },
});
