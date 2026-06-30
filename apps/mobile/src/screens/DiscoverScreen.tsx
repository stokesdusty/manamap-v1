import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type {
  ManaColor as SharedManaColor,
  MtgFormat,
  NearbyPlayer,
  StoreDetail,
  Suggestion,
  LfgFeedItem,
  LfgSession,
  CreateLfg,
  LfgDuration,
  PodFeedItem,
  CreatePod,
  PodFitTier,
  PodTolerance,
} from '@manamap/shared';
import {
  useLfgMe,
  useLfgFeed,
  useCreateLfg,
  useUpdateLfg,
  useDeleteLfg,
  useLfgInvite,
  useLfgLock,
} from '../hooks/useLfg';
import { usePodFeed, useCreatePod } from '../hooks/usePods';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { TabParamList, RootStackParamList } from '../navigation/types';
import {
  useNearby,
  useSuggestions,
  useStores,
  useStorePins,
  useNotifyWhenActive,
} from '../hooks/useNearby';
import { usePresence, useCheckout } from '../hooks/usePresence';
import { useCrossedPathsCount } from '../hooks/useEncounters';
import { useActiveStore } from '../context/ActiveStoreContext';
import { usePrivacy, useProfile, useUpdatePrivacy } from '../hooks/useMe';
import { useNearestStore } from '../hooks/useNearestStore';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { useIdentityTheme } from '../hooks/useIdentityTheme';

type DiscoverScreenProps = {
  navigation: CompositeNavigationProp<
    NativeStackNavigationProp<RootStackParamList, 'Discover'>,
    BottomTabNavigationProp<TabParamList>
  >;
} & Pick<NativeStackScreenProps<RootStackParamList, 'Discover'>, 'route'>;

function avatarInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number) {
  if (km < 0.05) return "You're here";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

const MANA_FILL: Record<string, string> = {
  W: colors.mana.W,
  U: colors.mana.U,
  B: colors.mana.B,
  R: colors.mana.R,
  G: colors.mana.G,
};

function nodeColor(player: NearbyPlayer): string {
  if (player.avatarColors.length > 0) {
    return MANA_FILL[player.avatarColors[0] as SharedManaColor] ?? colors.border;
  }
  return colors.border;
}

// ---------------------------------------------------------------------------
// Store picker modal
// ---------------------------------------------------------------------------

interface StorePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (store: StoreDetail) => void;
}

