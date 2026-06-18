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
import { useAuth } from '../context/AuthContext';
import { useIdentityTheme } from '../hooks/useIdentityTheme';
import { useProfile } from '../hooks/useMe';
import { useNearby, useStoreEvents } from '../hooks/useNearby';
import { useStreaksSummary } from '../hooks/useGamification';
import { usePendingGames, useMyGameStats } from '../hooks/useGames';
import { useConnections } from '../hooks/useConnections';
import { useQuests } from '../hooks/useQuests';
import { useLfgMe } from '../hooks/useLfg';
import { useNotificationUnreadCount } from '../hooks/useNotifications';
import { LogGameSheet } from '../components/LogGameSheet';
import { PodFormSheet } from '../components/PodFormSheet';
import { colors, radii, shadows, spacing, typography } from '../theme';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const SOURCE_COLORS: Record<string, string> = {
  DISCORD: '#5865F2',
  WIZARDS: '#9333ea',
  STORE: colors.accent,
};

function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Hey' : 'Evening';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Event row
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
        <View style={[evtStyles.rsvpBadge, { backgroundColor: accent + '22' }]}>
          <Text style={[evtStyles.rsvpText, { color: accent }]}>RSVP'd</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quick action tile (2×2 grid)
// ---------------------------------------------------------------------------

interface QuickTileProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  badge?: number | null;
  live?: boolean;
  onPress: () => void;
}

