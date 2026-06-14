import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PodCandidate, PodDetail, MtgFormat, PodFitTier, PublicProfile } from '@manamap/shared';
import { LogGameSheet, type RosterPlayer } from '../components/LogGameSheet';
import {
  usePodDetail,
  usePodRequest,
  usePodApprove,
  usePodDecline,
  useDisband,
  usePodLock,
} from '../hooks/usePods';
import { useProfile } from '../hooks/useMe';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii, shadows, spacing, typography } from '../theme';

type PodScreenProps = NativeStackScreenProps<RootStackParamList, 'Pod'>;

const FORMAT_LABELS: Partial<Record<MtgFormat, string>> = {
  standard: 'Standard', pioneer: 'Pioneer', modern: 'Modern',
  legacy: 'Legacy', vintage: 'Vintage', commander: 'Commander', draft: 'Draft',
};

const MANA_FILL: Record<string, string> = {
  W: colors.mana.W, U: colors.mana.U, B: colors.mana.B, R: colors.mana.R, G: colors.mana.G,
};

const FIT_COLORS: Record<PodFitTier, string> = {
  great: colors.accent,
  close: colors.warning,
  off: colors.error,
};

const FIT_BG: Record<PodFitTier, string> = {
  great: colors.accentLight,
  close: colors.warning + '29',
  off: colors.error + '26',
};

function avatarInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function avatarFill(avatarColors: string[]): string {
  return avatarColors.length > 0 ? (MANA_FILL[avatarColors[0]] ?? colors.border) : colors.border;
}

// ---------------------------------------------------------------------------
// FitBadge — compact inline pill (used in candidate / request rows)
// ---------------------------------------------------------------------------

interface FitBadgeProps {
  tier: PodFitTier;
  label: string;
}

