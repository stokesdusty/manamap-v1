import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ManaColor, MtgFormat, PlayerVibe } from '@manamap/shared';
import { ManaPip } from '../components/ManaPip';
import { colors, radii, shadows, spacing, typography } from '../theme';
import type { RootStackScreenProps } from '../navigation/types';

// ---------------------------------------------------------------------------
// Label maps (keep in sync with YouScreen)
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

// ---------------------------------------------------------------------------
// PlayerPreviewScreen
// ---------------------------------------------------------------------------

export function PlayerPreviewScreen({
  navigation,
  route,
}: RootStackScreenProps<'PlayerPreview'>) {
  const { profile } = route.params;

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
        <Text style={styles.headerTitle}>Player</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={card.root}>
          <View style={card.avatarRow}>
            <View style={card.avatar}>
              <Text style={card.avatarText}>
                {profile.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            {profile.avatarColors.length > 0 && (
              <View style={card.pips}>
                {(profile.avatarColors as ManaColor[]).map((c) => (
                  <ManaPip key={c} color={c} size={18} />
                ))}
              </View>
            )}
          </View>

          <View style={card.nameBlock}>
            <Text style={card.displayName}>{profile.displayName}</Text>
            {profile.pronouns ? (
              <Text style={card.pronouns}>{profile.pronouns}</Text>
            ) : null}
          </View>

          {profile.vibe ? (
            <View style={card.vibePill}>
              <Text style={card.vibeText}>
                {VIBE_LABELS[profile.vibe as PlayerVibe]}
              </Text>
            </View>
          ) : null}

          {profile.commander ? (
            <View style={card.commanderRow}>
              <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
              <Text style={card.commanderText} numberOfLines={1}>
                {profile.commander}
              </Text>
              {profile.powerLevel != null && (
                <View style={card.powerBadge}>
                  <Text style={card.powerText}>P{profile.powerLevel}</Text>
                </View>
              )}
            </View>
          ) : null}

          {profile.formats.length > 0 && (
            <View style={card.chips}>
              {(profile.formats as MtgFormat[]).map((f) => (
                <View key={f} style={card.chip}>
                  <Text style={card.chipText}>{FORMAT_LABELS[f]}</Text>
                </View>
              ))}
            </View>
          )}

          {profile.bio ? (
            <Text style={card.bio} numberOfLines={6}>
              {profile.bio}
            </Text>
          ) : null}
        </View>

        {/* Locked contact panel */}
        <View style={lock.root}>
          <View style={lock.row}>
            <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
            <Text style={lock.title}>Contact info</Text>
          </View>
          <Text style={lock.sub}>Connect to unlock Discord and contact details</Text>

          {/* Blurred placeholder bars */}
          <View style={lock.blurRow}>
            <Ionicons name="logo-discord" size={16} color={colors.border} />
            <View style={lock.bar} />
          </View>
          <View style={lock.blurRow}>
            <Ionicons name="mail-outline" size={16} color={colors.border} />
            <View style={[lock.bar, { width: '50%' }]} />
          </View>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            // Connection feature is a future deliverable
          }}
        >
          <Ionicons name="person-add-outline" size={18} color={colors.textInverse} />
          <Text style={styles.ctaText}>Send connect request</Text>
        </Pressable>
      </ScrollView>
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
  headerTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: radii.lg,
    marginTop: spacing.sm,
    ...shadows.md,
  },
  ctaText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

const card = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.md,
  },
  avatarRow: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxxl,
    color: colors.accent,
  },
  pips: { flexDirection: 'row', gap: spacing.xs },
  nameBlock: { alignItems: 'center', gap: 2 },
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

const lock = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textTertiary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  blurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    opacity: 0.4,
  },
  bar: {
    height: 14,
    width: '70%',
    backgroundColor: colors.border,
    borderRadius: radii.full,
  },
});
