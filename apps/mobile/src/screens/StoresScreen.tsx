import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { EarnedBadge, NearbyPlayer, StoreEvent, StorePin } from '@manamap/shared';
import { useActiveStore } from '../context/ActiveStoreContext';
import {
  useAttendEvent,
  useCheckin,
  useNearby,
  useStorePins,
  useStoreDetail,
  useStoreEvents,
  useStores,
} from '../hooks/useNearby';
import { useLeaderboard } from '../hooks/useGamification';
import { BadgeEarnedSheet } from '../components/BadgeEarnedSheet';
import { colors, radii, shadows, spacing, typography } from '../theme';

// Default map region — US center, wide view
const DEFAULT_REGION: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 30,
  longitudeDelta: 45,
};

function regionToBbox(region: Region): string {
  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLng = region.longitude + region.longitudeDelta / 2;
  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  DISCORD: '#5865F2',
  WIZARDS: '#9333ea',
  STORE: colors.accent,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateLabel(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({
  event,
  storeId,
}: {
  event: StoreEvent;
  storeId: string;
}) {
  const { mutate: attend, isPending, isSuccess } = useAttendEvent();
  const attending = isSuccess || event.isAttending;
  const sourceColor = SOURCE_COLORS[event.source] ?? colors.accent;

  return (
    <View style={evtRow.root}>
      <View style={evtRow.topRow}>
        <View style={[evtRow.sourceDot, { backgroundColor: sourceColor }]} />
        <Text style={evtRow.name} numberOfLines={2}>{event.name}</Text>
        <Text style={evtRow.time}>{formatTime(event.startsAt)}</Text>
      </View>

      <View style={evtRow.metaRow}>
        {event.formatName && (
          <View style={[evtRow.chip, { borderColor: sourceColor + '60', backgroundColor: sourceColor + '12' }]}>
            <Text style={[evtRow.chipText, { color: sourceColor }]}>{event.formatName}</Text>
          </View>
        )}
        {event.attendeeCount > 0 && (
          <Text style={evtRow.going}>{event.attendeeCount} going</Text>
        )}
      </View>

      <View style={evtRow.actions}>
        <Pressable
          style={({ pressed }) => [
            evtRow.rsvpBtn,
            attending && evtRow.rsvpBtnActive,
            (pressed || isPending) && { opacity: 0.7 },
          ]}
          onPress={attending ? undefined : () => attend({ storeId, eventId: event.id })}
          disabled={isPending || attending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color={attending ? colors.success : colors.accent} />
          ) : (
            <>
              <Ionicons
                name={attending ? 'checkmark-circle' : 'calendar-outline'}
                size={14}
                color={attending ? colors.success : colors.accent}
              />
              <Text style={[evtRow.rsvpText, attending && evtRow.rsvpTextActive]}>
                {attending ? 'Going!' : 'Going?'}
              </Text>
            </>
          )}
        </Pressable>

        {event.eventChannelUrl && (
          <Pressable
            style={({ pressed }) => [evtRow.channelBtn, pressed && { opacity: 0.7 }]}
            onPress={() => void Linking.openURL(event.eventChannelUrl!)}
          >
            <Ionicons name="logo-discord" size={13} color="#5865F2" />
            <Text style={evtRow.channelText}>Event channel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Who's here now row
// ---------------------------------------------------------------------------

function HereNowRow({ player }: { player: NearbyPlayer }) {
  const fill = player.avatarColors[0]
    ? ({ W: colors.mana.W, U: colors.mana.U, B: colors.mana.B, R: colors.mana.R, G: colors.mana.G }[player.avatarColors[0]] ?? colors.border)
    : colors.border;
  const textFill = player.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
  return (
    <View style={hereRow.root}>
      <View style={[hereRow.avatar, { backgroundColor: fill }]}>
        <Text style={[hereRow.avatarText, { color: textFill }]}>
          {player.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={hereRow.name} numberOfLines={1}>{player.displayName}</Text>
      {player.metBefore && (
        <View style={hereRow.metBadge}>
          <Text style={hereRow.metText}>Met</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Store detail sheet
// ---------------------------------------------------------------------------

function StoreDetailSheet({
  storeId,
  onClose,
}: {
  storeId: string | null;
  onClose: () => void;
}) {
  const { data: store, isLoading } = useStoreDetail(storeId);
  const { data: eventDays = [], isLoading: eventsLoading } = useStoreEvents(storeId);
  const { data: leaderboard } = useLeaderboard(storeId);
  const { activeStore, setActiveStore } = useActiveStore();
  const isActiveStore = activeStore?.id === storeId;
  const { data: nearby } = useNearby(isActiveStore);
  const hereNow = isActiveStore ? (nearby?.players ?? []) : [];

  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [activeTab, setActiveTab] = useState<'schedule' | 'leaderboard'>('schedule');

  const { mutate: checkin, isPending: isCheckinPending, isSuccess: checkedIn } = useCheckin();

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: storeId ? 1 : 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [storeId, slideAnim]);

  function handleCheckin() {
    if (!store) return;
    checkin(store.id, {
      onSuccess: (result) => {
        setActiveStore({
          id: result.storeId,
          name: result.storeName,
          address: store.address,
          city: store.city,
          state: store.state,
          zip: store.zip,
          discordUrl: store.discordUrl,
          lat: store.lat,
          lng: store.lng,
        });
        if (result.newBadges.length > 0) {
          setEarnedBadges(result.newBadges);
        }
      },
    });
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  if (!storeId) return null;

  return (
    <>
    <Modal
      transparent
      visible={!!storeId}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={sheet.overlay} onPress={onClose} />
      <Animated.View style={[sheet.container, { transform: [{ translateY }] }]}>
        <View style={sheet.handle} />

        <Pressable onPress={onClose} style={sheet.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
        ) : store ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sheet.scroll}>
            {/* Header */}
            <View style={sheet.nameRow}>
              <Ionicons name="storefront-outline" size={22} color={colors.accent} />
              <Text style={sheet.name}>{store.name}</Text>
            </View>

            {/* Address */}
            {(store.address || store.city || store.state) && (
              <View style={sheet.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                <Text style={sheet.infoText}>
                  {[store.address, store.city, store.state, store.zip].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            {/* Discord */}
            {store.discordUrl && (
              <Pressable
                style={({ pressed }) => [sheet.discordRow, pressed && { opacity: 0.7 }]}
                onPress={() => void Linking.openURL(store.discordUrl!)}
              >
                <Ionicons name="logo-discord" size={16} color="#5865F2" />
                <Text style={sheet.discordText}>Join Discord community</Text>
                <Ionicons name="open-outline" size={14} color={colors.textTertiary} />
              </Pressable>
            )}

            {/* Active store badge */}
            {isActiveStore && (
              <View style={sheet.activeBadge}>
                <Ionicons name="radio-outline" size={14} color={colors.success} />
                <Text style={sheet.activeText}>You're checked in here</Text>
              </View>
            )}

            {/* Tab bar */}
            <View style={sheet.tabBar}>
              {(['schedule', 'leaderboard'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[sheet.tab, activeTab === tab && sheet.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[sheet.tabText, activeTab === tab && sheet.tabTextActive]}>
                    {tab === 'schedule' ? 'Schedule' : 'Leaderboard'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeTab === 'schedule' ? (
              eventsLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
              ) : eventDays.length === 0 ? (
                <Text style={sheet.emptyHint}>No upcoming events</Text>
              ) : (
                eventDays.map((day) => (
                  <View key={day.date}>
                    <Text style={sheet.dayLabel}>{formatDateLabel(day.date)}</Text>
                    {day.events.map((evt) => (
                      <EventRow key={evt.id} event={evt} storeId={storeId} />
                    ))}
                  </View>
                ))
              )
            ) : (
              /* Leaderboard tab */
              leaderboard?.entries.length === 0 ? (
                <Text style={sheet.emptyHint}>No check-ins yet — be the first!</Text>
              ) : (
                <>
                  {leaderboard?.entries.map((entry) => (
                    <View key={entry.userId} style={[sheet.lbRow, entry.isMe && sheet.lbRowMe]}>
                      <Text style={sheet.lbRank}>#{entry.rank}</Text>
                      <View style={sheet.lbAvatar}>
                        <Text style={sheet.lbAvatarText}>{entry.displayName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={sheet.lbName} numberOfLines={1}>{entry.displayName}</Text>
                      <View style={sheet.lbStats}>
                        <Text style={sheet.lbStreak}>🔥 {entry.currentStreak}w</Text>
                        <Text style={sheet.lbTotal}>{entry.totalCheckins} visits</Text>
                      </View>
                    </View>
                  ))}
                  {leaderboard?.myEntry && !leaderboard.entries.some((e) => e.isMe) && (
                    <View style={[sheet.lbRow, sheet.lbRowMe]}>
                      <Text style={sheet.lbRank}>#{leaderboard.myEntry.rank}</Text>
                      <View style={sheet.lbAvatar}><Text style={sheet.lbAvatarText}>Y</Text></View>
                      <Text style={sheet.lbName}>You</Text>
                      <View style={sheet.lbStats}>
                        <Text style={sheet.lbStreak}>🔥 {leaderboard.myEntry.currentStreak}w</Text>
                        <Text style={sheet.lbTotal}>{leaderboard.myEntry.totalCheckins} visits</Text>
                      </View>
                    </View>
                  )}
                </>
              )
            )}

            {/* Who's here now */}
            {isActiveStore && (
              <>
                <View style={sheet.sectionHeader}>
                  <Ionicons name="people-outline" size={15} color={colors.textTertiary} />
                  <Text style={sheet.sectionTitle}>
                    Here now{hereNow.length > 0 ? ` (${hereNow.length})` : ''}
                  </Text>
                </View>
                {hereNow.length === 0 ? (
                  <Text style={sheet.emptyHint}>No other players detected yet</Text>
                ) : (
                  <View style={sheet.hereList}>
                    {hereNow.map((p) => (
                      <HereNowRow key={p.id} player={p} />
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Check-in button */}
            {checkedIn ? (
              <View style={sheet.successRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={sheet.successText}>Checked in! Discover is now active.</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  sheet.checkinBtn,
                  isActiveStore && sheet.checkinBtnActive,
                  (pressed || isCheckinPending) && { opacity: 0.8 },
                ]}
                onPress={isActiveStore ? onClose : handleCheckin}
                disabled={isCheckinPending}
              >
                {isCheckinPending ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Ionicons
                    name={isActiveStore ? 'checkmark-outline' : 'enter-outline'}
                    size={18}
                    color={colors.textInverse}
                  />
                )}
                <Text style={sheet.checkinText}>
                  {isCheckinPending ? 'Checking in…' : isActiveStore ? 'Already here' : 'Check in here'}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        ) : (
          <Text style={sheet.errorText}>Couldn't load store details.</Text>
        )}
      </Animated.View>
    </Modal>

    <BadgeEarnedSheet
      badges={earnedBadges}
      onDismiss={() => setEarnedBadges([])}
    />
    </>
  );
}

// ---------------------------------------------------------------------------
// StoresScreen
// ---------------------------------------------------------------------------

type ViewMode = 'map' | 'list';

export function StoresScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bbox-based pin query for the map view
  const bbox = useMemo(() => regionToBbox(region), [region]);
  const { data: pins = [], isFetching: pinsLoading } = useStorePins(
    viewMode === 'map' ? bbox : null,
  );

  // Text search for the list view
  const { data: searchResults = [], isFetching: searchLoading } = useStores(
    viewMode === 'list' && searchQuery.length >= 2 ? searchQuery : undefined,
  );

  const { activeStore } = useActiveStore();

  // Debounce region changes to avoid spamming the bbox query
  function handleRegionChangeComplete(r: Region) {
    setPendingRegion(r);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRegion(r);
      setPendingRegion(null);
    }, 600);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectPin = useCallback((pin: StorePin) => {
    setSelectedStoreId(pin.id);
  }, []);

  const handleSelectRow = useCallback((store: { id: string }) => {
    setSelectedStoreId(store.id);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stores</Text>
          {activeStore && (
            <Text style={styles.activeStoreName} numberOfLines={1}>
              Active: {activeStore.name}
            </Text>
          )}
        </View>

        {/* View toggle */}
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons
              name="map-outline"
              size={16}
              color={viewMode === 'map' ? colors.accent : colors.textTertiary}
            />
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === 'list' ? colors.accent : colors.textTertiary}
            />
          </Pressable>
        </View>
      </View>

      {/* Search bar (always visible) */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stores by name or city…"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={(t) => {
            setSearchQuery(t);
            if (viewMode === 'map' && t.length > 0) setViewMode('list');
          }}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Map view */}
      {viewMode === 'map' && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {pins.map((pin) => (
              <Marker
                key={pin.id}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                title={pin.name}
                onPress={() => handleSelectPin(pin)}
                pinColor={activeStore?.id === pin.id ? colors.success : colors.accent}
              />
            ))}
          </MapView>

          {(pinsLoading || !!pendingRegion) && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}
        </View>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {searchLoading && (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
          )}

          {!searchLoading && searchQuery.length < 2 && (
            <Text style={styles.listHint}>Type at least 2 characters to search stores</Text>
          )}

          {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <Text style={styles.listHint}>No stores found for "{searchQuery}"</Text>
          )}

          {searchResults.map((store) => (
            <Pressable
              key={store.id}
              style={({ pressed }) => [
                styles.listRow,
                activeStore?.id === store.id && styles.listRowActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => handleSelectRow(store)}
            >
              <Ionicons
                name={activeStore?.id === store.id ? 'radio-outline' : 'storefront-outline'}
                size={20}
                color={activeStore?.id === store.id ? colors.success : colors.textTertiary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.listRowName}>{store.name}</Text>
                {(store.city || store.state) && (
                  <Text style={styles.listRowSub}>
                    {[store.city, store.state].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <StoreDetailSheet
        storeId={selectedStoreId}
        onClose={() => setSelectedStoreId(null)}
      />
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.textPrimary,
  },
  activeStoreName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.success,
    marginTop: 1,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: { backgroundColor: colors.accentLight },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapLoadingOverlay: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    padding: spacing.sm,
    ...shadows.sm,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xxxl },
  listHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  listRowActive: { backgroundColor: colors.accentLight + '44' },
  listRowName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  listRowSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,25,23,0.4)',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
    maxHeight: '90%',
    ...shadows.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.xl,
    zIndex: 1,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  discordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#5865F220',
    borderRadius: radii.md,
  },
  discordText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: '#5865F2',
    flex: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.success + '18',
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  activeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.success,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    paddingVertical: spacing.sm,
  },
  hereList: {
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  checkinBtn: {
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
  checkinBtnActive: { backgroundColor: colors.textTertiary },
  checkinText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    marginTop: spacing.sm,
  },
  successText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.success,
  },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    padding: spacing.xl,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: radii.md,
    backgroundColor: colors.borderLight,
    padding: 3,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  tabActive: { backgroundColor: colors.surface, ...shadows.sm },
  tabText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  tabTextActive: { color: colors.textPrimary },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  lbRowMe: { backgroundColor: colors.accentLight, borderRadius: radii.sm, paddingHorizontal: spacing.sm },
  lbRank: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    width: 28,
    textAlign: 'center',
  },
  lbAvatar: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbAvatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  lbName: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  lbStats: { alignItems: 'flex-end', gap: 2 },
  lbStreak: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  lbTotal: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
});

const evtRow = StyleSheet.create({
  root: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceDot: {
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
  time: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md + spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
  },
  going: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md + spacing.xs,
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  rsvpBtnActive: {
    borderColor: colors.success,
    backgroundColor: colors.success + '14',
  },
  rsvpText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
  rsvpTextActive: {
    color: colors.success,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: '#5865F215',
  },
  channelText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: '#5865F2',
  },
});

const hereRow = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
  },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  metBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.success + '22',
    borderRadius: radii.full,
  },
  metText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.success,
  },
});
