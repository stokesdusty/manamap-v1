import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StoreEvent } from '@manamap/shared';
import type { TabParamList, RootStackParamList } from '../navigation/types';
import { useActiveStore } from '../context/ActiveStoreContext';
import { useIdentityTheme } from '../hooks/useIdentityTheme';
import { useProfile } from '../hooks/useMe';
import { useNearby, useStoreEvents } from '../hooks/useNearby';
import { useLeaderboard, useStreaksSummary } from '../hooks/useGamification';
import { usePendingGames, useMyGameStats } from '../hooks/useGames';
import { useConnections } from '../hooks/useConnections';
import { useQuests } from '../hooks/useQuests';
import { useLfgMe } from '../hooks/useLfg';
import { LogGameSheet } from '../components/LogGameSheet';
import { PlayOnlineSheet } from '../components/PlayOnlineSheet';
import { BellButton } from '../navigation/TabNavigator';
import { useNearestStore } from '../hooks/useNearestStore';
import { colors, radii, shadows, spacing, typography } from '../theme';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const BANNER_H = 108;

const SOURCE_COLORS: Record<string, string> = {
  DISCORD: '#5865F2',
  WIZARDS: '#9333ea',
  STORE: colors.accent,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Today's event row
// ---------------------------------------------------------------------------

function EventItem({ event, accent }: { event: StoreEvent; accent: string }) {
  const sourceColor = SOURCE_COLORS[event.source] ?? accent;
  return (
    <View style={evtStyles.row}>
      <View style={[evtStyles.dot, { backgroundColor: sourceColor }]} />
      <Text style={evtStyles.name} numberOfLines={1}>{event.name}</Text>
      {event.formatName ? (
        <Text style={evtStyles.format}>{event.formatName}</Text>
      ) : null}
      <Text style={evtStyles.time}>{formatTime(event.startsAt)}</Text>
      {event.isAttending && (
        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { activeStore } = useActiveStore();
  const { gradient, accent, onAccent, soft } = useIdentityTheme();
  const { data: profile } = useProfile();
  const storeId = activeStore?.id ?? null;

  const { data: nearby } = useNearby(!!activeStore);
  const { data: eventDays = [] } = useStoreEvents(storeId);
  const { data: leaderboard } = useLeaderboard(storeId);
  const { data: streaks } = useStreaksSummary();
  const { data: pendingGames = [] } = usePendingGames();
  const { data: gameStats } = useMyGameStats();
  const { data: connections } = useConnections();
  const { data: quests = [] } = useQuests();
  const { data: lfgSession } = useLfgMe();

  const { store: nearestStore, distanceKm: nearestDistKm, loading: nearestLoading } = useNearestStore();
  const [showLogGame, setShowLogGame] = useState(false);
  const [showPlayOnline, setShowPlayOnline] = useState(false);
  const [dismissedNearby, setDismissedNearby] = useState(false);
  const [bannerW, setBannerW] = useState(() => Dimensions.get('window').width);

  const playerCount = nearby?.players.length ?? 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEvents = eventDays.find((d) => d.date === todayStr)?.events ?? [];
  const myRank = leaderboard?.myEntry?.rank ?? leaderboard?.entries.find((e) => e.isMe)?.rank;
  const currentStreak = streaks?.bestCurrentStreak ?? 0;
  const pendingRequests = connections?.incoming.length ?? 0;
  const activeQuests = quests.filter((q) => !q.completed);
  const attentionCount = pendingGames.length + pendingRequests;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Identity gradient banner ── */}
        <View
          style={styles.banner}
          onLayout={(e) => setBannerW(e.nativeEvent.layout.width)}
        >
          <Svg style={StyleSheet.absoluteFill} width={bannerW} height={BANNER_H}>
            <Defs>
              <SvgLinearGradient id="hbg" x1="0" y1="0" x2="1" y2="1">
                {gradient.map((c, i) => (
                  <Stop
                    key={i}
                    offset={`${i / Math.max(1, gradient.length - 1)}`}
                    stopColor={c}
                  />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width={bannerW} height={BANNER_H} fill="url(#hbg)" />
          </Svg>

          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={[styles.bannerGreeting, { color: onAccent + 'CC' }]}>
                {profile?.displayName ? `Hey, ${profile.displayName}` : 'ManaMap'}
              </Text>
              <View style={styles.bannerPills}>
                {currentStreak > 0 && (
                  <View style={[styles.bannerPill, { backgroundColor: onAccent + '28' }]}>
                    <Text style={[styles.bannerPillText, { color: onAccent }]}>
                      🔥 {currentStreak}w streak
                    </Text>
                  </View>
                )}
                {lfgSession && (
                  <View style={[styles.bannerPill, { backgroundColor: colors.success + '30' }]}>
                    <Ionicons name="radio-outline" size={11} color={colors.success} />
                    <Text style={[styles.bannerPillText, { color: colors.success }]}>Open to play</Text>
                  </View>
                )}
              </View>
            </View>
            <BellButton />
          </View>
        </View>

        {/* ── Store card ── */}
        {activeStore ? (
          <View style={styles.storeCard}>
            <View style={styles.storeCardTop}>
              <Ionicons name="storefront-outline" size={17} color={accent} />
              <Text style={[styles.storeName, { color: accent }]} numberOfLines={1}>
                {activeStore.name}
              </Text>
              <View style={styles.hereBadge}>
                <Ionicons name="radio-outline" size={11} color={colors.success} />
                <Text style={styles.hereText}>Here</Text>
              </View>
            </View>

            <View style={styles.storeChips}>
              {myRank != null && (
                <View style={[styles.chip, { backgroundColor: soft }]}>
                  <Text style={[styles.chipText, { color: accent }]}>🏆 #{myRank}</Text>
                </View>
              )}
              {currentStreak > 0 && (
                <View style={[styles.chip, { backgroundColor: soft }]}>
                  <Text style={[styles.chipText, { color: accent }]}>🔥 {currentStreak}w</Text>
                </View>
              )}
              {playerCount > 0 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>👥 {playerCount} nearby</Text>
                </View>
              )}
              {todayEvents.length > 0 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>📅 {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} today</Text>
                </View>
              )}
            </View>

            <View style={styles.storeCtaRow}>
              <Pressable
                style={({ pressed }) => [styles.storeCta, { borderColor: accent + '50' }, pressed && { opacity: 0.7 }]}
                onPress={() => navigation.navigate('StoresMap')}
              >
                <Ionicons name="map-outline" size={13} color={accent} />
                <Text style={[styles.storeCtaText, { color: accent }]}>Map</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.storeCta, { borderColor: accent + '50' }, pressed && { opacity: 0.7 }]}
                onPress={() => navigation.navigate('StoresMap')}
              >
                <Ionicons name="calendar-outline" size={13} color={accent} />
                <Text style={[styles.storeCtaText, { color: accent }]}>Events</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.noStoreCard}>
            {!nearestLoading && nearestStore && !dismissedNearby ? (
              <>
                <Pressable
                  style={styles.nearbyDismiss}
                  onPress={() => setDismissedNearby(true)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={colors.textTertiary} />
                </Pressable>
                <Ionicons name="location" size={32} color={accent} />
                <Text style={styles.noStoreTitle}>Store nearby</Text>
                <Text style={[styles.nearbyStoreName, { color: accent }]} numberOfLines={1}>
                  {nearestStore.name}
                </Text>
                {nearestDistKm !== null && (
                  <Text style={styles.noStoreHint}>
                    {nearestDistKm < 1
                      ? `${Math.round(nearestDistKm * 1000)} m away`
                      : `${nearestDistKm.toFixed(1)} km away`}
                  </Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.findStoreBtn,
                    { backgroundColor: accent },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => navigation.navigate('StoresMap', { storeId: nearestStore.id })}
                >
                  <Ionicons name="storefront-outline" size={16} color={onAccent} />
                  <Text style={[styles.findStoreBtnText, { color: onAccent }]}>View Store</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={32} color={colors.border} />
                <Text style={styles.noStoreTitle}>No store selected</Text>
                <Text style={styles.noStoreHint}>
                  Check in at your local game store to discover nearby players and events
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.findStoreBtn,
                    { backgroundColor: accent },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => navigation.navigate('StoresMap')}
                >
                  <Ionicons name="map-outline" size={16} color={onAccent} />
                  <Text style={[styles.findStoreBtnText, { color: onAccent }]}>Find a Store</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* ── Quick actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('Discover')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="radio-outline" size={22} color={colors.success} />
              </View>
              <Text style={styles.actionLabel}>Open to{'\n'}Play</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.8 }]}
              onPress={() => setShowLogGame(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: accent + '20' }]}>
                <Ionicons name="game-controller-outline" size={22} color={accent} />
              </View>
              <Text style={styles.actionLabel}>Log a{'\n'}Game</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.8 }]}
              onPress={() => setShowPlayOnline(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#5865F2' + '20' }]}>
                <Ionicons name="videocam-outline" size={22} color="#5865F2" />
              </View>
              <Text style={styles.actionLabel}>Play{'\n'}Online</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('History')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.textTertiary + '20' }]}>
                <Ionicons name="time-outline" size={22} color={colors.textTertiary} />
              </View>
              <Text style={styles.actionLabel}>History</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Needs attention ── */}
        {attentionCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Needs Attention</Text>
            <View style={styles.attentionCard}>
              {pendingGames.length > 0 && (
                <Pressable
                  style={({ pressed }) => [styles.attentionRow, pressed && { opacity: 0.75 }]}
                  onPress={() => navigation.navigate('Connections')}
                >
                  <View style={[styles.attentionDot, { backgroundColor: accent }]} />
                  <Text style={styles.attentionText}>
                    {pendingGames.length} game{pendingGames.length !== 1 ? 's' : ''} awaiting your confirmation
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.border} />
                </Pressable>
              )}
              {pendingRequests > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.attentionRow,
                    pendingGames.length > 0 && styles.attentionRowBorder,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => navigation.navigate('Connections')}
                >
                  <View style={[styles.attentionDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.attentionText}>
                    {pendingRequests} connection request{pendingRequests !== 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.border} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Today's events ── */}
        {activeStore && todayEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Today at {activeStore.name}</Text>
              <Pressable onPress={() => navigation.navigate('StoresMap')} hitSlop={8}>
                <Text style={[styles.seeAll, { color: accent }]}>See all →</Text>
              </Pressable>
            </View>
            <View style={styles.eventsCard}>
              {todayEvents.slice(0, 3).map((evt, idx) => (
                <View
                  key={evt.id}
                  style={idx > 0 ? styles.eventsCardBorder : undefined}
                >
                  <EventItem event={evt} accent={accent} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Progress ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Your Progress</Text>
            <Pressable onPress={() => navigation.navigate('You')} hitSlop={8}>
              <Text style={[styles.seeAll, { color: accent }]}>Full profile →</Text>
            </Pressable>
          </View>
          <View style={styles.progressCard}>
            {gameStats && (gameStats.wins > 0 || gameStats.losses > 0) ? (
              <View style={styles.progressRow}>
                <Ionicons name="trophy-outline" size={15} color={accent} />
                <Text style={styles.progressText}>
                  {gameStats.wins}W · {gameStats.losses}L this month
                </Text>
                {gameStats.winRate > 0 && (
                  <Text style={[styles.progressBadge, { backgroundColor: soft, color: accent }]}>
                    {Math.round(gameStats.winRate * 100)}%
                  </Text>
                )}
              </View>
            ) : null}

            {activeQuests.slice(0, 2).map((q, idx) => (
              <View
                key={q.quest.id}
                style={[
                  styles.progressRow,
                  (idx > 0 || (gameStats && (gameStats.wins > 0 || gameStats.losses > 0))) &&
                    styles.progressRowBorder,
                ]}
              >
                <Ionicons name="flash-outline" size={15} color={colors.warning} />
                <Text style={styles.progressText} numberOfLines={1}>{q.quest.title}</Text>
                <Text style={styles.progressSub}>{q.progress}/{q.goal}</Text>
              </View>
            ))}

            {!gameStats?.wins && !gameStats?.losses && activeQuests.length === 0 && (
              <Text style={styles.progressEmpty}>
                Play games and complete quests to track your progress here
              </Text>
            )}
          </View>
        </View>

      </ScrollView>

      <LogGameSheet
        visible={showLogGame}
        onClose={() => setShowLogGame(false)}
        onSuccess={() => setShowLogGame(false)}
        {...(activeStore?.id !== undefined ? { storeId: activeStore.id } : {})}
      />

      <PlayOnlineSheet
        visible={showPlayOnline}
        onClose={() => setShowPlayOnline(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingBottom: spacing.xxxl },

  banner: {
    height: BANNER_H,
    overflow: 'hidden',
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  bannerLeft: { flex: 1, gap: spacing.xs },
  bannerGreeting: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
  },
  bannerPills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  bannerPillText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
  },

  storeCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  storeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  storeName: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
  },
  hereBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.success + '18',
    borderRadius: radii.full,
  },
  hereText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.success,
  },
  storeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  storeCtaRow: { flexDirection: 'row', gap: spacing.sm },
  storeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  storeCtaText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
  },

  noStoreCard: {
    margin: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  nearbyDismiss: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  nearbyStoreName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
  noStoreTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  noStoreHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  findStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  findStoreBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
  },

  section: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  seeAll: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
  },

  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  attentionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  attentionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  attentionDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  attentionText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },

  eventsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  eventsCardBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },

  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  progressText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  progressBadge: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  progressSub: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  progressEmpty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    padding: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const evtStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  format: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  time: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    minWidth: 50,
    textAlign: 'right',
  },
});