function FitBadge({ tier, label }: FitBadgeProps) {
  return (
    <View style={[fitBadge.wrap, { backgroundColor: FIT_BG[tier] }]}>
      <View style={[fitBadge.dot, { backgroundColor: FIT_COLORS[tier] }]} />
      <Text style={[fitBadge.text, { color: FIT_COLORS[tier] }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// FitBanner — detailed banner with reason text (joiner view)
// ---------------------------------------------------------------------------

function FitBanner({ tier, label }: FitBadgeProps) {
  const title =
    tier === 'great' ? "You're a great fit" :
    tier === 'close' ? "You're close on power" :
    'Heads up on fit';
  return (
    <View style={[fitBanner.wrap, { backgroundColor: FIT_BG[tier] }]}>
      <View style={[fitBanner.dot, { backgroundColor: FIT_COLORS[tier] }]} />
      <View style={{ flex: 1 }}>
        <Text style={[fitBanner.title, { color: FIT_COLORS[tier] }]}>{title}</Text>
        <Text style={fitBanner.reason}>{label}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StatusBanner — top-of-scroll pod state indicator
// ---------------------------------------------------------------------------

interface StatusBannerProps {
  full: boolean;
  seats: number;
  need: number;
  podName: string;
}

function StatusBanner({ full, seats, need, podName }: StatusBannerProps) {
  if (full) {
    return (
      <View style={banner.full}>
        <View style={banner.iconWell}>
          <Ionicons name="checkmark" size={22} color={colors.textInverse} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={banner.fullTitle}>Pod ready!</Text>
          <Text style={banner.fullSub}>All {seats} seats filled — go play.</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={banner.forming}>
      <View style={banner.dot} />
      <Text style={banner.formingName} numberOfLines={1}>{podName}</Text>
      <View style={banner.needPill}>
        <Text style={banner.needText}>Need {need} more</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// WhereCard
// ---------------------------------------------------------------------------

function WhereCard({ where }: { where: string }) {
  return (
    <View style={whereCard.wrap}>
      <View style={whereCard.icon}>
        <Ionicons name="location-outline" size={19} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={whereCard.label}>Where to meet</Text>
        <Text style={whereCard.place}>{where}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PodInfoCard — format + power chip row
// ---------------------------------------------------------------------------

interface PodInfoCardProps {
  pod: PodDetail;
}

function PodInfoCard({ pod }: PodInfoCardProps) {
  return (
    <View style={info.row}>
      {pod.format && (
        <View style={info.chip}>
          <Text style={info.chipText}>{FORMAT_LABELS[pod.format as MtgFormat] ?? pod.format}</Text>
        </View>
      )}
      <View style={info.chip}>
        <Text style={info.chipText}>Power {pod.targetPower}±{pod.tolerance}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SeatRow — card-per-seat with role label
// ---------------------------------------------------------------------------

interface SeatRowProps {
  members: PodDetail['members'];
  seats: number;
  hostId?: string;
  myId?: string;
}

function SeatRow({ members, seats, hostId, myId }: SeatRowProps) {
  const empty = seats - members.length;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={seatRow.label}>Seats</Text>
      <View style={seatRow.row}>
        {members.map((m) => {
          const fill = avatarFill(m.avatarColors);
          const textFill = ['W', 'G'].includes(m.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
          const role = m.id === hostId ? 'Host' : m.id === myId ? 'You' : m.displayName.split(' ')[0];
          return (
            <View key={m.id} style={seatRow.card}>
              <View style={[seatRow.avatar, { backgroundColor: fill }]}>
                <Text style={[seatRow.avatarText, { color: textFill }]}>{avatarInitial(m.displayName)}</Text>
              </View>
              <Text style={seatRow.seatName} numberOfLines={1}>{role}</Text>
            </View>
          );
        })}
        {Array.from({ length: empty }).map((_, i) => (
          <View key={`empty-${i}`} style={seatRow.emptyCard}>
            <View style={seatRow.emptyCircle}>
              <Ionicons name="add-outline" size={18} color={colors.textTertiary} />
            </View>
            <Text style={seatRow.openText}>Open</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CandidateRow (host invite list)
// ---------------------------------------------------------------------------

interface CandidateRowProps {
  candidate: PodCandidate;
}

function CandidateRow({ candidate }: CandidateRowProps) {
  const fill = avatarFill(candidate.avatarColors);
  const textFill = ['W', 'G'].includes(candidate.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
  return (
    <View style={cand.card}>
      <View style={[cand.avatar, { backgroundColor: fill }]}>
        <Text style={[cand.avatarText, { color: textFill }]}>{avatarInitial(candidate.displayName)}</Text>
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={cand.name} numberOfLines={1}>{candidate.displayName}</Text>
        <FitBadge tier={candidate.fit.tier} label={candidate.fit.label} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// RequestRow (host approves/declines)
// ---------------------------------------------------------------------------

interface RequestRowProps {
  requester: PodDetail['requests'][0];
  onApprove: () => void;
  onDecline: () => void;
  isApproving: boolean;
  isDeclining: boolean;
}

function RequestRow({ requester, onApprove, onDecline, isApproving, isDeclining }: RequestRowProps) {
  const fill = avatarFill(requester.avatarColors);
  const textFill = ['W', 'G'].includes(requester.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
  return (
    <View style={req.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={[req.avatar, { backgroundColor: fill }]}>
          <Text style={[req.avatarText, { color: textFill }]}>{avatarInitial(requester.displayName)}</Text>
        </View>
        <Text style={req.name} numberOfLines={1}>{requester.displayName}</Text>
      </View>
      <View style={req.actions}>
        <Pressable
          style={({ pressed }) => [req.declineBtn, pressed && { opacity: 0.6 }]}
          onPress={onDecline}
          disabled={isDeclining}
        >
          {isDeclining
            ? <ActivityIndicator size="small" color={colors.error} />
            : <Text style={req.declineText}>Decline</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [req.approveBtn, pressed && { opacity: 0.6 }]}
          onPress={onApprove}
          disabled={isApproving}
        >
          {isApproving
            ? <ActivityIndicator size="small" color={colors.textInverse} />
            : <Text style={req.approveText}>Approve</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PodScreen
// ---------------------------------------------------------------------------

export function PodScreen({ route, navigation }: PodScreenProps) {
  const { podId } = route.params;
  const { data: pod, isLoading, isError } = usePodDetail(podId);
  const { data: profile } = useProfile();
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [lockedPlayers, setLockedPlayers] = useState<RosterPlayer[] | null>(null);
  const [logGameOpen, setLogGameOpen] = useState(false);
  const [lockedStoreId, setLockedStoreId] = useState<string | undefined>();

  const isHost = profile?.id === pod?.hostId;
  const isInPod = pod?.members.some((m) => m.id === profile?.id) ?? false;

  const approve = usePodApprove(podId);
  const decline = usePodDecline(podId);
  const request = usePodRequest(podId);
  const disband = useDisband(podId);
  const lock = usePodLock(podId);

  const handleDisband = () => {
    disband.mutate(undefined, { onSuccess: () => navigation.goBack() });
  };

  const handleLock = () => {
    const members: RosterPlayer[] = (pod?.members ?? []).map((m: PublicProfile) => ({
      userId: m.id,
      displayName: m.displayName,
      avatarColors: m.avatarColors as string[],
    }));
    const sid = pod?.storeId;
    lock.mutate(undefined, {
      onSuccess: () => {
        setLockedPlayers(members);
        setLockedStoreId(sid);
        setLogGameOpen(true);
      },
    });
  };

  const handleRequest = () => {
    request.mutate(undefined, { onSuccess: () => setHasSentRequest(true) });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (isError || !pod) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={s.title}>Pod</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={s.errorState}>
          <Text style={s.errorText}>This pod is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isFull = pod.seatsOpen === 0;
  const need = pod.seats - pod.members.length;

  // ---------------------------------------------------------------------------
  // HOST view
  // ---------------------------------------------------------------------------

  if (isHost) {
    return (
      <SafeAreaView style={s.safe}>
        {lockedPlayers && (
          <LogGameSheet
            visible={logGameOpen}
            onClose={() => { setLogGameOpen(false); navigation.goBack(); }}
            onSuccess={() => navigation.goBack()}
            preselectedPlayers={lockedPlayers}
            {...(lockedStoreId !== undefined ? { storeId: lockedStoreId } : {})}
          />
        )}

        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={s.title}>Your Pod</Text>
          <Pressable
            style={({ pressed }) => [s.disbandBtn, pressed && { opacity: 0.7 }]}
            onPress={handleDisband}
            disabled={disband.isPending}
          >
            {disband.isPending
              ? <ActivityIndicator size="small" color={colors.error} />
              : <Text style={s.disbandText}>Disband</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <StatusBanner full={isFull} seats={pod.seats} need={need} podName="Your pod" />

          <PodInfoCard pod={pod} />

          <WhereCard where={pod.where} />

          <SeatRow members={pod.members} seats={pod.seats} hostId={pod.hostId} {...(profile?.id !== undefined ? { myId: profile.id } : {})} />

          {pod.note ? (
            <View style={s.noteBox}>
              <Text style={s.noteText}>"{pod.note}"</Text>
            </View>
          ) : null}

          {isFull ? (
            <View style={s.fullActions}>
              <Pressable
                style={({ pressed }) => [s.lockBtn, pressed && { opacity: 0.75 }]}
                onPress={handleLock}
                disabled={lock.isPending}
              >
                {lock.isPending
                  ? <ActivityIndicator size="small" color={colors.textInverse} />
                  : <Text style={s.lockBtnText}>Lock it in & log game</Text>}
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.trackerBtn, pressed && { opacity: 0.75 }]}
                onPress={() => navigation.navigate('LifeTracker', { podId })}
              >
                <Ionicons name="heart-outline" size={16} color={colors.accent} />
                <Text style={s.trackerBtnText}>Life Tracker</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [s.trackerBtn, pressed && { opacity: 0.75 }]}
              onPress={() => navigation.navigate('LifeTracker', { podId })}
            >
              <Ionicons name="heart-outline" size={16} color={colors.accent} />
              <Text style={s.trackerBtnText}>Life Tracker</Text>
            </Pressable>
          )}

          {pod.requests.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Join requests</Text>
              <View style={{ gap: spacing.sm }}>
                {pod.requests.map((r) => (
                  <RequestRow
                    key={r.id}
                    requester={r}
                    onApprove={() => approve.mutate(r.id)}
                    onDecline={() => decline.mutate(r.id)}
                    isApproving={approve.isPending && approve.variables === r.id}
                    isDeclining={decline.isPending && decline.variables === r.id}
                  />
                ))}
              </View>
            </View>
          )}

          {pod.candidates.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Invite players here</Text>
              <View style={{ gap: spacing.sm }}>
                {pod.candidates.map((c) => (
                  <CandidateRow key={c.id} candidate={c} />
                ))}
              </View>
            </View>
          )}

          {pod.candidates.length === 0 && pod.requests.length === 0 && !isFull && (
            <Text style={s.emptyHint}>
              No other players at this store yet. Share your pod details verbally!
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // JOINER view
  // ---------------------------------------------------------------------------

  const hasRequested = hasSentRequest || pod.hasRequested;
  const podName = `${pod.host.displayName}'s pod`;

  return (
    <SafeAreaView style={s.safe}>
      {lockedPlayers && (
        <LogGameSheet
          visible={logGameOpen}
          onClose={() => { setLogGameOpen(false); navigation.goBack(); }}
          onSuccess={() => navigation.goBack()}
          preselectedPlayers={lockedPlayers}
          {...(lockedStoreId !== undefined ? { storeId: lockedStoreId } : {})}
        />
      )}

      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
        <Text style={s.title}>Join Pod</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <StatusBanner full={isFull} seats={pod.seats} need={need} podName={podName} />

        <PodInfoCard pod={pod} />

        <WhereCard where={pod.where} />

        <SeatRow members={pod.members} seats={pod.seats} hostId={pod.hostId} {...(profile?.id !== undefined ? { myId: profile.id } : {})} />

        {pod.note ? (
          <View style={s.noteBox}>
            <Text style={s.noteText}>"{pod.note}"</Text>
          </View>
        ) : null}

        <FitBanner tier={pod.fit.tier} label={pod.fit.label} />

        {isInPod && (
          <Pressable
            style={({ pressed }) => [s.trackerBtn, pressed && { opacity: 0.75 }]}
            onPress={() => navigation.navigate('LifeTracker', { podId })}
          >
            <Ionicons name="heart-outline" size={16} color={colors.accent} />
            <Text style={s.trackerBtnText}>Life Tracker</Text>
          </Pressable>
        )}

        {isInPod ? (
          <View style={s.inPodBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            <Text style={s.inPodText}>You're in this pod!</Text>
          </View>
        ) : hasRequested ? (
          <View style={s.sentBanner}>
            <Ionicons name="checkmark" size={18} color={colors.accent} />
            <Text style={s.sentText}>Request sent — waiting for the host</Text>
          </View>
        ) : isFull ? (
          <View style={s.fullBanner}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textTertiary} />
            <Text style={s.fullText}>This pod is full.</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [s.joinBtn, pressed && { opacity: 0.8 }]}
            onPress={handleRequest}
            disabled={request.isPending}
          >
            {request.isPending
              ? <ActivityIndicator size="small" color={colors.textInverse} />
              : <Text style={s.joinBtnText}>Ask to join</Text>}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  disbandBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.error + '50',
  },
  disbandText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  noteBox: {
    backgroundColor: colors.chipBg,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  noteText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingTop: spacing.md,
  },
  fullActions: { gap: spacing.sm },
  lockBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  lockBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  trackerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '10',
  },
  trackerBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  inPodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    padding: spacing.md,
  },
  inPodText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.accent,
  },
  sentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.lg,
  },
  sentText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  fullBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  fullText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  joinBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

const banner = StyleSheet.create({
  full: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fullTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 17,
    color: colors.textInverse,
    letterSpacing: -0.17,
  },
  fullSub: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },
  forming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    flexShrink: 0,
  },
  formingName: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 15.5,
    color: colors.textPrimary,
    letterSpacing: -0.16,
  },
  needPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  needText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
    color: colors.accentInk,
  },
});

const whereCard = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadows.sm,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.44,
  },
  place: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 1,
  },
});

const fitBadge = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  dot: { width: 6, height: 6, borderRadius: radii.full },
  text: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
  },
});

const fitBanner = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    marginTop: 5,
    flexShrink: 0,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
  },
  reason: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

const info = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12.5,
    color: colors.chipFg,
  },
  openChip: { backgroundColor: colors.accentLight },
  openChipText: { color: colors.accentInk },
});

const seatRow = StyleSheet.create({
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingTop: 11,
    paddingBottom: 9,
    paddingHorizontal: 4,
    gap: 6,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  seatName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    paddingTop: 11,
    paddingBottom: 9,
    paddingHorizontal: 4,
    gap: 6,
  },
  emptyCircle: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.32,
  },
});

const cand = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: 11,
    ...shadows.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
});

const req = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    padding: 12,
    gap: spacing.sm,
    ...shadows.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  declineBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error + '50',
    backgroundColor: colors.error + '10',
  },
  declineText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  approveText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
});