function StorePicker({ visible, onClose, onSelect }: StorePickerProps) {
  const [query, setQuery] = useState('');
  const { data: stores = [], isLoading } = useStores(query.length >= 2 ? query : undefined);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={picker.safe}>
        <View style={picker.header}>
          <Text style={picker.title}>Select your store</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={picker.searchWrap}>
          <Ionicons
            name="search-outline"
            size={16}
            color={colors.textTertiary}
            style={picker.searchIcon}
          />
          <TextInput
            style={picker.searchInput}
            placeholder="Search stores…"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.accent} />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [picker.storeRow, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  onSelect({
                    ...item,
                    address: null,
                    zip: null,
                    discordUrl: null,
                    lat: null,
                    lng: null,
                  });
                  onClose();
                }}
              >
                <Ionicons name="storefront-outline" size={18} color={colors.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={picker.storeName}>{item.name}</Text>
                  {(item.city || item.state) && (
                    <Text style={picker.storeCity}>
                      {[item.city, item.state].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.borderLight} />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={picker.empty}>
                {query.length < 2 ? 'Type at least 2 characters to search' : 'No stores found'}
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Player row
// ---------------------------------------------------------------------------

const FORMAT_LABELS: Partial<Record<MtgFormat, string>> = {
  standard: 'Std',
  pioneer: 'Pio',
  modern: 'Mod',
  legacy: 'Leg',
  vintage: 'Vnt',
  commander: 'EDH',
  draft: 'Draft',
};

const FORMAT_FULL_LABELS: Partial<Record<MtgFormat, string>> = {
  standard: 'Standard',
  pioneer: 'Pioneer',
  modern: 'Modern',
  legacy: 'Legacy',
  vintage: 'Vintage',
  commander: 'Commander',
  draft: 'Draft',
};

interface PlayerRowProps {
  player: NearbyPlayer;
  onPress: () => void;
}

function PlayerRow({ player, onPress }: PlayerRowProps) {
  const fill = nodeColor(player);
  const textFill = ['W', 'G'].includes(player.avatarColors[0])
    ? colors.textPrimary
    : colors.textInverse;

  return (
    <Pressable style={({ pressed }) => [row.root, pressed && { opacity: 0.75 }]} onPress={onPress}>
      <View style={[row.avatar, { backgroundColor: fill }]}>
        <Text style={[row.avatarText, { color: textFill }]}>
          {avatarInitial(player.displayName)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 5 }}>
        <View style={row.nameRow}>
          <Text style={row.name} numberOfLines={1}>
            {player.displayName}
          </Text>
          {player.metBefore && (
            <View style={row.metBadge}>
              <Text style={row.metText}>MET</Text>
            </View>
          )}
        </View>
        <View style={row.subRow}>
          {(player.formats as MtgFormat[]).slice(0, 1).map((f) => (
            <Text key={f} style={row.sub}>
              {FORMAT_LABELS[f] ?? f}
            </Text>
          ))}
          {player.commander ? (
            <Text style={row.sub} numberOfLines={1}>
              {' '}
              · {player.commander}
            </Text>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.border} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Suggestions carousel
// ---------------------------------------------------------------------------

interface SuggestionCardProps {
  suggestion: Suggestion;
  onPress: () => void;
}

function SuggestionCard({ suggestion, onPress }: SuggestionCardProps) {
  const fill =
    suggestion.avatarColors.length > 0
      ? (MANA_FILL[suggestion.avatarColors[0] as SharedManaColor] ?? colors.border)
      : colors.border;
  const textFill = ['W', 'G'].includes(suggestion.avatarColors[0])
    ? colors.textPrimary
    : colors.textInverse;
  const topReasons = suggestion.reasons.slice(0, 2);

  return (
    <Pressable style={({ pressed }) => [sugg.card, pressed && { opacity: 0.75 }]} onPress={onPress}>
      <View style={[sugg.avatar, { backgroundColor: fill }]}>
        <Text style={[sugg.avatarText, { color: textFill }]}>
          {avatarInitial(suggestion.displayName)}
        </Text>
      </View>
      <Text style={sugg.name} numberOfLines={1}>
        {suggestion.displayName}
      </Text>
      {topReasons.map((r, i) => (
        <Text key={i} style={sugg.reason} numberOfLines={1}>
          {r.label}
        </Text>
      ))}
    </Pressable>
  );
}

interface SuggestionsCarouselProps {
  suggestions: Suggestion[];
  onSelectSuggestion: (s: Suggestion) => void;
}

function SuggestionsCarousel({ suggestions, onSelectSuggestion }: SuggestionsCarouselProps) {
  if (suggestions.length === 0) return null;

  return (
    <View style={sugg.wrap}>
      <View style={sugg.header}>
        <Ionicons name="sparkles" size={14} color={colors.accent} />
        <Text style={sugg.headerText}>Good matches here</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sugg.scroll}
      >
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} onPress={() => onSelectSuggestion(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LFG helpers
// ---------------------------------------------------------------------------

function lfgMinutesLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

// ---------------------------------------------------------------------------
// LFGStatusBar
// ---------------------------------------------------------------------------

interface LFGStatusBarProps {
  session: LfgSession | null | undefined;
  isLoading: boolean;
  isCheckedIn: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onStop: () => void;
  onManagePod: () => void;
}

function LFGStatusBar({
  session,
  isLoading,
  isCheckedIn,
  onOpen,
  onEdit,
  onStop,
  onManagePod,
}: LFGStatusBarProps) {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 60_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session]);

  // Suppress the lint warning — tick is used to force re-render for countdown
  void tick;

  if (isLoading) return null;

  if (!session) {
    return (
      <Pressable
        style={({ pressed }) => [
          lfgBar.cta,
          !isCheckedIn && lfgBar.ctaDisabled,
          pressed && { opacity: 0.75 },
        ]}
        onPress={isCheckedIn ? onOpen : undefined}
        accessibilityLabel="Open to play now"
      >
        <View style={lfgBar.ctaIcon}>
          <Ionicons name="flash" size={22} color={colors.textInverse} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={lfgBar.ctaTitle}>Open to play now</Text>
          <Text style={lfgBar.ctaSubtitle}>
            {!isCheckedIn ? 'Check in to a store first' : 'Let players here know you want a game'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
      </Pressable>
    );
  }

  const minsLeft = lfgMinutesLeft(session.expiresAt);

  return (
    <View style={lfgBar.active}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={lfgBar.activeLabel}>You're open to play</Text>
          <View style={lfgBar.timerPill}>
            <Text style={lfgBar.timerText}>{minsLeft}m left</Text>
          </View>
        </View>
        <View style={lfgBar.chips}>
          {session.format && (
            <View style={lfgBar.chip}>
              <Text style={lfgBar.chipText}>
                {FORMAT_LABELS[session.format as MtgFormat] ?? session.format}
              </Text>
            </View>
          )}
          <View style={lfgBar.chip}>
            <Text style={lfgBar.chipText}>P{session.power}</Text>
          </View>
          <View style={lfgBar.chip}>
            <Text style={lfgBar.chipText}>
              {session.seats} seat{session.seats !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
      <View style={lfgBar.actions}>
        <Pressable
          style={({ pressed }) => [lfgBar.actionBtn, pressed && { opacity: 0.6 }]}
          onPress={onManagePod}
        >
          <Ionicons name="people-outline" size={15} color={colors.accent} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [lfgBar.actionBtn, pressed && { opacity: 0.6 }]}
          onPress={onEdit}
        >
          <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [lfgBar.actionBtn, lfgBar.stopBtn, pressed && { opacity: 0.6 }]}
          onPress={onStop}
        >
          <Ionicons name="stop-circle-outline" size={15} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LFGOpenRow
// ---------------------------------------------------------------------------

interface LFGOpenRowProps {
  item: LfgFeedItem;
  onJoin: () => void;
  joined: boolean;
}

function LFGOpenRow({ item, onJoin, joined }: LFGOpenRowProps) {
  const fill =
    item.avatarColors.length > 0
      ? (MANA_FILL[item.avatarColors[0] as SharedManaColor] ?? colors.border)
      : colors.border;
  const textFill = ['W', 'G'].includes(item.avatarColors[0])
    ? colors.textPrimary
    : colors.textInverse;

  return (
    <View style={lfgSection.row}>
      <View style={[lfgSection.avatar, { backgroundColor: fill }]}>
        <Text style={[lfgSection.avatarText, { color: textFill }]}>
          {avatarInitial(item.displayName)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={lfgSection.name} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.metBefore && (
            <View style={lfgSection.metBadge}>
              <Text style={lfgSection.metText}>Met</Text>
            </View>
          )}
          <Text style={lfgSection.timer}>{item.minutesLeft}m</Text>
        </View>
        <View style={lfgSection.chips}>
          {item.session.format && (
            <View style={lfgSection.chip}>
              <Text style={lfgSection.chipText}>
                {FORMAT_LABELS[item.session.format as MtgFormat] ?? item.session.format}
              </Text>
            </View>
          )}
          <View style={lfgSection.chip}>
            <Text style={lfgSection.chipText}>P{item.session.power}</Text>
          </View>
          <View style={lfgSection.chip}>
            <Text style={lfgSection.chipText}>
              {item.session.seats} seat{item.session.seats !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {item.session.note ? (
          <Text style={lfgSection.note} numberOfLines={1}>
            {item.session.note}
          </Text>
        ) : null}
      </View>
      <Pressable
        style={({ pressed }) => [
          lfgSection.joinBtn,
          joined && lfgSection.joinBtnSent,
          pressed && { opacity: 0.7 },
        ]}
        onPress={joined ? undefined : onJoin}
        accessibilityLabel={joined ? 'Request sent' : 'Join pod'}
      >
        <Text style={[lfgSection.joinText, joined && lfgSection.joinTextSent]}>
          {joined ? 'Sent' : 'Join'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LFGSection
// ---------------------------------------------------------------------------

interface LFGSectionProps {
  items: LfgFeedItem[];
  sentInvites: Set<string>;
  onJoin: (item: LfgFeedItem) => void;
}

function LFGSection({ items, sentInvites, onJoin }: LFGSectionProps) {
  if (items.length === 0) return null;
  return (
    <View style={lfgSection.wrap}>
      <View style={lfgSection.header}>
        <Text style={lfgSection.headerText}>Open to play now</Text>
        <View style={lfgSection.headerCountBadge}>
          <Text style={lfgSection.headerCountText}>{items.length}</Text>
        </View>
      </View>
      <View style={lfgSection.list}>
        {items.map((item) => (
          <LFGOpenRow
            key={item.id}
            item={item}
            onJoin={() => onJoin(item)}
            joined={sentInvites.has(item.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pods helpers
// ---------------------------------------------------------------------------

const POD_FIT_COLORS: Record<PodFitTier, string> = {
  great: colors.success,
  close: colors.accent,
  off: colors.textTertiary,
};

const POD_FIT_BG: Record<PodFitTier, string> = {
  great: colors.success + '20',
  close: colors.accentLight,
  off: colors.borderLight,
};

const POD_FIT_LABELS: Record<PodFitTier, string> = {
  great: 'Great fit',
  close: 'Close fit',
  off: 'Off range',
};

// ---------------------------------------------------------------------------
// PodsSection
// ---------------------------------------------------------------------------

interface PodsSectionProps {
  pods: PodFeedItem[];
  isCheckedIn: boolean;
  onStartPod: () => void;
  onOpenPod: (pod: PodFeedItem) => void;
}

function PodsSection({ pods, isCheckedIn, onStartPod, onOpenPod }: PodsSectionProps) {
  return (
    <View style={podsSection.wrap}>
      <View style={podsSection.header}>
        <View style={podsSection.headerLeft}>
          <Ionicons name="people-outline" size={13} color={colors.accent} />
          <Text style={podsSection.headerText}>Pods forming here</Text>
          {pods.length > 0 && <Text style={podsSection.headerCount}>{pods.length}</Text>}
        </View>
        <Pressable
          style={({ pressed }) => [
            podsSection.startBtn,
            !isCheckedIn && podsSection.startBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
          onPress={isCheckedIn ? onStartPod : undefined}
          accessibilityLabel="Start a pod"
        >
          <Ionicons
            name="add"
            size={13}
            color={isCheckedIn ? colors.accent : colors.textTertiary}
          />
          <Text
            style={[podsSection.startBtnText, !isCheckedIn && podsSection.startBtnTextDisabled]}
          >
            Start a pod
          </Text>
        </Pressable>
      </View>

      {pods.length === 0 ? (
        <Text style={podsSection.empty}>No pods forming at this store yet</Text>
      ) : (
        <View style={podsSection.list}>
          {pods.map((pod) => {
            const fill =
              pod.host.avatarColors.length > 0
                ? (MANA_FILL[pod.host.avatarColors[0] as SharedManaColor] ?? colors.border)
                : colors.border;
            const textFill = ['W', 'G'].includes(pod.host.avatarColors[0])
              ? colors.textPrimary
              : colors.textInverse;
            return (
              <Pressable
                key={pod.id}
                style={({ pressed }) => [podsSection.row, pressed && { opacity: 0.7 }]}
                onPress={() => onOpenPod(pod)}
              >
                <View style={[podsSection.avatar, { backgroundColor: fill }]}>
                  <Text style={[podsSection.avatarText, { color: textFill }]}>
                    {pod.host.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={podsSection.hostName} numberOfLines={1}>
                    {pod.host.displayName}'s pod
                  </Text>
                  <View style={podsSection.chips}>
                    {pod.format && (
                      <View style={podsSection.chip}>
                        <Text style={podsSection.chipText}>
                          {FORMAT_LABELS[pod.format as MtgFormat] ?? pod.format}
                        </Text>
                      </View>
                    )}
                    <View style={podsSection.chip}>
                      <Text style={podsSection.chipText}>
                        P{pod.targetPower}±{pod.tolerance}
                      </Text>
                    </View>
                    <View style={podsSection.chip}>
                      <Text style={podsSection.chipText}>{pod.seatsOpen} open</Text>
                    </View>
                  </View>
                  <Text style={podsSection.where} numberOfLines={1}>
                    📍 {pod.where}
                  </Text>
                </View>
                <View style={[podsSection.fitBadge, { backgroundColor: POD_FIT_BG[pod.fit.tier] }]}>
                  <Text style={[podsSection.fitText, { color: POD_FIT_COLORS[pod.fit.tier] }]}>
                    {POD_FIT_LABELS[pod.fit.tier]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PodCreateSheet
// ---------------------------------------------------------------------------

const ALL_POD_FORMATS: MtgFormat[] = [
  'commander',
  'modern',
  'standard',
  'pioneer',
  'legacy',
  'vintage',
  'draft',
];
const POD_TOLERANCES: PodTolerance[] = [1, 2, 3];
const POD_SEATS = [2, 3, 4] as const;

interface PodCreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePod) => void;
  isSubmitting: boolean;
}

function PodCreateSheet({ visible, onClose, onSubmit, isSubmitting }: PodCreateSheetProps) {
  const [format, setFormat] = useState<MtgFormat | null>(null);
  const [targetPower, setTargetPower] = useState(7);
  const [tolerance, setTolerance] = useState<PodTolerance>(1);
  const [seats, setSeats] = useState<2 | 3 | 4>(4);
  const [where, setWhere] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setFormat(null);
      setTargetPower(7);
      setTolerance(1);
      setSeats(4);
      setWhere('');
      setNote('');
    }
  }, [visible]);

  const canSubmit = where.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({
      format: format ?? null,
      targetPower,
      tolerance,
      seats,
      where: where.trim(),
      note: note.trim() || null,
    });
  }, [canSubmit, format, targetPower, tolerance, seats, where, note, onSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={podCreate.safe}>
        <View style={podCreate.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={podCreate.title}>Start a pod</Text>
          <Pressable
            style={({ pressed }) => [
              podCreate.submitBtn,
              !canSubmit && podCreate.submitBtnDisabled,
              isSubmitting && { opacity: 0.5 },
              pressed && { opacity: 0.75 },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={podCreate.submitText}>Create</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={podCreate.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={spacing.xl}
        >
          <Text style={podCreate.sectionLabel}>Format (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={podCreate.chipRow}
          >
            {ALL_POD_FORMATS.map((f) => {
              const active = format === f;
              return (
                <Pressable
                  key={f}
                  style={[podCreate.chip, active && podCreate.chipActive]}
                  onPress={() => setFormat(format === f ? null : f)}
                >
                  <Text style={[podCreate.chipText, active && podCreate.chipTextActive]}>
                    {FORMAT_FULL_LABELS[f] ?? f}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={podCreate.sectionLabel}>Target power</Text>
          <View style={podCreate.stepper}>
            <Pressable
              style={podCreate.stepBtn}
              onPress={() => setTargetPower((p) => Math.max(1, p - 1))}
              hitSlop={6}
            >
              <Ionicons name="remove" size={16} color={colors.textSecondary} />
            </Pressable>
            <Text style={podCreate.stepVal}>{targetPower}</Text>
            <Pressable
              style={podCreate.stepBtn}
              onPress={() => setTargetPower((p) => Math.min(10, p + 1))}
              hitSlop={6}
            >
              <Ionicons name="add" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={podCreate.sectionLabel}>Tolerance</Text>
          <View style={podCreate.segRow}>
            {POD_TOLERANCES.map((t) => (
              <Pressable
                key={t}
                style={[podCreate.seg, tolerance === t && podCreate.segActive]}
                onPress={() => setTolerance(t)}
              >
                <Text style={[podCreate.segText, tolerance === t && podCreate.segTextActive]}>
                  ±{t}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={podCreate.sectionLabel}>Seats (total players)</Text>
          <View style={podCreate.segRow}>
            {POD_SEATS.map((s) => (
              <Pressable
                key={s}
                style={[podCreate.seg, seats === s && podCreate.segActive]}
                onPress={() => setSeats(s)}
              >
                <Text style={[podCreate.segText, seats === s && podCreate.segTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={podCreate.sectionLabel}>
            Where to meet <Text style={podCreate.required}>*</Text>
          </Text>
          <TextInput
            style={podCreate.whereInput}
            placeholder="e.g. back table by the draft pods"
            placeholderTextColor={colors.textTertiary}
            value={where}
            onChangeText={setWhere}
            maxLength={40}
          />
          <Text style={podCreate.charCount}>{where.length}/40</Text>

          <Text style={podCreate.sectionLabel}>Note (optional)</Text>
          <TextInput
            style={podCreate.noteInput}
            placeholder="e.g. all welcome, have extra decks"
            placeholderTextColor={colors.textTertiary}
            value={note}
            onChangeText={setNote}
            maxLength={140}
            multiline
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// LFGComposer (create / edit sheet)
// ---------------------------------------------------------------------------

const ALL_LFG_FORMATS: MtgFormat[] = [
  'commander',
  'modern',
  'standard',
  'pioneer',
  'legacy',
  'vintage',
  'draft',
];
const DURATIONS: LfgDuration[] = [30, 60, 120];
const DURATION_LABELS: Record<LfgDuration, string> = { 30: '30 min', 60: '1 hr', 120: '2 hrs' };

interface LFGComposerProps {
  visible: boolean;
  initial?: LfgSession | null;
  onClose: () => void;
  onSubmit: (data: CreateLfg) => void;
  isSubmitting: boolean;
}

function LFGComposer({ visible, initial, onClose, onSubmit, isSubmitting }: LFGComposerProps) {
  const [format, setFormat] = useState<MtgFormat | null>((initial?.format as MtgFormat) ?? null);
  const [power, setPower] = useState(initial?.power ?? 7);
  const [seats, setSeats] = useState<1 | 2 | 3>((initial?.seats as 1 | 2 | 3) ?? 2);
  const [duration, setDuration] = useState<LfgDuration>(initial?.durationMins ?? 60);
  const [note, setNote] = useState(initial?.note ?? '');

  useEffect(() => {
    if (visible) {
      setFormat((initial?.format as MtgFormat) ?? null);
      setPower(initial?.power ?? 7);
      setSeats((initial?.seats as 1 | 2 | 3) ?? 2);
      setDuration(initial?.durationMins ?? 60);
      setNote(initial?.note ?? '');
    }
  }, [visible, initial]);

  const handleSubmit = useCallback(() => {
    onSubmit({
      format: format ?? null,
      power,
      seats,
      durationMins: duration,
      note: note.trim() || null,
    });
  }, [format, power, seats, duration, note, onSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={composer.safe}>
        <View style={composer.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={composer.title}>{initial ? 'Edit session' : "I'm open to play"}</Text>
          <Pressable
            style={({ pressed }) => [
              composer.submitBtn,
              isSubmitting && { opacity: 0.5 },
              pressed && { opacity: 0.75 },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={composer.submitText}>{initial ? 'Save' : 'Go open'}</Text>
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={composer.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={spacing.xl}
        >
          <Text style={composer.sectionLabel}>Format (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={composer.chipRow}
          >
            {ALL_LFG_FORMATS.map((f) => {
              const active = format === f;
              return (
                <Pressable
                  key={f}
                  style={[composer.chip, active && composer.chipActive]}
                  onPress={() => setFormat(format === f ? null : f)}
                >
                  <Text style={[composer.chipText, active && composer.chipTextActive]}>
                    {FORMAT_FULL_LABELS[f] ?? f}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={composer.sectionLabel}>Power level</Text>
          <View style={composer.stepper}>
            <Pressable
              style={composer.stepBtn}
              onPress={() => setPower((p) => Math.max(1, p - 1))}
              hitSlop={6}
            >
              <Ionicons name="remove" size={16} color={colors.textSecondary} />
            </Pressable>
            <Text style={composer.stepVal}>{power}</Text>
            <Pressable
              style={composer.stepBtn}
              onPress={() => setPower((p) => Math.min(10, p + 1))}
              hitSlop={6}
            >
              <Ionicons name="add" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={composer.sectionLabel}>Seats needed</Text>
          <View style={composer.segRow}>
            {([1, 2, 3] as const).map((s) => (
              <Pressable
                key={s}
                style={[composer.seg, seats === s && composer.segActive]}
                onPress={() => setSeats(s)}
              >
                <Text style={[composer.segText, seats === s && composer.segTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={composer.sectionLabel}>Open for</Text>
          <View style={composer.segRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[composer.seg, duration === d && composer.segActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[composer.segText, duration === d && composer.segTextActive]}>
                  {DURATION_LABELS[d]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={composer.sectionLabel}>Note (optional)</Text>
          <TextInput
            style={composer.noteInput}
            placeholder="e.g. looking for a 4-player pod, any format OK"
            placeholderTextColor={colors.textTertiary}
            value={note}
            onChangeText={setNote}
            maxLength={140}
            multiline
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PodSheet (host manages pod — select members + lock)
// ---------------------------------------------------------------------------

interface PodSheetProps {
  visible: boolean;
  mySession: LfgSession | null | undefined;
  feed: LfgFeedItem[];
  onClose: () => void;
  onLock: (memberIds: string[]) => void;
  isLocking: boolean;
}

function PodSheet({ visible, mySession, feed, onClose, onLock, isLocking }: PodSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else if (next.size < (mySession?.seats ?? 3)) next.add(id);
        return next;
      });
    },
    [mySession?.seats],
  );

  if (!mySession) return null;

  const minsLeft = lfgMinutesLeft(mySession.expiresAt);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={pod.safe}>
        <View style={pod.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={pod.title}>Lock your pod</Text>
          <Pressable
            style={({ pressed }) => [
              pod.lockBtn,
              selected.size === 0 && pod.lockBtnDisabled,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => onLock([...selected])}
            disabled={isLocking || selected.size === 0}
          >
            {isLocking ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={pod.lockText}>Lock ({selected.size})</Text>
            )}
          </Pressable>
        </View>

        <View style={pod.sessionInfo}>
          <Text style={pod.sessionLabel}>Your session</Text>
          <View style={pod.sessionChips}>
            {mySession.format && (
              <View style={pod.chip}>
                <Text style={pod.chipText}>
                  {FORMAT_LABELS[mySession.format as MtgFormat] ?? mySession.format}
                </Text>
              </View>
            )}
            <View style={pod.chip}>
              <Text style={pod.chipText}>P{mySession.power}</Text>
            </View>
            <View style={pod.chip}>
              <Text style={pod.chipText}>
                {mySession.seats} seat{mySession.seats !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={pod.timerText}>{minsLeft}m left</Text>
          </View>
          <Text style={pod.hint}>
            Select up to {mySession.seats} player{mySession.seats !== 1 ? 's' : ''} to seat
          </Text>
        </View>

        {feed.length === 0 ? (
          <Text style={pod.empty}>No other open players at your store right now</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
            {feed.map((item) => {
              const isSelected = selected.has(item.id);
              const fill =
                item.avatarColors.length > 0
                  ? (MANA_FILL[item.avatarColors[0] as SharedManaColor] ?? colors.border)
                  : colors.border;
              const textFill = ['W', 'G'].includes(item.avatarColors[0])
                ? colors.textPrimary
                : colors.textInverse;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    pod.row,
                    isSelected && pod.rowSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => toggleSelect(item.id)}
                >
                  <View style={[pod.avatar, { backgroundColor: fill }]}>
                    <Text style={[pod.avatarText, { color: textFill }]}>
                      {avatarInitial(item.displayName)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={pod.name} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <View style={pod.chips}>
                      {item.session.format && (
                        <View style={pod.chip}>
                          <Text style={pod.chipText}>
                            {FORMAT_LABELS[item.session.format as MtgFormat] ?? item.session.format}
                          </Text>
                        </View>
                      )}
                      <View style={pod.chip}>
                        <Text style={pod.chipText}>P{item.session.power}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[pod.checkbox, isSelected && pod.checkboxSelected]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EmptyStoreState — "be the first" invitation when nobody else is here
// ---------------------------------------------------------------------------

interface EmptyStoreStateProps {
  storeName: string;
  isOpenToPlay: boolean;
  onGoOpen: () => void;
  onNotifyMe: () => void;
  isSubscribed: boolean;
  isSubscribing: boolean;
}

function EmptyStoreState({
  storeName,
  isOpenToPlay,
  onGoOpen,
  onNotifyMe,
  isSubscribed,
  isSubscribing,
}: EmptyStoreStateProps) {
  return (
    <View style={emptyState.wrap}>
      <View style={emptyState.iconWell}>
        <Ionicons name="moon-outline" size={24} color={colors.textTertiary} />
      </View>
      <Text style={emptyState.title}>No one's open right now</Text>
      <Text style={emptyState.sub}>
        {isOpenToPlay
          ? `You're open to play — we'll let the table fill in around you at ${storeName}.`
          : `Be the first — go open to play and put ${storeName} on the map for tonight.`}
      </Text>

      {!isOpenToPlay && (
        <Pressable
          style={({ pressed }) => [emptyState.cta, pressed && { opacity: 0.85 }]}
          onPress={onGoOpen}
        >
          <Ionicons name="flash" size={16} color={colors.textInverse} />
          <Text style={emptyState.ctaText}>Go Open to Play</Text>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [emptyState.pingBtn, pressed && !isSubscribed && { opacity: 0.7 }]}
        onPress={isSubscribed ? undefined : onNotifyMe}
        disabled={isSubscribing || isSubscribed}
        accessibilityLabel="Ping me when players show up"
      >
        {isSubscribing ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Ionicons
            name={isSubscribed ? 'checkmark-circle' : 'notifications-outline'}
            size={14}
            color={isSubscribed ? colors.success : colors.textSecondary}
          />
        )}
        <Text style={[emptyState.pingText, isSubscribed && { color: colors.success }]}>
          {isSubscribed ? "We'll ping you when players show up" : 'Ping me when players show up'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DiscoverScreen
// ---------------------------------------------------------------------------

export function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { activeStore, setActiveStore } = useActiveStore();
  const [showPicker, setShowPicker] = useState(false);

  // LFG state
  const [showComposer, setShowComposer] = useState(false);
  const [showPodSheet, setShowPodSheet] = useState(false);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());

  // Pod state
  const [showPodComposer, setShowPodComposer] = useState(false);

  // "Be the first" empty-store state
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const notifyWhenActive = useNotifyWhenActive();

  useEffect(() => {
    setNotifySubscribed(false);
  }, [activeStore?.id]);

  // LFG hooks
  const { data: myLfgSession } = useLfgMe();
  const { data: lfgFeed = [] } = useLfgFeed(!!activeStore);
  const createLfg = useCreateLfg();
  const updateLfg = useUpdateLfg();
  const deleteLfg = useDeleteLfg();
  const inviteLfg = useLfgInvite();
  const lockLfg = useLfgLock();

  // Pod hooks
  const { data: podFeed = [] } = usePodFeed(!!activeStore);
  const createPod = useCreatePod();

  // Presence heartbeat
  usePresence();
  const { mutate: checkout } = useCheckout();

  const insets = useSafeAreaInsets();

  // Identity theme
  const identityTheme = useIdentityTheme();

  // Onboarding banner
  const { data: profile } = useProfile();
  const showOnboardBanner = profile != null && profile.onboardedAt == null;
  const myUserId = profile?.id ?? '';

  // LFG handlers
  const handleComposerSubmit = useCallback(
    (data: CreateLfg) => {
      if (myLfgSession) {
        updateLfg.mutate(data, { onSuccess: () => setShowComposer(false) });
      } else {
        createLfg.mutate(data, { onSuccess: () => setShowComposer(false) });
      }
    },
    [myLfgSession, createLfg, updateLfg],
  );

  const handleLfgJoin = useCallback(
    (item: LfgFeedItem) => {
      setSentInvites((prev) => new Set(prev).add(item.id));
      inviteLfg.mutate(item.id);
    },
    [inviteLfg],
  );

  const handleLfgLock = useCallback(
    (memberIds: string[]) => {
      lockLfg.mutate(
        { hostUserId: myUserId, memberIds },
        { onSuccess: () => setShowPodSheet(false) },
      );
    },
    [lockLfg, myUserId],
  );

  const handleNotifyMe = useCallback(() => {
    if (!activeStore) return;
    notifyWhenActive.mutate(
      { storeId: activeStore.id },
      { onSuccess: () => setNotifySubscribed(true) },
    );
  }, [activeStore, notifyWhenActive]);

  // Pod handlers
  const handlePodComposerSubmit = useCallback(
    (data: CreatePod) => {
      createPod.mutate(data, { onSuccess: () => setShowPodComposer(false) });
    },
    [createPod],
  );

  const handleOpenPod = useCallback(
    (pod: PodFeedItem) => {
      navigation.navigate('Pod', { podId: pod.id });
    },
    [navigation],
  );

  // Go invisible toggle
  const { data: privacy } = usePrivacy();
  const { mutate: updatePrivacy } = useUpdatePrivacy();
  const isInvisible = privacy?.discoverable === false;
  const handleToggleInvisible = useCallback(() => {
    updatePrivacy({ discoverable: isInvisible });
  }, [isInvisible, updatePrivacy]);

  // Nearest store (for header when not checked in)
  const { store: nearestStore, distanceKm: nearestDistKm } = useNearestStore();

  // Nearby players (filtered)
  // Always enabled — API returns store-based players when checked in,
  // or location-based players (800 m radius, 15 min staleness) otherwise.
  const { data: nearby, isLoading: isLoadingNearby } = useNearby(true);

  // Matchmaking suggestions (unfiltered — separate ranking)
  const { data: suggestionsData } = useSuggestions(!!activeStore);

  // Crossed-paths nudge
  const crossedPathsCount = useCrossedPathsCount();

  // Banner event sub-line

  const allPlayers = nearby?.players ?? [];

  // When not checked in, fetch pins near the user's last known location to find the closest store
  const userLat = profile?.lastLat ?? null;
  const userLng = profile?.lastLng ?? null;
  const nearbyBbox =
    !activeStore && userLat && userLng
      ? `${userLng - 0.15},${userLat - 0.15},${userLng + 0.15},${userLat + 0.15}`
      : null;
  const { data: nearbyPins = [] } = useStorePins(nearbyBbox);

  const closestPin = useMemo(() => {
    if (!userLat || !userLng || nearbyPins.length === 0) return null;
    let best = nearbyPins[0];
    let bestDist = haversineKm(userLat, userLng, best.lat, best.lng);
    for (const pin of nearbyPins.slice(1)) {
      const d = haversineKm(userLat, userLng, pin.lat, pin.lng);
      if (d < bestDist) {
        best = pin;
        bestDist = d;
      }
    }
    return { name: best.name, distLabel: formatDist(bestDist) };
  }, [nearbyPins, userLat, userLng]);

  const distLabel: string | null = (() => {
    if (!activeStore?.lat || !activeStore?.lng) return null;
    if (!userLat || !userLng) return null;
    return formatDist(haversineKm(userLat, userLng, activeStore.lat, activeStore.lng));
  })();

  const suggestions = suggestionsData?.suggestions ?? [];

  const handleOpenPreview = useCallback(
    (player: NearbyPlayer) => {
      navigation.navigate('PlayerPreview', {
        profile: player,
        sharedEvent: player.sharedEvent,
        lastMetStoreName: player.lastMetStoreName,
      });
    },
    [navigation],
  );

  const handleOpenSuggestion = useCallback(
    (s: Suggestion) => {
      navigation.navigate('PlayerPreview', {
        profile: s,
        sharedEvent: s.sharedEvent,
        lastMetStoreName: s.lastMetStoreName,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      {showOnboardBanner && (
        <Pressable style={({ pressed }) => [banner.root, pressed && { opacity: 0.85 }]}>
          <Ionicons name="person-outline" size={16} color={colors.accent} />
          <Text style={banner.text}>Finish your profile to appear in nearby search</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        </Pressable>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Discover</Text>
        </View>
        <View style={styles.titleDivider} />
        <View style={styles.headerSubrow}>
          {/* Tappable store info */}
          <Pressable
            style={({ pressed }) => [styles.storeInfoBtn, pressed && { opacity: 0.75 }]}
            onPress={() =>
              navigation.navigate(
                'StoresMap',
                activeStore
                  ? { storeId: activeStore.id }
                  : nearestStore
                    ? { storeId: nearestStore.id }
                    : undefined,
              )
            }
          >
            {activeStore ? (
              <>
                <View style={styles.storeGlowDot} />
                <Text style={[styles.storeName, { color: identityTheme.accent }]} numberOfLines={1}>
                  {activeStore.name}
                </Text>
              </>
            ) : nearestStore && nearestDistKm != null ? (
              <>
                <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.closestLabel}>Closest LGS</Text>
                <Text style={styles.storeName} numberOfLines={1}>
                  {nearestStore.name} ·{' '}
                  {nearestDistKm < 1.6
                    ? `${Math.round(nearestDistKm * 1000)}m`
                    : `${(nearestDistKm * 0.621371).toFixed(1)}mi`}
                </Text>
              </>
            ) : (
              <Text style={styles.storeHint}>No store selected</Text>
            )}
            <Ionicons
              name="chevron-forward"
              size={13}
              color={colors.textTertiary}
              style={{ flexShrink: 0 }}
            />
          </Pressable>
        </View>
      </View>

      {/* Invisible banner */}
      {isInvisible && (
        <Pressable style={styles.invisibleBanner} onPress={handleToggleInvisible}>
          <Ionicons name="eye-off-outline" size={16} color={colors.textInverse} />
          <Text style={styles.invisibleBannerText}>You're invisible — nobody here can see you</Text>
          <Text style={styles.invisibleBannerCta}>Go visible</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Store context ── */}
        <View style={styles.storeSection}>
          {activeStore ? (
            <>
              <View style={styles.storeSectionRow}>
                <Ionicons name="storefront-outline" size={16} color={identityTheme.accent} />
                <Text
                  style={[styles.storeSectionName, { color: identityTheme.accent }]}
                  numberOfLines={1}
                >
                  {activeStore.name}
                </Text>
                <Pressable onPress={() => checkout()} hitSlop={8} style={styles.leaveBtn}>
                  <Text style={styles.leaveBtnText}>Leave</Text>
                </Pressable>
              </View>
              {distLabel && <Text style={styles.storeSectionDist}>{distLabel}</Text>}
            </>
          ) : closestPin ? (
            <Pressable
              style={styles.storeSectionEmpty}
              onPress={() => navigation.navigate('StoresMap')}
            >
              <View style={styles.storeSectionRow}>
                <Ionicons name="storefront-outline" size={16} color={colors.textSecondary} />
                <Text
                  style={[styles.storeSectionName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {closestPin.name}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </View>
              <Text style={styles.storeSectionDist}>{closestPin.distLabel} · Tap to check in</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.storeSectionEmpty}
              onPress={() => navigation.navigate('StoresMap')}
            >
              <Ionicons name="location-outline" size={15} color={colors.textTertiary} />
              <Text style={styles.storeSectionEmptyText}>Find a nearby store to check in</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* LFG bar + suggestions (store only) */}
        {activeStore && (
          <>
            <LFGStatusBar
              session={myLfgSession}
              isLoading={false}
              isCheckedIn={!!activeStore}
              onOpen={() => setShowComposer(true)}
              onEdit={() => setShowComposer(true)}
              onStop={() => deleteLfg.mutate()}
              onManagePod={() => setShowPodSheet(true)}
            />
            <SuggestionsCarousel
              suggestions={suggestions}
              onSelectSuggestion={handleOpenSuggestion}
            />
          </>
        )}

        {/* ── Player list or empty state ── */}
        {isLoadingNearby ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.accent} />
        ) : allPlayers.length > 0 ? (
          <View style={styles.list}>
            {allPlayers.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                onPress={() => handleOpenPreview(player)}
              />
            ))}
          </View>
        ) : activeStore ? (
          <EmptyStoreState
            storeName={activeStore.name}
            isOpenToPlay={!!myLfgSession}
            onGoOpen={() => setShowComposer(true)}
            onNotifyMe={handleNotifyMe}
            isSubscribed={notifySubscribed}
            isSubscribing={notifyWhenActive.isPending}
          />
        ) : (
          <Text style={styles.emptyBlurb}>
            Players who are nearby or checked into the same store as you will appear here.
          </Text>
        )}

        {/* Store-specific: pods + LFG feed + crossed paths */}
        {activeStore && (
          <>
            <PodsSection
              pods={podFeed}
              isCheckedIn={!!activeStore}
              onStartPod={() => setShowPodComposer(true)}
              onOpenPod={handleOpenPod}
            />
            <LFGSection items={lfgFeed} sentInvites={sentInvites} onJoin={handleLfgJoin} />
            {crossedPathsCount > 0 && (
              <Pressable
                style={({ pressed }) => [styles.nudge, pressed && { opacity: 0.8 }]}
                onPress={() => navigation.navigate('History')}
              >
                <Ionicons name="footsteps-outline" size={14} color={identityTheme.accent} />
                <Text style={[styles.nudgeText, { color: identityTheme.accent }]}>
                  {`You've crossed paths with ${crossedPathsCount} player${crossedPathsCount !== 1 ? 's' : ''} you haven't connected with`}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={identityTheme.accent} />
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <StorePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={setActiveStore}
      />

      <LFGComposer
        visible={showComposer}
        initial={myLfgSession ?? null}
        onClose={() => setShowComposer(false)}
        onSubmit={handleComposerSubmit}
        isSubmitting={createLfg.isPending || updateLfg.isPending}
      />

      <PodSheet
        visible={showPodSheet}
        mySession={myLfgSession}
        feed={lfgFeed}
        onClose={() => setShowPodSheet(false)}
        onLock={handleLfgLock}
        isLocking={lockLfg.isPending}
      />

      <PodCreateSheet
        visible={showPodComposer}
        onClose={() => setShowPodComposer(false)}
        onSubmit={handlePodComposerSubmit}
        isSubmitting={createPod.isPending}
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
    flexDirection: 'column',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  headerSubrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  backBtn: {
    marginLeft: -4,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.textPrimary,
  },
  storeInfoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  storeGlowDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: '#4ade80',
    flexShrink: 0,
  },
  storeName: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  storeHint: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  closestLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invisibleBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invisibleBtnActive: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },
  invisibleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  invisibleBannerText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
  invisibleBannerCta: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
    textDecorationLine: 'underline',
  },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  storeBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxxl },
  storeSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: 4,
  },
  storeSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  storeSectionName: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  storeSectionDist: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginLeft: 23,
  },
  leaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  leaveBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  storeSectionEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: spacing.sm,
  },
  storeSectionEmptyText: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
    color: colors.textTertiary,
  },
  list: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    gap: 9,
    marginBottom: spacing.sm,
  },
  emptyBlurb: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 21,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  nudgeText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
    lineHeight: 18,
  },
});

const emptyState = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
  },
  ctaText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    color: colors.textInverse,
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pingText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});

const banner = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  text: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accentInk,
  },
});

const row = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16.5,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
  },
  metBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  metText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10.5,
    color: colors.accentInk,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  sub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12.5,
    color: colors.textTertiary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    backgroundColor: colors.borderLight,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});

const picker = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  storeName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  storeCity: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  empty: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});

const sugg = StyleSheet.create({
  wrap: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  headerText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  scroll: { paddingHorizontal: spacing.xl, gap: spacing.md },
  card: {
    width: 130,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
    ...shadows.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  reason: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 15,
  },
});

// ---------------------------------------------------------------------------
// LFG styles
// ---------------------------------------------------------------------------

const lfgBar = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16.5,
    color: colors.textInverse,
    letterSpacing: -0.16,
  },
  ctaSubtitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.accent + '60',
    ...shadows.sm,
  },
  activeLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 15.5,
    color: colors.textPrimary,
    letterSpacing: -0.16,
  },
  timerPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  timerText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
    color: colors.accentInk,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.chipFg,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  stopBtn: { borderColor: colors.error + '40' },
});

const lfgSection = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  headerCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  headerCountText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
    color: colors.accentInk,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    ...shadows.sm,
  },
  avatar: {
    width: 38,
    height: 38,
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
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: -0.32,
  },
  metBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  metText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.accentInk,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.chipFg,
  },
  timer: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
    color: colors.accentInk,
  },
  note: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  joinBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    flexShrink: 0,
  },
  joinBtnSent: { backgroundColor: colors.accentLight },
  joinText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textInverse,
  },
  joinTextSent: { color: colors.accentInk },
});

const composer = StyleSheet.create({
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
  submitBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minWidth: 72,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11.5,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
  },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.accent },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
  },
  stepVal: {
    width: 40,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  segRow: { flexDirection: 'row', gap: spacing.sm },
  seg: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  segActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  segText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  segTextActive: { color: colors.accent, fontFamily: typography.fontFamily.semiBold },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});

const podsSection = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCount: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    backgroundColor: colors.accentLight,
  },
  startBtnDisabled: {
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  startBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
  startBtnTextDisabled: {
    color: colors.textTertiary,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  list: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent + '30',
    ...shadows.sm,
  },
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
    width: 38,
    height: 38,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
  },
  hostName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.chipFg,
  },
  where: {
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

const podCreate = StyleSheet.create({
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
  submitBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minWidth: 72,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.accent + '50' },
  submitText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: { color: colors.error },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.accent },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
  },
  stepVal: {
    width: 40,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  segRow: { flexDirection: 'row', gap: spacing.sm },
  seg: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  segActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  segText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  segTextActive: { color: colors.accent, fontFamily: typography.fontFamily.semiBold },
  whereInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  charCount: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: -spacing.sm,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});

const pod = StyleSheet.create({
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
  lockBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minWidth: 72,
    alignItems: 'center',
  },
  lockBtnDisabled: { backgroundColor: colors.success + '50' },
  lockText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textInverse,
  },
  sessionInfo: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  sessionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionChips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.chipBg,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.chipFg,
  },
  timerText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowSelected: { backgroundColor: colors.success + '12' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  chips: { flexDirection: 'row', gap: spacing.xs },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
});
