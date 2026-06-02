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
  great: colors.success,
  close: colors.accent,
  off: colors.textTertiary,
};

const FIT_BG: Record<PodFitTier, string> = {
  great: colors.success + '20',
  close: colors.accentLight,
  off: colors.borderLight,
};

function avatarInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function avatarFill(avatarColors: string[]): string {
  return avatarColors.length > 0 ? (MANA_FILL[avatarColors[0]] ?? colors.border) : colors.border;
}

// ---------------------------------------------------------------------------
// FitBadge
// ---------------------------------------------------------------------------

interface FitBadgeProps {
  tier: PodFitTier;
  label: string;
}

function FitBadge({ tier, label }: FitBadgeProps) {
  const tierLabel = tier === 'great' ? 'Great fit' : tier === 'close' ? 'Close fit' : 'Off range';
  return (
    <View style={[fitBadge.wrap, { backgroundColor: FIT_BG[tier] }]}>
      <View style={[fitBadge.dot, { backgroundColor: FIT_COLORS[tier] }]} />
      <View style={{ flex: 1 }}>
        <Text style={[fitBadge.tier, { color: FIT_COLORS[tier] }]}>{tierLabel}</Text>
        <Text style={fitBadge.label} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PodInfoCard
// ---------------------------------------------------------------------------

interface PodInfoCardProps {
  pod: PodDetail;
}

function PodInfoCard({ pod }: PodInfoCardProps) {
  return (
    <View style={info.card}>
      <View style={info.row}>
        {pod.format && (
          <View style={info.chip}>
            <Text style={info.chipText}>{FORMAT_LABELS[pod.format as MtgFormat] ?? pod.format}</Text>
          </View>
        )}
        <View style={info.chip}>
          <Text style={info.chipText}>P{pod.targetPower}±{pod.tolerance}</Text>
        </View>
        <View style={info.chip}>
          <Text style={info.chipText}>{pod.seats} seats</Text>
        </View>
        <View style={[info.chip, info.openChip]}>
          <Text style={[info.chipText, info.openChipText]}>{pod.seatsOpen} open</Text>
        </View>
      </View>
      <View style={info.whereRow}>
        <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
        <Text style={info.whereText} numberOfLines={2}>{pod.where}</Text>
      </View>
      {pod.note ? (
        <Text style={info.note} numberOfLines={2}>{pod.note}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SeatRow
// ---------------------------------------------------------------------------

interface SeatRowProps {
  members: PodDetail['members'];
  seats: number;
}

function SeatRow({ members, seats }: SeatRowProps) {
  const empty = seats - members.length;
  return (
    <View style={seatRow.wrap}>
      <Text style={seatRow.label}>Seats</Text>
      <View style={seatRow.seats}>
        {members.map((m) => {
          const fill = avatarFill(m.avatarColors);
          const textFill = m.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
          return (
            <View key={m.id} style={[seatRow.avatar, { backgroundColor: fill }]}>
              <Text style={[seatRow.avatarText, { color: textFill }]}>{avatarInitial(m.displayName)}</Text>
            </View>
          );
        })}
        {Array.from({ length: empty }).map((_, i) => (
          <View key={`empty-${i}`} style={seatRow.emptyAvatar}>
            <Ionicons name="person-outline" size={14} color={colors.border} />
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
  const textFill = candidate.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
  return (
    <View style={cand.row}>
      <View style={[cand.avatar, { backgroundColor: fill }]}>
        <Text style={[cand.avatarText, { color: textFill }]}>{avatarInitial(candidate.displayName)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={cand.name} numberOfLines={1}>{candidate.displayName}</Text>
        {candidate.powerLevel != null && (
          <Text style={cand.sub} numberOfLines={1}>
            P{candidate.powerLevel}{candidate.formats.length > 0 ? ` · ${candidate.formats.slice(0, 2).map((f) => FORMAT_LABELS[f as MtgFormat] ?? f).join(', ')}` : ''}
          </Text>
        )}
      </View>
      <View style={[cand.fitBadge, { backgroundColor: FIT_BG[candidate.fit.tier] }]}>
        <Text style={[cand.fitText, { color: FIT_COLORS[candidate.fit.tier] }]}>
          {candidate.fit.tier === 'great' ? 'Great' : candidate.fit.tier === 'close' ? 'Close' : 'Off'}
        </Text>
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
  const textFill = requester.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
  return (
    <View style={req.row}>
      <View style={[req.avatar, { backgroundColor: fill }]}>
        <Text style={[req.avatarText, { color: textFill }]}>{avatarInitial(requester.displayName)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={req.name} numberOfLines={1}>{requester.displayName}</Text>
        {requester.powerLevel != null && (
          <Text style={req.sub} numberOfLines={1}>P{requester.powerLevel}</Text>
        )}
      </View>
      <View style={req.actions}>
        <Pressable
          style={({ pressed }) => [req.declineBtn, pressed && { opacity: 0.6 }]}
          onPress={onDecline}
          disabled={isDeclining}
        >
          {isDeclining
            ? <ActivityIndicator size="small" color={colors.error} />
            : <Ionicons name="close" size={16} color={colors.error} />}
        </Pressable>
        <Pressable
          style={({ pressed }) => [req.approveBtn, pressed && { opacity: 0.6 }]}
          onPress={onApprove}
          disabled={isApproving}
        >
          {isApproving
            ? <ActivityIndicator size="small" color={colors.textInverse} />
            : <Ionicons name="checkmark" size={16} color={colors.textInverse} />}
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
    // Capture members before pod is disbanded from Redis
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
          <PodInfoCard pod={pod} />

          <SeatRow members={pod.members} seats={pod.seats} />

          {isFull && (
            <View style={s.readyBanner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={s.readyText}>Pod Ready!</Text>
              <Pressable
                style={({ pressed }) => [s.lockBtn, pressed && { opacity: 0.75 }]}
                onPress={handleLock}
                disabled={lock.isPending}
              >
                {lock.isPending
                  ? <ActivityIndicator size="small" color={colors.textInverse} />
                  : <Text style={s.lockBtnText}>Lock it in</Text>}
              </Pressable>
            </View>
          )}

          {pod.requests.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Join requests</Text>
              <View style={s.card}>
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
              <View style={s.card}>
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
        <View style={s.hostRow}>
          {(() => {
            const fill = avatarFill(pod.host.avatarColors);
            const textFill = pod.host.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
            return (
              <>
                <View style={[s.hostAvatar, { backgroundColor: fill }]}>
                  <Text style={[s.hostAvatarText, { color: textFill }]}>{avatarInitial(pod.host.displayName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.hostName}>{pod.host.displayName}'s pod</Text>
                  {pod.host.powerLevel != null && (
                    <Text style={s.hostSub}>P{pod.host.powerLevel}</Text>
                  )}
                </View>
              </>
            );
          })()}
        </View>

        <PodInfoCard pod={pod} />

        <FitBadge tier={pod.fit.tier} label={pod.fit.label} />

        <SeatRow members={pod.members} seats={pod.seats} />

        {isInPod ? (
          <View style={s.inPodBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={s.inPodText}>You're in this pod!</Text>
          </View>
        ) : hasRequested ? (
          <View style={s.sentBanner}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <Text style={s.sentText}>Request sent — waiting for the host</Text>
          </View>
        ) : isFull ? (
          <View style={s.fullBanner}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textTertiary} />
            <Text style={s.fullText}>Pod is full</Text>
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
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  hostAvatar: {
    width: 44, height: 44, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
  },
  hostAvatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
  },
  hostName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  hostSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.success + '18',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success + '50',
    padding: spacing.md,
  },
  readyText: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.success,
  },
  lockBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minWidth: 90,
    alignItems: 'center',
  },
  lockBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  emptyHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingTop: spacing.md,
  },
  inPodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.success + '18',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success + '50',
    padding: spacing.md,
  },
  inPodText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.success,
  },
  sentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    padding: spacing.md,
  },
  sentText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
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
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

const fitBadge = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  dot: { width: 8, height: 8, borderRadius: radii.full },
  tier: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
  },
  label: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

const info = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.chipFg,
  },
  openChip: { backgroundColor: colors.accent + '18' },
  openChipText: { color: colors.accent },
  whereRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  whereText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  note: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

const seatRow = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seats: { flexDirection: 'row', gap: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  emptyAvatar: {
    width: 40, height: 40, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceWarm,
  },
});

const cand = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 38, height: 38, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
  },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  fitBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  fitText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
  },
});

const req = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 38, height: 38, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
  },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  declineBtn: {
    width: 34, height: 34, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.error + '50',
    backgroundColor: colors.error + '10',
  },
  approveBtn: {
    width: 34, height: 34, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.success,
  },
});
