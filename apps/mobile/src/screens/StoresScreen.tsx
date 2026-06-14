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
import * as Location from 'expo-location';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ActiveEvent, EarnedBadge, EventAttendeeEntry, NearbyPlayer, StoreEvent, StorePin } from '@manamap/shared';
import type { RootStackParamList } from '../navigation/types';
import { useActiveStore } from '../context/ActiveStoreContext';
import {
  useAttendEvent,
  useUnattendEvent,
  useAssociateCheckinEvent,
  useEventAttendance,
  useCheckin,
  type CheckinArgs,
  useNearby,
  useStorePins,
  useStoreDetail,
  useStoreEvents,
  useStores,
} from '../hooks/useNearby';
import QRCode from 'react-native-qrcode-svg';
import { useLeaderboard } from '../hooks/useGamification';
import { useClaimOffer, useRedemptionStatus, useStoreOffers, type ClaimResult } from '../hooks/useOffers';
import { BadgeEarnedSheet } from '../components/BadgeEarnedSheet';
import { StoreSuggestSheet } from '../components/StoreSuggestSheet';
import { useConfirmStore } from '../hooks/useStores';
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

function AttendeeRow({ entry }: { entry: EventAttendeeEntry }) {
  const fill = entry.avatarColors[0]
    ? ({ W: colors.mana.W, U: colors.mana.U, B: colors.mana.B, R: colors.mana.R, G: colors.mana.G }[entry.avatarColors[0]] ?? colors.border)
    : colors.border;
  const textFill = ['W', 'G'].includes(entry.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
  return (
    <View style={attendeeRow.root}>
      <View style={[attendeeRow.avatar, { backgroundColor: fill }]}>
        <Text style={[attendeeRow.avatarText, { color: textFill }]}>
          {entry.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={attendeeRow.name} numberOfLines={1}>{entry.displayName}</Text>
      {entry.isHereNow && (
        <View style={attendeeRow.hereBadge}>
          <Ionicons name="radio-outline" size={10} color={colors.success} />
          <Text style={attendeeRow.hereText}>Here</Text>
        </View>
      )}
    </View>
  );
}

function EventRow({
  event,
  storeId,
}: {
  event: StoreEvent;
  storeId: string;
}) {
  const { mutate: attend, isPending: isAttending } = useAttendEvent();
  const { mutate: unattend, isPending: isUnattending } = useUnattendEvent();
  const [expanded, setExpanded] = useState(false);
  const { data: attendance } = useEventAttendance(expanded ? storeId : null, expanded ? event.id : null);

  const isPending = isAttending || isUnattending;
  const attending = event.isAttending;
  const sourceColor = SOURCE_COLORS[event.source] ?? colors.accent;

  const handleRsvpPress = () => {
    if (attending) {
      unattend({ storeId, eventId: event.id });
    } else {
      attend({ storeId, eventId: event.id });
    }
  };

  return (
    <View style={evtRow.root}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <View style={evtRow.topRow}>
          <View style={[evtRow.sourceDot, { backgroundColor: sourceColor }]} />
          <Text style={evtRow.name} numberOfLines={2}>{event.name}</Text>
          <Text style={evtRow.time}>{formatTime(event.startsAt)}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textTertiary} />
        </View>
      </Pressable>

      <View style={evtRow.metaRow}>
        {event.formatName && (
          <View style={[evtRow.chip, { borderColor: sourceColor + '60', backgroundColor: sourceColor + '12' }]}>
            <Text style={[evtRow.chipText, { color: sourceColor }]}>{event.formatName}</Text>
          </View>
        )}
        {event.attendeeCount > 0 && (
          <Text style={evtRow.going}>{event.attendeeCount} going</Text>
        )}
        {event.hereNowCount > 0 && (
          <View style={evtRow.hereNowBadge}>
            <Ionicons name="radio-outline" size={10} color={colors.success} />
            <Text style={evtRow.hereNowText}>{event.hereNowCount} here now</Text>
          </View>
        )}
      </View>

      <View style={evtRow.actions}>
        <Pressable
          style={({ pressed }) => [
            evtRow.rsvpBtn,
            attending && evtRow.rsvpBtnActive,
            (pressed || isPending) && { opacity: 0.7 },
          ]}
          onPress={isPending ? undefined : handleRsvpPress}
          disabled={isPending}
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

      {expanded && (
        <View style={evtRow.attendanceSection}>
          {attendance ? (
            <>
              {attendance.hereNow.length > 0 && (
                <>
                  <Text style={evtRow.attendanceLabel}>Here now ({attendance.hereNow.length})</Text>
                  {attendance.hereNow.map((entry) => (
                    <AttendeeRow key={entry.id} entry={entry} />
                  ))}
                </>
              )}
              {attendance.rsvpd.length > 0 && (
                <>
                  <Text style={evtRow.attendanceLabel}>RSVP'd</Text>
                  {attendance.rsvpd.map((entry) => (
                    <AttendeeRow key={entry.id} entry={entry} />
                  ))}
                </>
              )}
              {attendance.hereNow.length === 0 && attendance.rsvpd.length === 0 && (
                <Text style={evtRow.attendanceEmpty}>No attendees yet</Text>
              )}
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 4 }} />
          )}
        </View>
      )}
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
  const textFill = ['W', 'G'].includes(player.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
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
  proposed = false,
  confirmationCount = 0,
  onClose,
}: {
  storeId: string | null;
  proposed?: boolean;
  confirmationCount?: number;
  onClose: () => void;
}) {
  const { data: store, isLoading } = useStoreDetail(storeId);
  const { data: eventDays = [], isLoading: eventsLoading } = useStoreEvents(proposed ? null : storeId);
  const { data: leaderboard } = useLeaderboard(proposed ? null : storeId);
  const { activeStore, setActiveStore } = useActiveStore();
  const isActiveStore = !proposed && activeStore?.id === storeId;
  const { data: nearby } = useNearby(isActiveStore);
  const hereNow = isActiveStore ? (nearby?.players ?? []) : [];

  const { data: offers = [] } = useStoreOffers(proposed ? null : storeId);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [eligibleOffers, setEligibleOffers] = useState<Array<{ id: string; type: string; title: string; description: string | null; terms: string | null; redemptionCode: string }>>([]);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const { mutate: claimOffer, isPending: isClaiming } = useClaimOffer();
  const { data: redemptionStatus } = useRedemptionStatus(claimResult?.offerId ?? null, claimResult !== null);
  const effectiveStatus = redemptionStatus?.status ?? claimResult?.status;
  const [pendingCheckinId, setPendingCheckinId] = useState<string | null>(null);
  const { mutate: associateEvent, isPending: isAssociating } = useAssociateCheckinEvent();
  const [activeTab, setActiveTab] = useState<'schedule' | 'leaderboard'>('schedule');
  const [locPhase, setLocPhase] = useState<'idle' | 'acquiring'>('idle');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [tooFarError, setTooFarError] = useState<{ distanceMeters: number; allowedMeters: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  const [localConfirmCount, setLocalConfirmCount] = useState(confirmationCount);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const { mutate: confirmStore, isPending: isConfirming } = useConfirmStore();

  useEffect(() => {
    setLocalConfirmCount(confirmationCount);
    setAlreadyConfirmed(false);
  }, [storeId, confirmationCount]);

  async function handleConfirm() {
    if (!storeId || alreadyConfirmed) return;
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch { /* proceed without coordinates */ }

    confirmStore(
      { storeId, body: { ...(lat != null ? { lat, lng } : {}) } },
      {
        onSuccess: (data) => {
          setLocalConfirmCount(data.confirmationCount);
          setAlreadyConfirmed(true);
        },
      },
    );
  }

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

  // Reset location error states when a different store is opened
  useEffect(() => {
    setLocPhase('idle');
    setPermissionDenied(false);
    setTooFarError(null);
    setLocationError(false);
  }, [storeId]);

  async function handleCheckin() {
    if (!store) return;
    setPermissionDenied(false);
    setTooFarError(null);
    setLocationError(false);
    setLocPhase('acquiring');

    let args: CheckinArgs | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLocPhase('idle');
        return;
      }
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        // Simulator often can't get a real fix — fall back to store coords in dev
        if (__DEV__ && store.lat != null && store.lng != null) {
          args = { storeId: store.id, lat: store.lat, lng: store.lng };
        } else {
          setLocationError(true);
          setLocPhase('idle');
          return;
        }
      }
      if (pos) {
        args = {
          storeId: store.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ...(pos.coords.accuracy != null ? { accuracy: pos.coords.accuracy } : {}),
        };
      }
    } catch {
      setLocationError(true);
      setLocPhase('idle');
      return;
    }

    setLocPhase('idle');
    if (!args) return;
    checkin(args, {
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
        if (result.newBadges.length > 0) setEarnedBadges(result.newBadges);
        if (result.eligibleOffers?.length > 0) setEligibleOffers(result.eligibleOffers);
        if (result.activeEvents?.length > 0) {
          setActiveEvents(result.activeEvents);
          setPendingCheckinId(result.checkinId);
        }
      },
      onError: (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 422) {
          const body = err.response.data as Record<string, unknown>;
          if (
            body.code === 'too_far' &&
            typeof body.distanceMeters === 'number' &&
            typeof body.allowedMeters === 'number'
          ) {
            setTooFarError({ distanceMeters: body.distanceMeters, allowedMeters: body.allowedMeters });
          }
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
              <Ionicons
                name="storefront-outline"
                size={22}
                color={proposed ? '#9CA3AF' : colors.accent}
              />
              <Text style={sheet.name}>{store.name}</Text>
              {proposed && (
                <View style={sheet.proposedBadge}>
                  <Text style={sheet.proposedBadgeText}>Proposed</Text>
                </View>
              )}
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

            {/* Proposed confirmation widget */}
            {proposed && (
              <View style={sheet.confirmWidget}>
                <View style={sheet.confirmWidgetHeader}>
                  <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                  <Text style={sheet.confirmWidgetTitle}>
                    {localConfirmCount}/3 confirmations
                  </Text>
                </View>
                <View style={sheet.confirmBarTrack}>
                  <View
                    style={[
                      sheet.confirmBarFill,
                      { width: `${Math.min((localConfirmCount / 3) * 100, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={sheet.confirmWidgetHint}>
                  3 players confirming it will make it live on the map
                </Text>
                {alreadyConfirmed ? (
                  <View style={sheet.confirmedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={sheet.confirmedRowText}>You confirmed this store</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      sheet.confirmBtn,
                      (pressed || isConfirming) && { opacity: 0.8 },
                    ]}
                    onPress={() => void handleConfirm()}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.textInverse} />
                        <Text style={sheet.confirmBtnText}>Confirm this is real</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            )}

            {/* Active offers */}
            {!proposed && offers.length > 0 && (
              <View style={sheet.offersSection}>
                <Text style={sheet.offersSectionTitle}>Promotions</Text>
                {offers.map((offer) => (
                  <View key={offer.id} style={sheet.offerChip}>
                    <Text style={sheet.offerChipIcon}>
                      {offer.type === 'FIRST_VISIT' ? '🎁' : '🔥'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={sheet.offerChipTitle}>{offer.title}</Text>
                      {offer.description ? (
                        <Text style={sheet.offerChipDesc} numberOfLines={2}>{offer.description}</Text>
                      ) : null}
                      {offer.type === 'STREAK' && offer.streakRequired ? (
                        <Text style={sheet.offerChipHint}>Requires {offer.streakRequired}-week streak</Text>
                      ) : offer.type === 'FIRST_VISIT' ? (
                        <Text style={sheet.offerChipHint}>First visit bonus — check in to unlock</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Active store badge */}
            {!proposed && isActiveStore && (
              <View style={sheet.activeBadge}>
                <Ionicons name="radio-outline" size={14} color={colors.success} />
                <Text style={sheet.activeText}>You're checked in here</Text>
              </View>
            )}

            {/* Tab bar */}
            {!proposed && (
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
            )}

            {!proposed && activeTab === 'schedule' && (
              eventsLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
              ) : eventDays.length === 0 ? (
                <Text style={sheet.emptyHint}>No upcoming events</Text>
              ) : (
                eventDays.map((day) => (
                  <View key={day.date}>
                    <Text style={sheet.dayLabel}>{formatDateLabel(day.date)}</Text>
                    {day.events.map((evt) => (
                      <EventRow key={evt.id} event={evt} storeId={storeId!} />
                    ))}
                  </View>
                ))
              )
            )}

            {!proposed && activeTab === 'leaderboard' && (
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
            {!proposed && isActiveStore && (
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

            {/* Location / permission errors */}
            {!proposed && permissionDenied && (
              <View style={sheet.alertBox}>
                <Ionicons name="location-outline" size={16} color={colors.warning} />
                <Text style={sheet.alertText}>Location access is needed to verify you're at the store.</Text>
                <Pressable onPress={() => void Linking.openSettings()} style={sheet.alertLink}>
                  <Text style={sheet.alertLinkText}>Open Settings</Text>
                </Pressable>
              </View>
            )}
            {!proposed && locationError && (
              <View style={sheet.alertBox}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
                <Text style={sheet.alertText}>Couldn't get your location. Try again.</Text>
              </View>
            )}
            {!proposed && tooFarError && (
              <View style={sheet.tooFarBox}>
                <Text style={sheet.tooFarTitle}>You're too far away</Text>
                <Text style={sheet.tooFarBody}>
                  You're ~{tooFarError.distanceMeters}m from {store?.name ?? 'this store'} — get within {tooFarError.allowedMeters}m to check in.
                </Text>
                <Pressable
                  style={({ pressed }) => [sheet.retryBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => { setTooFarError(null); void handleCheckin(); }}
                >
                  <Text style={sheet.retryText}>Try again</Text>
                </Pressable>
              </View>
            )}

            {/* Check-in button */}
            {!proposed && (
              checkedIn ? (
                <View style={sheet.successRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={sheet.successText}>Checked in! Discover is now active.</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    sheet.checkinBtn,
                    isActiveStore && sheet.checkinBtnActive,
                    (pressed || isCheckinPending || locPhase === 'acquiring') && { opacity: 0.8 },
                  ]}
                  onPress={isActiveStore ? onClose : () => void handleCheckin()}
                  disabled={isCheckinPending || locPhase === 'acquiring'}
                >
                  {(isCheckinPending || locPhase === 'acquiring') ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Ionicons
                      name={isActiveStore ? 'checkmark-outline' : 'enter-outline'}
                      size={18}
                      color={colors.textInverse}
                    />
                  )}
                  <Text style={sheet.checkinText}>
                    {locPhase === 'acquiring'
                      ? 'Getting your location…'
                      : isCheckinPending
                      ? 'Checking you in…'
                      : isActiveStore
                      ? 'Already here'
                      : 'Check in here'}
                  </Text>
                </Pressable>
              )
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

    {/* Event tag prompt — shown after check-in when an event is happening now */}
    {activeEvents.length > 0 && pendingCheckinId && (
      <Modal transparent animationType="fade" visible={true} onRequestClose={() => setActiveEvents([])}>
        <Pressable style={promoStyles.backdrop} onPress={() => setActiveEvents([])}>
          <View style={promoStyles.card}>
            <Text style={promoStyles.heading}>Here for an event?</Text>
            {activeEvents.map((evt) => (
              <Pressable
                key={evt.id}
                style={({ pressed }) => [eventTagStyles.eventBtn, (pressed || isAssociating) && { opacity: 0.7 }]}
                disabled={isAssociating}
                onPress={() => {
                  if (!pendingCheckinId || !storeId) return;
                  associateEvent(
                    { storeId, checkinId: pendingCheckinId, eventId: evt.id },
                    { onSettled: () => setActiveEvents([]) },
                  );
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={eventTagStyles.eventName}>{evt.name}</Text>
                  <Text style={eventTagStyles.eventTime}>{formatTime(evt.startsAt)}{evt.formatName ? ` · ${evt.formatName}` : ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [eventTagStyles.skipBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setActiveEvents([])}
            >
              <Text style={eventTagStyles.skipText}>Just visiting</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    )}

    {/* First-visit / streak promo modal */}
    {eligibleOffers.length > 0 && (
      <Modal transparent animationType="fade" visible={true} onRequestClose={() => setEligibleOffers([])}>
        <Pressable style={promoStyles.backdrop} onPress={() => setEligibleOffers([])}>
          <View style={promoStyles.card}>
            <Text style={promoStyles.heading}>You unlocked a reward!</Text>
            {eligibleOffers.map((offer) => (
              <View key={offer.id} style={promoStyles.offerBlock}>
                <Text style={promoStyles.offerTitle}>{offer.title}</Text>
                {offer.description ? (
                  <Text style={promoStyles.offerDesc}>{offer.description}</Text>
                ) : null}
                {offer.terms ? (
                  <Text style={promoStyles.terms}>{offer.terms}</Text>
                ) : null}
                <Pressable
                  style={({ pressed }) => [claimStyles.redeemBtn, (pressed || isClaiming) && { opacity: 0.7 }]}
                  disabled={isClaiming}
                  onPress={() => {
                    claimOffer({ offerId: offer.id }, {
                      onSuccess: (result) => {
                        setEligibleOffers([]);
                        setClaimResult(result);
                      },
                    });
                  }}
                >
                  {isClaiming ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={claimStyles.redeemBtnText}>Redeem at counter</Text>
                  )}
                </Pressable>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [promoStyles.dismissBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setEligibleOffers([])}
            >
              <Text style={promoStyles.dismissText}>Not now</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    )}

    {/* Claim code sheet */}
    {claimResult && (
      <Modal transparent animationType="fade" visible={true} onRequestClose={() => setClaimResult(null)}>
        <Pressable style={promoStyles.backdrop} onPress={() => setClaimResult(null)}>
          <View style={[promoStyles.card, { alignItems: 'center' }]}>
            <Text style={promoStyles.heading}>
              {effectiveStatus === 'REDEEMED' ? 'Redeemed!' : 'Show staff this code'}
            </Text>
            <Text style={claimStyles.offerTitle}>{claimResult.offerTitle}</Text>

            {effectiveStatus === 'REDEEMED' ? (
              <View style={claimStyles.redeemedBadge}>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                <Text style={claimStyles.redeemedText}>Offer redeemed — enjoy!</Text>
              </View>
            ) : (
              <>
                <Text style={claimStyles.codeDisplay}>{claimResult.code}</Text>
                <View style={claimStyles.qrWrapper}>
                  <QRCode value={claimResult.code} size={180} />
                </View>
                <Text style={claimStyles.hint}>Staff will scan or enter this code</Text>
              </>
            )}

            <Pressable
              style={({ pressed }) => [promoStyles.dismissBtn, { marginTop: 16 }, pressed && { opacity: 0.8 }]}
              onPress={() => setClaimResult(null)}
            >
              <Text style={promoStyles.dismissText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// StoresScreen
// ---------------------------------------------------------------------------

type ViewMode = 'map' | 'list';

type StoresScreenProps = NativeStackScreenProps<RootStackParamList, 'StoresMap'>;

export function StoresScreen({ navigation, route }: StoresScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(
    route.params?.storeId ?? null,
  );
  const [selectedPinProposed, setSelectedPinProposed] = useState(false);
  const [selectedPinConfirmCount, setSelectedPinConfirmCount] = useState(0);
  const [showSuggest, setShowSuggest] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const userRegion: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        };
        mapRef.current?.animateToRegion(userRegion, 600);
        setRegion(userRegion);
      } catch { /* stay on default region */ }
    })();
  }, []);

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
    setSelectedPinProposed(pin.proposed ?? false);
    setSelectedPinConfirmCount(pin.confirmationCount ?? 0);
  }, []);

  const handleSelectRow = useCallback((store: { id: string }) => {
    setSelectedStoreId(store.id);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <Pressable onPress={() => navigation.goBack()} style={styles.headerCloseBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
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
            ref={mapRef}
            style={styles.map}
            initialRegion={DEFAULT_REGION}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {pins.map((pin) => (
              <Marker
                key={pin.id}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                title={pin.name}
                onPress={() => handleSelectPin(pin)}
                pinColor={
                  pin.proposed
                    ? '#9CA3AF'
                    : activeStore?.id === pin.id
                    ? colors.success
                    : colors.accent
                }
              />
            ))}
            {pins
              .filter((p) => p.proposed && p.lat != null && p.lng != null)
              .map((p) => (
                <Circle
                  key={`${p.id}-circle`}
                  center={{ latitude: p.lat, longitude: p.lng }}
                  radius={80}
                  strokeColor="#9CA3AF66"
                  strokeWidth={1.5}
                  fillColor="transparent"
                />
              ))
            }
          </MapView>

          {(pinsLoading || !!pendingRegion) && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.suggestBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setShowSuggest(true)}
          >
            <Ionicons name="add" size={18} color={colors.textInverse} />
            <Text style={styles.suggestBtnText}>Add store</Text>
          </Pressable>
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
        proposed={selectedPinProposed}
        confirmationCount={selectedPinConfirmCount}
        onClose={() => {
          setSelectedStoreId(null);
          setSelectedPinProposed(false);
          setSelectedPinConfirmCount(0);
        }}
      />

      <StoreSuggestSheet
        visible={showSuggest}
        onClose={() => setShowSuggest(false)}
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
  headerCloseBtn: {
    padding: 2,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    letterSpacing: -0.55,
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
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  suggestBtn: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    ...shadows.md,
  },
  suggestBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
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
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    letterSpacing: -0.15,
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
    letterSpacing: -0.4,
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
  proposedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: '#9CA3AF22',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#9CA3AF44',
  },
  proposedBadgeText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: '#6B7280',
  },
  confirmWidget: {
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  confirmWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  confirmWidgetTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  confirmBarTrack: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  confirmBarFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  confirmWidgetHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.success + '18',
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  confirmedRowText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.success,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    height: 44,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  confirmBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
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
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  dayLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    letterSpacing: -0.15,
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
    fontFamily: typography.fontFamily.bold,
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
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.xs,
    backgroundColor: colors.warning + '18',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  alertText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  alertLink: { marginTop: spacing.xs },
  alertLinkText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  tooFarBox: {
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  tooFarTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  tooFarBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    marginTop: spacing.xs,
  },
  retryText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
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
    fontFamily: typography.fontFamily.semiBold,
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
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
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
  offersSection: { gap: spacing.sm, marginBottom: spacing.md },
  offersSectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  offerChip: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  offerChipIcon: { fontSize: 20, lineHeight: 26 },
  offerChipTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  offerChipDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  offerChipHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
    marginTop: 2,
  },
});

const promoStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xxxl,
    width: '100%',
    maxWidth: 340,
    gap: spacing.lg,
    ...shadows.lg,
  },
  heading: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  offerBlock: { gap: spacing.sm },
  offerTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  offerDesc: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  codeBox: {
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  codeLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  code: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 28,
    color: colors.accent,
    letterSpacing: 4,
  },
  terms: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  dismissBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dismissText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

const claimStyles = StyleSheet.create({
  redeemBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  redeemBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  offerTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  codeDisplay: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 32,
    color: colors.accent,
    letterSpacing: 5,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
  },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  redeemedBadge: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  redeemedText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.success,
    textAlign: 'center',
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
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
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
  hereNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.success + '18',
  },
  hereNowText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.success,
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
  attendanceSection: {
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  attendanceLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  attendanceEmpty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    paddingVertical: spacing.xs,
  },
});

const attendeeRow = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
  },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
  },
  hereBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.success + '18',
    borderRadius: radii.full,
  },
  hereText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.success,
  },
});

const eventTagStyles = StyleSheet.create({
  eventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  eventName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  eventTime: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
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
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
  },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
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
