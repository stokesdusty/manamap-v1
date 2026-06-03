import { ActivityIndicator, Clipboard, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { DeckLink, ManaColor, MtgFormat, PlayerVibe } from '@manamap/shared';
import { ManaPip } from '../components/ManaPip';
import { useConnectionDetail } from '../hooks/useConnections';
import { useRivalryDetail } from '../hooks/useRivalries';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type { RootStackScreenProps } from '../navigation/types';

// ---------------------------------------------------------------------------
// Helpers (shared with PlayerPreviewScreen)
// ---------------------------------------------------------------------------

const VIBE_LABELS: Record<PlayerVibe, string> = {
  competitive: 'Competitive',
  casual: 'Casual',
  spike: 'Spike',
  timmy: 'Timmy',
  johnny: 'Johnny',
  vorthos: 'Vorthos',
};

const FORMAT_LABELS: Record<MtgFormat, string> = {
  standard: 'Standard',
  pioneer: 'Pioneer',
  modern: 'Modern',
  legacy: 'Legacy',
  vintage: 'Vintage',
  commander: 'Commander',
  draft: 'Draft',
};

const DECK_SITE_LABELS: Record<string, string> = {
  moxfield: 'Moxfield',
  archidekt: 'Archidekt',
};

// ---------------------------------------------------------------------------
// ConnectedRevealScreen
// ---------------------------------------------------------------------------

export function ConnectedRevealScreen({
  navigation,
  route,
}: RootStackScreenProps<'Connected'>) {
  const { connectionId } = route.params;
  const { data, isLoading } = useConnectionDetail(connectionId);
  const { data: rivalry } = useRivalryDetail(data?.peer.id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Gradient-style header */}
      <View style={header.root}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [header.closeBtn, pressed && { opacity: 0.5 }]}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={colors.textInverse} />
        </Pressable>

        <View style={header.badge}>
          <Ionicons name="checkmark-circle" size={32} color={colors.textInverse} />
          <Text style={header.title}>Connected!</Text>
        </View>

        {data && (
          <View style={header.avatarRow}>
            <View style={[header.avatar, header.avatarLeft]}>
              <Text style={header.avatarText}>
                {data.peer.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={header.heartWrap}>
              <Ionicons name="heart" size={20} color={colors.surface} />
            </View>
            <View style={[header.avatar, header.avatarRight]}>
              <Text style={header.avatarText}>?</Text>
            </View>
          </View>
        )}
      </View>

      {isLoading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <View style={card.root}>
            <View style={card.nameRow}>
              <Text style={card.displayName}>{data.peer.displayName}</Text>
              {data.peer.pronouns ? (
                <Text style={card.pronouns}>{data.peer.pronouns}</Text>
              ) : null}
            </View>

            {data.peer.avatarColors.length > 0 && (
              <View style={card.pips}>
                {(data.peer.avatarColors as ManaColor[]).map((c) => (
                  <ManaPip key={c} color={c} size={18} />
                ))}
              </View>
            )}

            {data.peer.vibe ? (
              <View style={card.vibePill}>
                <Text style={card.vibeText}>{VIBE_LABELS[data.peer.vibe as PlayerVibe]}</Text>
              </View>
            ) : null}

            {data.peer.commander ? (
              <View style={card.commanderRow}>
                <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
                <Text style={card.commanderText} numberOfLines={1}>{data.peer.commander}</Text>
                {data.peer.powerLevel != null && (
                  <View style={card.powerBadge}>
                    <Text style={card.powerText}>P{data.peer.powerLevel}</Text>
                  </View>
                )}
              </View>
            ) : null}

            {data.peer.formats.length > 0 && (
              <View style={card.chips}>
                {(data.peer.formats as MtgFormat[]).map((f) => (
                  <View key={f} style={card.chip}>
                    <Text style={card.chipText}>{FORMAT_LABELS[f]}</Text>
                  </View>
                ))}
              </View>
            )}

            {data.peer.bio ? (
              <Text style={card.bio} numberOfLines={4}>{data.peer.bio}</Text>
            ) : null}
          </View>

          {/* Contact panel — now unlocked */}
          <View style={contact.root}>
            <View style={contact.titleRow}>
              <Ionicons name="lock-open-outline" size={16} color={colors.success} />
              <Text style={contact.title}>Contact info</Text>
            </View>

            {data.peer.discordHandle ? (
              <Pressable
                style={({ pressed }) => [contact.row, pressed && { opacity: 0.7 }]}
                onPress={() => Clipboard.setString(data.peer.discordHandle!)}
              >
                <Ionicons name="logo-discord" size={20} color="#5865F2" />
                <Text style={contact.value}>{data.peer.discordHandle}</Text>
                <Ionicons name="copy-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            ) : (
              <View style={contact.row}>
                <Ionicons name="logo-discord" size={20} color={colors.border} />
                <Text style={contact.empty}>Discord not shared</Text>
              </View>
            )}
          </View>

          {/* Head-to-head */}
          {rivalry && (
            <View style={hth.root}>
              <View style={hth.titleRow}>
                <Ionicons name="game-controller-outline" size={16} color={colors.textSecondary} />
                <Text style={hth.title}>Head-to-head</Text>
                {rivalry.hot && <Text style={hth.flame}>🔥</Text>}
              </View>
              <View style={hth.statsRow}>
                <View style={hth.stat}>
                  <Text style={hth.statValue}>{rivalry.gamesTogether}</Text>
                  <Text style={hth.statLabel}>Games</Text>
                </View>
                <View style={hth.divider} />
                <View style={hth.stat}>
                  <Text style={hth.statValue}>{rivalry.wins}</Text>
                  <Text style={hth.statLabel}>Your wins</Text>
                </View>
                <View style={hth.divider} />
                <View style={hth.stat}>
                  <Text style={hth.statValue}>{rivalry.losses}</Text>
                  <Text style={hth.statLabel}>Their wins</Text>
                </View>
              </View>
            </View>
          )}

          {/* Deck links */}
          {data.peer.deckLinks.length > 0 && (
            <View style={decks.root}>
              <Text style={decks.heading}>Decks</Text>
              {(data.peer.deckLinks as DeckLink[]).map((deck) => (
                <Pressable
                  key={deck.id}
                  style={({ pressed }) => [decks.row, pressed && { opacity: 0.7 }]}
                  onPress={() => void Linking.openURL(deck.url)}
                >
                  <View style={decks.siteTag}>
                    <Text style={decks.siteText}>{DECK_SITE_LABELS[deck.site] ?? deck.site}</Text>
                  </View>
                  <Text style={decks.name} numberOfLines={1}>{deck.name}</Text>
                  <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.8 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  doneBtn: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    ...shadows.md,
  },
  doneBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

const header = StyleSheet.create({
  root: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  badge: { alignItems: 'center', gap: spacing.xs },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.textInverse,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarLeft: { marginRight: -8, zIndex: 1 },
  avatarRight: { marginLeft: -8 },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textInverse,
  },
  heartWrap: {
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

const card = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.md,
  },
  nameRow: { alignItems: 'center', gap: 2 },
  displayName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  pronouns: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  pips: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  vibePill: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  vibeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  commanderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  commanderText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  powerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  powerText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  bio: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

const contact = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.success,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  value: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
});

const decks = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.md,
  },
  heading: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  siteTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  siteText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
});

const hth = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    flex: 1,
  },
  flame: { fontSize: 16 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  divider: { width: 1, height: 32, backgroundColor: colors.borderLight, marginHorizontal: spacing.sm },
});
