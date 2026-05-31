import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ManaColor, MtgFormat, PlayerVibe } from '@manamap/shared';
import { ManaPip } from '../components/ManaPip';
import { useSendConnectionRequest } from '../hooks/useConnections';
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
  const { profile, sharedEvent, lastMetStoreName } = route.params;
  const [sent, setSent] = useState(false);
  const { mutate: sendRequest, isPending } = useSendConnectionRequest();

  function handleConnect() {
    sendRequest(
      { addresseeId: profile.id, via: 'qr' },
      {
        onSuccess: () => setSent(true),
        onError: (err: unknown) => {
          const status =
            err &&
            typeof err === 'object' &&
            'response' in err &&
            (err as { response?: { status?: number } }).response?.status;
          if (status === 409) {
            Alert.alert('Already connected', 'You already have a connection with this player.');
          } else {
            Alert.alert('Error', 'Could not send request. Please try again.');
          }
        },
      },
    );
  }

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
        {/* Met before banner */}
        {lastMetStoreName !== undefined && lastMetStoreName !== null && (
          <View style={styles.metBanner}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.metBannerText} numberOfLines={1}>
              {'Met before · '}
              <Text style={styles.metBannerStore}>{lastMetStoreName}</Text>
            </Text>
          </View>
        )}

        {/* Shared event banner */}
        {sharedEvent && (
          <View style={styles.sharedEventBanner}>
            <Ionicons name="calendar" size={15} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sharedEventLabel}>You're both going to</Text>
              <Text style={styles.sharedEventName} numberOfLines={1}>{sharedEvent.name}</Text>
            </View>
          </View>
        )}

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
        {sent ? (
          <View style={styles.sentRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.sentText}>Request sent!</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              (pressed || isPending) && { opacity: 0.8 },
            ]}
            onPress={isPending ? undefined : handleConnect}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Ionicons name="person-add-outline" size={18} color={colors.textInverse} />
            )}
            <Text style={styles.ctaText}>
              {isPending ? 'Sending…' : 'Send connect request'}
            </Text>
          </Pressable>
        )}
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
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    marginTop: spacing.sm,
  },
  sentText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.success,
  },
  metBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success + '14',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  metBannerText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.success,
  },
  metBannerStore: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.success,
  },
  sharedEventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  sharedEventLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
  sharedEventName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
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