function QuickTile({ icon, label, sub, iconBg, iconColor, badge, live, onPress }: QuickTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [qtStyles.tile, pressed && { transform: [{ scale: 0.96 }] }]}
      onPress={onPress}
    >
      {badge != null && badge > 0 && (
        <View style={qtStyles.badge}>
          <Text style={qtStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <View style={[qtStyles.iconWell, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
        {live && <View style={qtStyles.liveDot} />}
      </View>
      <View style={qtStyles.textBlock}>
        <Text style={qtStyles.label}>{label}</Text>
        <Text style={qtStyles.sub} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { activeStore } = useActiveStore();
  const { gradient, accent, onAccent, soft } = useIdentityTheme();
  const { isAuthenticated } = useAuth();
  const { data: profile } = useProfile();
  const storeId = activeStore?.id ?? null;

  const { data: nearby } = useNearby(!!activeStore);
  const { data: eventDays = [] } = useStoreEvents(storeId);
  const { data: streaks } = useStreaksSummary();
  const { data: pendingGames = [] } = usePendingGames();
  const { data: gameStats } = useMyGameStats();
  const { data: connections } = useConnections();
  const { data: quests = [] } = useQuests();
  const { data: lfgSession } = useLfgMe();
  const { data: bellCount = 0 } = useNotificationUnreadCount(isAuthenticated);

  const [showLogGame, setShowLogGame] = useState(false);
  const [showPodForm, setShowPodForm] = useState(false);
  const [bannerW, setBannerW] = useState(() => Dimensions.get('window').width);
  const [bannerH, setBannerH] = useState(175);

  const playerCount = nearby?.players.length ?? 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEvents = eventDays.find((d) => d.date === todayStr)?.events ?? [];
  const currentStreak = streaks?.bestCurrentStreak ?? 0;
  const pendingRequests = connections?.incoming.length ?? 0;
  const activeQuests = quests.filter((q) => !q.completed);
  const attentionCount = pendingGames.length + pendingRequests;
  const topQuest = activeQuests[0] ?? null;
  const hasStats = (gameStats?.wins ?? 0) > 0 || (gameStats?.losses ?? 0) > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Identity gradient banner ── */}
        <View
          style={styles.banner}
          onLayout={(e) => {
            setBannerW(e.nativeEvent.layout.width);
            setBannerH(e.nativeEvent.layout.height);
          }}
        >
          <Svg style={StyleSheet.absoluteFill} width={bannerW} height={bannerH}>
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
            <Rect x="0" y="0" width={bannerW} height={bannerH} fill="url(#hbg)" />
          </Svg>

          {/* Bell — absolute top-right */}
          <Pressable
            style={[styles.bellWrap, { backgroundColor: onAccent + '38' }]}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
          >
            <Ionicons name="notifications" size={25} color={onAccent} />
            {bellCount > 0 && <View style={styles.bellDot} />}
          </Pressable>

          {/* Text content */}
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerSub, { color: onAccent + 'B8' }]}>{greet()},</Text>
            <Text style={[styles.bannerName, { color: onAccent }]} numberOfLines={1}>
              {profile?.displayName ?? 'Planeswalker'}
            </Text>

            {activeStore ? (
              <Pressable
                style={styles.storeRow}
                onPress={() => navigation.navigate('StoresMap')}
              >
                <View style={styles.storeGlowDot} />
                <Text style={[styles.storeRowName, { color: onAccent }]} numberOfLines={1}>
                  {activeStore.name}
                </Text>
                <View style={styles.checkinPill}>
                  <Text style={[styles.checkinPillText, { color: onAccent + 'D8' }]}>Checked in ›</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={styles.storeRow}
                onPress={() => navigation.navigate('StoresMap')}
              >
                <Ionicons name="location-outline" size={13} color={onAccent + '99'} />
                <Text style={[styles.storeRowMuted, { color: onAccent + '99' }]}>Find a store →</Text>
              </Pressable>
            )}

            <View style={styles.bannerPills}>
              {currentStreak > 0 && (
                <View style={styles.bannerPill}>
                  <Text style={[styles.bannerPillText, { color: onAccent }]}>
                    🔥 {currentStreak}w streak
                  </Text>
                </View>
              )}
              {lfgSession && (
                <View style={styles.bannerPill}>
                  <View style={styles.bannerLiveDot} />
                  <Text style={[styles.bannerPillText, { color: onAccent }]}>Open · playing</Text>
                </View>
              )}
              {todayEvents.length > 0 && (
                <View style={styles.bannerPill}>
                  <Text style={[styles.bannerPillText, { color: onAccent }]}>
                    📅 {todayEvents[0].name}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Quick actions (2 × 2) ── */}
        <View style={styles.qaGrid}>
          <View style={styles.qaRow}>
            <QuickTile
              icon="radio-outline"
              label="Open to Play"
              sub={lfgSession ? 'Live now' : 'Tap to go live'}
              iconBg={colors.success + '1E'}
              iconColor={colors.success}
              live={!!lfgSession}
              onPress={() => navigation.navigate('Discover')}
            />
            <QuickTile
              icon="game-controller-outline"
              label="Log a Game"
              sub="Record a result"
              iconBg={accent + '1E'}
              iconColor={accent}
              onPress={() => setShowLogGame(true)}
            />
          </View>
          <View style={styles.qaRow}>
            <QuickTile
              icon="navigate-outline"
              label="Meet Players"
              sub={playerCount > 0 ? `${playerCount} nearby now` : 'Find opponents'}
              iconBg={accent + '1E'}
              iconColor={accent}
              onPress={() => navigation.navigate('Discover')}
            />
            <QuickTile
              icon="people-outline"
              label="Connections"
              sub={pendingRequests > 0
                ? `${pendingRequests} pending request${pendingRequests > 1 ? 's' : ''}`
                : 'Your network'}
              iconBg={accent + '1E'}
              iconColor={accent}
              onPress={() => navigation.navigate('Connections')}
            />
          </View>
        </View>

        {/* ── Form a Pod row ── */}
        <Pressable
          style={({ pressed }) => [styles.podRow, pressed && { opacity: 0.75 }]}
          onPress={() => setShowPodForm(true)}
        >
          <View style={[styles.podIcon, { backgroundColor: accent + '1E' }]}>
            <Ionicons name="people" size={22} color={accent} />
          </View>
          <View style={styles.podText}>
            <Text style={styles.podLabel}>Form a Pod</Text>
            <Text style={styles.podSub}>Build your table, start a game</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>

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
                    {pendingGames.length} game result{pendingGames.length !== 1 ? 's' : ''} to confirm
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
                    {pendingRequests} new connection request{pendingRequests !== 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.border} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Tonight's events ── */}
        {activeStore && todayEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel} numberOfLines={1}>
                Tonight · {activeStore.name}
              </Text>
              <Pressable onPress={() => navigation.navigate('StoresMap')} hitSlop={8}>
                <Text style={[styles.seeAll, { color: accent }]}>See all →</Text>
              </Pressable>
            </View>
            <View style={styles.eventsCard}>
              {todayEvents.slice(0, 3).map((evt, idx) => (
                <View key={evt.id} style={idx > 0 ? styles.eventsCardBorder : undefined}>
                  <EventItem event={evt} accent={accent} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Your month ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Your Month</Text>
            <Pressable onPress={() => navigation.navigate('History')} hitSlop={8}>
              <Text style={[styles.seeAll, { color: accent }]}>History ›</Text>
            </Pressable>
          </View>
          <View style={styles.progressCard}>
            {hasStats && gameStats ? (
              <View style={[styles.progressRow, topQuest ? styles.progressRowBorder : undefined]}>
                <Ionicons name="trophy-outline" size={15} color={accent} />
                <Text style={styles.progressText}>
                  {gameStats.wins}W · {gameStats.losses}L this month
                </Text>
                {gameStats.winRate > 0 && (
                  <View style={[styles.winBadge, { backgroundColor: soft }]}>
                    <Text style={[styles.winBadgeText, { color: accent }]}>
                      {Math.round(gameStats.winRate * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {topQuest && (
              <View style={styles.questBlock}>
                <View style={styles.questRow}>
                  <Ionicons name="flash-outline" size={15} color={colors.warning} />
                  <Text style={styles.questTitle} numberOfLines={1}>{topQuest.quest.title}</Text>
                  <Text style={styles.questCounter}>{topQuest.progress}/{topQuest.goal}</Text>
                </View>
                <View style={styles.questBarBg}>
                  <View
                    style={[
                      styles.questBarFill,
                      {
                        backgroundColor: accent,
                        width: `${Math.round(100 * Math.min(topQuest.progress, topQuest.goal) / topQuest.goal)}%`,
                      },
                    ]}
                  />
                </View>
                {topQuest.quest.rewardBadge && (
                  <Text style={styles.questReward}>Reward: {topQuest.quest.rewardBadge.name}</Text>
                )}
              </View>
            )}

            {!hasStats && !topQuest && (
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

      <PodFormSheet
        visible={showPodForm}
        myProfile={{
          id: profile?.id ?? 'me',
          displayName: profile?.displayName ?? 'You',
          avatarColors: profile?.avatarColors ?? [],
        }}
        connections={connections}
        onStartGame={(players) => navigation.navigate('LifeTracker', { initialPlayers: players })}
        onClose={() => setShowPodForm(false)}
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

  // Banner
  banner: {
    overflow: 'hidden',
    minHeight: 200,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  bellWrap: {
    position: 'absolute',
    bottom: 22,
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: '#E8484A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  bannerContent: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 22,
    paddingRight: 62,
    gap: 0,
  },
  bannerSub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 1,
  },
  bannerName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.hero,
    lineHeight: typography.fontSize.hero * 1.06,
    letterSpacing: -1.2,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 13,
    alignSelf: 'flex-start',
  },
  storeGlowDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 5,
  },
  storeRowName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  storeRowMuted: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
  },
  checkinPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  checkinPillText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11.5,
  },
  bannerPills: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  bannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  bannerPillText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
  },
  bannerLiveDot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },

  // Quick actions grid
  qaGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  qaRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // Form a Pod row
  podRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
    paddingHorizontal: 16,
    ...shadows.sm,
  },
  podIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  podText: { flex: 1, minWidth: 0 },
  podLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
    color: colors.textPrimary,
    letterSpacing: -0.15,
  },
  podSub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },

  // Sections
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
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  seeAll: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    flexShrink: 0,
  },

  // Attention
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  attentionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  attentionDot: {
    width: 9,
    height: 9,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  attentionText: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Events
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

  // Progress / month
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  progressRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  progressText: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  winBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  winBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12.5,
  },
  questBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  questTitle: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  questCounter: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  questBarBg: {
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  questBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  questReward: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 7,
  },
  progressEmpty: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13.5,
    color: colors.textTertiary,
    padding: 22,
    paddingHorizontal: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const qtStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 15,
    paddingBottom: 14,
    gap: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    ...shadows.sm,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  liveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: radii.full,
    backgroundColor: '#4ade80',
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  textBlock: {
    minWidth: 0,
    width: '100%',
  },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
    color: colors.textPrimary,
    letterSpacing: -0.15,
    lineHeight: 18,
  },
  sub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  badge: {
    position: 'absolute',
    top: 11,
    right: 11,
    minWidth: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: '#E8484A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
    zIndex: 1,
  },
  badgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    color: '#fff',
  },
});

const evtStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  format: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textTertiary,
    flexShrink: 0,
  },
  time: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 0,
    minWidth: 50,
    textAlign: 'right',
  },
  rsvpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    flexShrink: 0,
  },
  rsvpText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10.5,
  },
});
