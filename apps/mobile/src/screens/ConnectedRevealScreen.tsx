import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import type { DeckLink, ManaColor, MtgFormat, PlayerVibe } from '@manamap/shared';
import { Avatar } from '../components/Avatar';
import { ManaPip } from '../components/ManaPip';
import { SocialsCard } from '../components/SocialsCard';
import { useConnectionDetail } from '../hooks/useConnections';
import { useRivalryDetail } from '../hooks/useRivalries';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { guildName, identityGradientStops, manaAccent, readableOn } from '../theme/identity';
import type { RootStackScreenProps } from '../navigation/types';

// ---------------------------------------------------------------------------
// Helpers
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
// PeerHero — identity-gradient banner matching YouScreen's IdentityHero
// ---------------------------------------------------------------------------

const BANNER_H = 160;

interface PeerHeroProps {
  displayName: string;
  pronouns?: string | null;
  avatarColors: ManaColor[];
  vibes?: PlayerVibe[];
  commander?: string | null;
  formats: MtgFormat[];
  bio?: string | null;
}

function PeerHero({
  displayName,
  pronouns,
  avatarColors,
  vibes,
  commander,
  formats,
  bio,
}: PeerHeroProps) {
  const gradient = identityGradientStops(avatarColors);
  const accent = avatarColors.length > 0 ? manaAccent(avatarColors) : colors.accent;
  const onAccent = readableOn(accent);
  const guild = guildName(avatarColors);

  const [bannerW, setBannerW] = useState(
    () => Dimensions.get('window').width,
  );

  return (
    <View style={hero.root}>
      {/* Gradient banner: avatar + name + pronouns + guild */}
      <View
        style={hero.banner}
        onLayout={(e) => setBannerW(e.nativeEvent.layout.width)}
      >
        <Svg style={StyleSheet.absoluteFill} width={bannerW} height={BANNER_H}>
          <Defs>
            <SvgLinearGradient id="peerHeroGrad" x1="0" y1="0" x2="1" y2="1">
              {gradient.map((c, i) => (
                <Stop
                  key={i}
                  offset={`${i / Math.max(1, gradient.length - 1)}`}
                  stopColor={c}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={bannerW} height={BANNER_H} fill="url(#peerHeroGrad)" />
        </Svg>

        <View style={hero.bannerContent}>
          <Avatar
            name={displayName}
            manaColors={avatarColors}
            size={64}
            style={hero.avatar}
          />
          <Text style={[hero.displayName, { color: onAccent }]} numberOfLines={1}>
            {displayName}
          </Text>
          {pronouns ? (
            <Text style={[hero.pronouns, { color: onAccent + 'CC' }]}>
              {pronouns}
            </Text>
          ) : null}
          {avatarColors.length > 0 && (
            <View style={hero.guildChip}>
              {avatarColors.map((c) => (
                <ManaPip key={c} color={c} size={14} />
              ))}
              <Text style={[hero.guildLabel, { color: onAccent }]}>{guild}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Metadata strip below banner */}
      {((vibes?.length ?? 0) > 0 || commander || formats.length > 0 || bio) && (
        <View style={hero.meta}>
          {(vibes ?? []).length > 0 && (
            <View style={hero.vibeRow}>
              {(vibes as PlayerVibe[]).map((v) => (
                <View key={v} style={[hero.vibePill, { backgroundColor: accent + '22', borderColor: accent + '44' }]}>
                  <Text style={[hero.vibeText, { color: accent }]}>{VIBE_LABELS[v]}</Text>
                </View>
              ))}
            </View>
          )}

          {commander ? (
            <View style={hero.metaRow}>
              <Ionicons name="shield-outline" size={14} color={colors.textTertiary} />
              <Text style={hero.metaText} numberOfLines={1}>{commander}</Text>
            </View>
          ) : null}

          {formats.length > 0 && (
            <View style={hero.chips}>
              {formats.map((f) => (
                <View key={f} style={hero.chip}>
                  <Text style={hero.chipText}>{FORMAT_LABELS[f]}</Text>
                </View>
              ))}
            </View>
          )}

          {bio ? (
            <Text style={hero.bio} numberOfLines={4}>{bio}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ConnectedRevealScreen
// ---------------------------------------------------------------------------

export function ConnectedRevealScreen({
  navigation,
  route,
}: RootStackScreenProps<'Connected'>) {
  const { connectionId, isNew } = route.params;
  const { data, isLoading } = useConnectionDetail(connectionId);
  const { data: rivalry } = useRivalryDetail(data?.peer.id);
  const [showBanner, setShowBanner] = useState(isNew === true);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Connected! celebration banner — only on first visit */}
      {showBanner && (
        <View style={connBanner.root}>
          <Pressable
            onPress={() => setShowBanner(false)}
            style={({ pressed }) => [connBanner.closeBtn, pressed && { opacity: 0.5 }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={colors.textInverse} />
          </Pressable>

          <View style={connBanner.badge}>
            <Ionicons name="checkmark-circle" size={24} color={colors.textInverse} />
            <Text style={connBanner.title}>Connected!</Text>
          </View>

          {data && (
            <View style={connBanner.avatarRow}>
              <View style={[connBanner.avatar, connBanner.avatarLeft]}>
                <Text style={connBanner.avatarText}>
                  {data.peer.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={connBanner.heartWrap}>
                <Ionicons name="heart" size={14} color={colors.surface} />
              </View>
              <View style={[connBanner.avatar, connBanner.avatarRight]}>
                <Text style={connBanner.avatarText}>?</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {isLoading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <>
          {/* Dismiss row — chevron above the name */}
          <View style={styles.dismissRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.5 }]}
              hitSlop={12}
            >
              <Ionicons name="chevron-down" size={26} color={colors.textTertiary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Identity hero */}
            <PeerHero
              displayName={data.peer.displayName}
              pronouns={data.peer.pronouns}
              avatarColors={data.peer.avatarColors as ManaColor[]}
              vibes={data.peer.vibes as PlayerVibe[] | undefined}
              commander={data.peer.commander}
              formats={data.peer.formats as MtgFormat[]}
              bio={data.peer.bio}
            />

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

            {/* Socials — friend-gated */}
            {data.peer.socials && (data.peer.socials.length > 0 || (data.peer.socialsSummary?.friendsOnlyCount ?? 0) > 0) && (
              <SocialsCard
                mode="friend"
                links={data.peer.socials}
                publicCount={data.peer.socialsSummary?.publicCount ?? data.peer.socials.length}
                friendsOnlyCount={data.peer.socialsSummary?.friendsOnlyCount ?? 0}
              />
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
          </ScrollView>
        </>
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
  scroll: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  dismissRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dismissBtn: {},
});

const connBanner = StyleSheet.create({
  root: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  badge: { alignItems: 'center', gap: spacing.xs },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textInverse,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.avatar,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarLeft: { marginRight: -6, zIndex: 1 },
  avatarRight: { marginLeft: -6 },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  heartWrap: {
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

const hero = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  banner: {
    height: BANNER_H,
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  avatar: {
    borderRadius: radii.xl,
    marginBottom: spacing.xs,
  },
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
  vibeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
  },
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

const decks = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.xl,
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
    marginHorizontal: spacing.xl,
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
