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
import type { ConnectedProfile, DeckLink, ManaColor, MtgFormat, PlayerVibe } from '@manamap/shared';
import { Avatar } from '../components/Avatar';
import { ManaPip } from '../components/ManaPip';
import { SocialsCard } from '../components/SocialsCard';
import { useConnectionDetail } from '../hooks/useConnections';
import { useRivalryDetail } from '../hooks/useRivalries';
import { useProfile } from '../hooks/useMe';
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

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

// ---------------------------------------------------------------------------
// CelebrationCard
// ---------------------------------------------------------------------------

const AV_SIZE = 64;
const AV_WRAP = AV_SIZE + 6; // 3px white border each side
const AV_WRAP_R = Math.round(AV_SIZE * 0.32) + 3; // mirrors Avatar's squircle radius + border

interface CelebrationCardProps {
  peer: ConnectedProfile;
  myDisplayName: string;
  myColors: ManaColor[];
  via: string | null;
  onDismiss: () => void;
}

function CelebrationCard({ peer, myDisplayName, myColors, via, onDismiss }: CelebrationCardProps) {
  const [sz, setSz] = useState({
    w: Dimensions.get('window').width - spacing.xl * 2,
    h: 230,
  });
  const peerColors = peer.avatarColors as ManaColor[];
  const gradient = identityGradientStops(peerColors);
  const accent = peerColors.length > 0 ? manaAccent(peerColors) : colors.accent;
  const on = readableOn(accent);

  return (
    <View
      style={celeb.root}
      onLayout={(e) =>
        setSz({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      <Svg style={StyleSheet.absoluteFill} width={sz.w} height={sz.h}>
        <Defs>
          <SvgLinearGradient id="celebBg" x1="0" y1="0" x2="1" y2="1">
            {gradient.map((c, i) => (
              <Stop
                key={i}
                offset={`${i / Math.max(1, gradient.length - 1)}`}
                stopColor={c}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width={sz.w} height={sz.h} fill="url(#celebBg)" />
      </Svg>

      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [celeb.closeBtn, pressed && { opacity: 0.5 }]}
        hitSlop={8}
      >
        <Ionicons name="close" size={20} color={on + 'CC'} />
      </Pressable>

      {/* Overlapping initials: me (front) + peer (behind) */}
      <View style={celeb.avatarRow}>
        <View style={[celeb.avatarWrap, celeb.avatarMe]}>
          <Avatar name={myDisplayName || '?'} manaColors={myColors} size={AV_SIZE} />
        </View>
        <View style={celeb.avatarWrap}>
          <Avatar name={peer.displayName} manaColors={peerColors} size={AV_SIZE} />
        </View>
      </View>

      <Text style={[celeb.connLabel, { color: on + 'E6' }]}>CONNECTED</Text>
      <Text style={[celeb.title, { color: on }]}>You & {peer.displayName}</Text>
      {via ? (
        <Text style={[celeb.sub, { color: on + 'EB' }]}>Cards swapped at {via}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// DeckRow (ContactRow style)
// ---------------------------------------------------------------------------

function DeckRow({ deck }: { deck: DeckLink }) {
  const siteLabel = (DECK_SITE_LABELS[deck.site] ?? deck.site).toUpperCase();
  return (
    <Pressable
      style={({ pressed }) => [drow.root, pressed && { opacity: 0.75 }]}
      onPress={() => void Linking.openURL(deck.url)}
    >
      <View style={drow.iconWell}>
        <Ionicons name="layers-outline" size={20} color={colors.accentInk} />
      </View>
      <View style={drow.info}>
        <Text style={drow.label}>{siteLabel}</Text>
        <Text style={drow.value} numberOfLines={1}>{deck.name}</Text>
        <Text style={drow.sub} numberOfLines={1}>{deck.url}</Text>
      </View>
      <View style={drow.action}>
        <Text style={drow.actionText}>Open</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// PeerHero — identity-gradient banner matching YouScreen's IdentityHero
// ---------------------------------------------------------------------------

const BANNER_H = 180;

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

      {((vibes?.length ?? 0) > 0 || commander || formats.length > 0 || bio) && (
        <View style={hero.meta}>
          {(vibes ?? []).length > 0 && (
            <View style={hero.vibeRow}>
              {(vibes as PlayerVibe[]).map((v) => (
                <View
                  key={v}
                  style={[hero.vibePill, { backgroundColor: accent + '22', borderColor: accent + '44' }]}
                >
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
  const { data: me } = useProfile();
  const [showBanner, setShowBanner] = useState(isNew === true);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isLoading || !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <>
          <View style={styles.dismissRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.5 }]}
              hitSlop={12}
            >
              <Ionicons name="chevron-down" size={26} color={colors.textTertiary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Gradient celebration card — new connection reveal */}
            {showBanner && (
              <CelebrationCard
                peer={data.peer}
                myDisplayName={me?.displayName ?? ''}
                myColors={(me?.avatarColors ?? []) as ManaColor[]}
                via={data.via}
                onDismiss={() => setShowBanner(false)}
              />
            )}

            {/* "Met at" context chip — returning to an established connection */}
            {!showBanner && data.via ? (
              <View style={styles.metChip}>
                <Ionicons name="pin-outline" size={16} color={colors.accentInk} />
                <Text style={styles.metChipText}>
                  Met at {data.via} · {relativeDate(data.createdAt)}
                </Text>
              </View>
            ) : null}

            {/* Identity hero */}
            <PeerHero
              displayName={data.peer.displayName}
              pronouns={data.peer.pronouns}
              avatarColors={data.peer.avatarColors as ManaColor[]}
              {...(data.peer.vibes ? { vibes: data.peer.vibes as PlayerVibe[] } : {})}
              commander={data.peer.commander}
              formats={data.peer.formats as MtgFormat[]}
              bio={data.peer.bio}
            />

            {/* Head-to-head rivalry */}
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
            {data.peer.socials &&
              (data.peer.socials.length > 0 ||
                (data.peer.socialsSummary?.friendsOnlyCount ?? 0) > 0) && (
              <SocialsCard
                mode="friend"
                links={data.peer.socials}
                publicCount={
                  data.peer.socialsSummary?.publicCount ?? data.peer.socials.length
                }
                friendsOnlyCount={data.peer.socialsSummary?.friendsOnlyCount ?? 0}
              />
            )}

            {/* Deck links — ContactRow style */}
            {data.peer.deckLinks.length > 0 && (
              <View style={decks.root}>
                <Text style={decks.heading}>Decks</Text>
                {(data.peer.deckLinks as DeckLink[]).map((deck) => (
                  <DeckRow key={deck.id} deck={deck} />
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
  metChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: spacing.xl,
  },
  metChipText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13.5,
    color: colors.accentInk,
    flex: 1,
  },
});

const celeb = StyleSheet.create({
  root: {
    marginHorizontal: spacing.xl,
    borderRadius: radii.lg,
    overflow: 'hidden',
    paddingTop: 32,
    paddingBottom: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...shadows.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    width: AV_WRAP,
    height: AV_WRAP,
    borderRadius: AV_WRAP_R,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarMe: {
    marginRight: -14,
    zIndex: 2,
  },
  connLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
    letterSpacing: 1.04,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 26,
    letterSpacing: -0.52,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    marginTop: 6,
  },
});

const drow = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: 12,
    paddingRight: 14,
    ...shadows.sm,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  value: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
    color: colors.textPrimary,
    marginTop: 1,
  },
  sub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  action: {
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexShrink: 0,
  },
  actionText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
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
    fontSize: 26,
    letterSpacing: -0.52,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    marginHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  heading: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
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
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
  },
});
