import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import type { ManaColor, MtgFormat, PlayerVibe, ReportReason } from '@manamap/shared';
import { Avatar } from '../components/Avatar';
import { ManaPip } from '../components/ManaPip';
import { SocialsCard } from '../components/SocialsCard';
import { useSendConnectionRequest } from '../hooks/useConnections';
import { useBlockUser, useReportUser } from '../hooks/useSafety';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { guildName, identityGradientStops, manaAccent, readableOn } from '../theme/identity';
import type { RootStackScreenProps } from '../navigation/types';

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Other' },
];

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
// ProfileHero
// ---------------------------------------------------------------------------

const BANNER_H = 160;

function ProfileHero({ profile }: { profile: { displayName: string; pronouns?: string | null; avatarColors: string[]; vibes?: string[] | undefined; commander?: string | null; formats: string[]; bio?: string | null } }) {
  const avatarColors = profile.avatarColors as ManaColor[];
  const gradient = identityGradientStops(avatarColors);
  const accent = avatarColors.length > 0 ? manaAccent(avatarColors) : colors.accent;
  const onAccent = readableOn(accent);
  const guild = guildName(avatarColors);
  const [bannerW, setBannerW] = useState(() => Dimensions.get('window').width);

  return (
    <View style={hero.root}>
      <View style={hero.banner} onLayout={(e) => setBannerW(e.nativeEvent.layout.width)}>
        <Svg style={StyleSheet.absoluteFill} width={bannerW} height={BANNER_H}>
          <Defs>
            <SvgLinearGradient id="previewHeroGrad" x1="0" y1="0" x2="1" y2="1">
              {gradient.map((c, i) => (
                <Stop key={i} offset={`${i / Math.max(1, gradient.length - 1)}`} stopColor={c} />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={bannerW} height={BANNER_H} fill="url(#previewHeroGrad)" />
        </Svg>
        <View style={hero.bannerContent}>
          <Avatar name={profile.displayName} manaColors={avatarColors} size={64} style={hero.avatar} />
          <Text style={[hero.displayName, { color: onAccent }]} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.pronouns ? (
            <Text style={[hero.pronouns, { color: onAccent + 'CC' }]}>{profile.pronouns}</Text>
          ) : null}
          {avatarColors.length > 0 && (
            <View style={hero.guildChip}>
              {avatarColors.map((c) => <ManaPip key={c} color={c} size={14} />)}
              <Text style={[hero.guildLabel, { color: onAccent }]}>{guild}</Text>
            </View>
          )}
        </View>
      </View>

      {((profile.vibes?.length ?? 0) > 0 || profile.commander || profile.formats.length > 0 || profile.bio) && (
        <View style={hero.meta}>
          {(profile.vibes ?? []).length > 0 && (
            <View style={hero.vibeRow}>
              {(profile.vibes as PlayerVibe[]).map((v) => (
                <View key={v} style={[hero.vibePill, { backgroundColor: accent + '22', borderColor: accent + '44' }]}>
                  <Text style={[hero.vibeText, { color: accent }]}>{VIBE_LABELS[v]}</Text>
                </View>
              ))}
            </View>
          )}
          {profile.commander ? (
            <View style={hero.metaRow}>
              <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
              <Text style={hero.metaText} numberOfLines={1}>{profile.commander}</Text>
            </View>
          ) : null}
          {profile.formats.length > 0 && (
            <View style={hero.chips}>
              {(profile.formats as MtgFormat[]).map((f) => (
                <View key={f} style={hero.chip}>
                  <Text style={hero.chipText}>{FORMAT_LABELS[f]}</Text>
                </View>
              ))}
            </View>
          )}
          {profile.bio ? (
            <Text style={hero.bio} numberOfLines={4}>{profile.bio}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [alsoBlock, setAlsoBlock] = useState(false);
  const { mutate: blockUser, isPending: isBlocking } = useBlockUser();
  const { mutate: reportUser, isPending: isReporting } = useReportUser();

  function handleBlock() {
    setMenuOpen(false);
    Alert.alert(
      'Block player',
      `Block ${profile.displayName}? They won't appear in discovery and any connection will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            blockUser(
              { userId: profile.id },
              { onSuccess: () => navigation.goBack() },
            ),
        },
      ],
    );
  }

  function handleOpenReport() {
    setMenuOpen(false);
    setSelectedReason(null);
    setAlsoBlock(false);
    setReportOpen(true);
  }

  function handleSubmitReport() {
    if (!selectedReason) return;
    reportUser(
      { userId: profile.id, reason: selectedReason, context: 'PlayerPreview' },
      {
        onSuccess: () => {
          setReportOpen(false);
          if (alsoBlock) {
            blockUser({ userId: profile.id }, { onSuccess: () => navigation.goBack() });
          } else {
            Alert.alert('Report submitted', 'Thank you for keeping ManaMap safe.');
          }
        },
      },
    );
  }

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
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.5 }]}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
        </Pressable>
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
        <ProfileHero profile={profile} />

        {/* Socials — public links + teaser */}
        {(profile.socials && profile.socials.length > 0) || (profile.socialsSummary?.friendsOnlyCount ?? 0) > 0 ? (
          <SocialsCard
            mode="public"
            links={profile.socials ?? []}
            publicCount={profile.socialsSummary?.publicCount ?? (profile.socials?.length ?? 0)}
            friendsOnlyCount={profile.socialsSummary?.friendsOnlyCount ?? 0}
          />
        ) : (
          <View style={lock.root}>
            <View style={lock.row}>
              <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
              <Text style={lock.title}>Contact info</Text>
            </View>
            <Text style={lock.sub}>Connect to unlock socials and contact details</Text>
            <View style={lock.blurRow}>
              <Ionicons name="logo-discord" size={16} color={colors.border} />
              <View style={lock.bar} />
            </View>
            <View style={lock.blurRow}>
              <Ionicons name="globe-outline" size={16} color={colors.border} />
              <View style={[lock.bar, { width: '50%' }]} />
            </View>
          </View>
        )}

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

      {/* Overflow menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={menu.overlay} onPress={() => setMenuOpen(false)}>
          <View style={menu.sheet}>
            <Text style={menu.name} numberOfLines={1}>{profile.displayName}</Text>
            <Pressable
              style={({ pressed }) => [menu.item, pressed && { opacity: 0.6 }]}
              onPress={handleOpenReport}
            >
              <Ionicons name="flag-outline" size={20} color={colors.textPrimary} />
              <Text style={menu.itemText}>Report player</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [menu.item, menu.itemDanger, pressed && { opacity: 0.6 }]}
              onPress={handleBlock}
              disabled={isBlocking}
            >
              <Ionicons name="ban-outline" size={20} color={colors.error} />
              <Text style={[menu.itemText, { color: colors.error }]}>Block player</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [menu.cancel, pressed && { opacity: 0.6 }]}
              onPress={() => setMenuOpen(false)}
            >
              <Text style={menu.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Report sheet */}
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={menu.overlay} onPress={() => setReportOpen(false)}>
          <View style={[menu.sheet, { gap: spacing.sm }]}>
            <Text style={menu.name}>Report {profile.displayName}</Text>
            <Text style={menu.sectionLabel}>Reason</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.value}
                style={({ pressed }) => [
                  menu.reasonRow,
                  selectedReason === r.value && menu.reasonRowActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setSelectedReason(r.value)}
              >
                <Text style={[menu.itemText, selectedReason === r.value && { color: colors.accent }]}>
                  {r.label}
                </Text>
                {selectedReason === r.value && (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                )}
              </Pressable>
            ))}
            <Pressable
              style={[menu.reasonRow, alsoBlock && menu.reasonRowActive]}
              onPress={() => setAlsoBlock((v) => !v)}
            >
              <Text style={[menu.itemText, alsoBlock && { color: colors.accent }]}>
                Also block this player
              </Text>
              {alsoBlock && <Ionicons name="checkmark" size={16} color={colors.accent} />}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                menu.submitBtn,
                (!selectedReason || isReporting) && { opacity: 0.5 },
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleSubmitReport}
              disabled={!selectedReason || isReporting}
            >
              {isReporting ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={menu.submitText}>Submit report</Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [menu.cancel, pressed && { opacity: 0.6 }]}
              onPress={() => setReportOpen(false)}
            >
              <Text style={menu.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  menuBtn: { width: 36, alignItems: 'flex-end' },
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

const hero = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  banner: { height: BANNER_H, overflow: 'hidden' },
  bannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  avatar: { borderRadius: radii.xl, marginBottom: spacing.xs },
  displayName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
  },
  pronouns: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
  },
  guildChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  guildLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    marginLeft: 2,
  },
  meta: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  vibePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  vibeText: { fontFamily: typography.fontFamily.medium, fontSize: typography.fontSize.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: {
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

const menu = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  itemDanger: {},
  itemText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  reasonRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  submitBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  cancel: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
});
