import {
  ActivityIndicator,
  Dimensions,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type {
  ManaColor as SharedManaColor,
  MtgFormat,
  NearbyPlayer,
  PlayerVibe,
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
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabParamList, RootStackParamList } from '../navigation/types';
import { useNearby, useSuggestions, useStores, useStoreEvents, type DiscoveryFilters } from '../hooks/useNearby';
import { usePresence } from '../hooks/usePresence';
import { useCrossedPathsCount } from '../hooks/useEncounters';
import { useConnections } from '../hooks/useConnections';
import { usePendingGames } from '../hooks/useGames';
import { useActiveStore } from '../context/ActiveStoreContext';
import { usePrivacy, useProfile, useUpdatePrivacy } from '../hooks/useMe';
import { BellButton } from '../navigation/TabNavigator';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { useIdentityTheme, type IdentityTheme } from '../hooks/useIdentityTheme';

type DiscoverScreenProps = {
  navigation: CompositeNavigationProp<
    NativeStackNavigationProp<RootStackParamList, 'Discover'>,
    BottomTabNavigationProp<TabParamList>
  >;
} & Pick<NativeStackScreenProps<RootStackParamList, 'Discover'>, 'route'>;

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------

const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const OUTER_RADIUS = 110;
const INNER_RADIUS = 60;
const NODE_RADIUS = 18;

function avatarInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function playerPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const r = i % 2 === 0 ? OUTER_RADIUS : INNER_RADIUS;
    return {
      x: RADAR_CENTER + r * Math.cos(angle),
      y: RADAR_CENTER + r * Math.sin(angle),
    };
  });
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

interface RadarProps {
  players: NearbyPlayer[];
  onSelectPlayer: (p: NearbyPlayer) => void;
  selectedId: string | null;
  theme: IdentityTheme;
}

function Radar({ players, onSelectPlayer, selectedId, theme }: RadarProps) {
  const { accent, gradient, onAccent, soft } = theme;
  const positions = playerPositions(players.length);
  const ringStroke = accent + '50';

  return (
    <View style={radar.wrap}>
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={accent} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={colors.paper} stopOpacity={0} />
          </RadialGradient>
          <SvgLinearGradient id="centerGrad" x1="0" y1="0" x2="1" y2="1">
            {gradient.map((c, i) => (
              <Stop key={i} offset={`${i / Math.max(1, gradient.length - 1)}`} stopColor={c} />
            ))}
          </SvgLinearGradient>
        </Defs>

        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={OUTER_RADIUS + NODE_RADIUS} fill="url(#bg)" />

        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={OUTER_RADIUS}
          stroke={ringStroke} strokeWidth={1} strokeDasharray="4 4" fill="none" />
        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={INNER_RADIUS}
          stroke={ringStroke} strokeWidth={1} strokeDasharray="4 4" fill="none" />

        {positions.map((pos, i) => (
          <Line key={`spoke-${i}`}
            x1={RADAR_CENTER} y1={RADAR_CENTER} x2={pos.x} y2={pos.y}
            stroke={ringStroke} strokeWidth={1} />
        ))}

        {players.map((player, i) => {
          const pos = positions[i];
          const isSelected = player.id === selectedId;
          const fill = nodeColor(player);
          const textFill = ['W', 'G'].includes(player.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
          return (
            <G key={player.id} onPress={() => onSelectPlayer(player)}>
              {isSelected && (
                <Circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 4}
                  fill={soft} stroke={accent} strokeWidth={1.5} />
              )}
              <Circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={fill} />
              <SvgText x={pos.x} y={pos.y + 5} textAnchor="middle"
                fill={textFill} fontSize={13} fontFamily={typography.fontFamily.bold}>
                {avatarInitial(player.displayName)}
              </SvgText>
              {player.metBefore && (
                <Circle cx={pos.x + NODE_RADIUS - 4} cy={pos.y - NODE_RADIUS + 4}
                  r={5} fill={colors.success} />
              )}
            </G>
          );
        })}

        {/* Identity-gradient center node with glow */}
        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={30} fill={accent} opacity={0.18} />
        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={22} fill="url(#centerGrad)" />
        <SvgText x={RADAR_CENTER} y={RADAR_CENTER + 5} textAnchor="middle"
          fill={onAccent} fontSize={11} fontFamily={typography.fontFamily.semiBold}>
          You
        </SvgText>
      </Svg>
    </View>
  );
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={picker.safe}>
        <View style={picker.header}>
          <Text style={picker.title}>Select your store</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={picker.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} style={picker.searchIcon} />
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
                  onSelect({ ...item, address: null, zip: null, discordUrl: null, lat: null, lng: null });
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
// Location banner — gradient strip showing store + player count
// ---------------------------------------------------------------------------

const LOC_BANNER_H = 68;

interface LocationBannerProps {
  storeName: string;
  playerCount: number;
  theme: IdentityTheme;
}

function LocationBanner({ storeName, playerCount, theme }: LocationBannerProps) {
  const { gradient, onAccent } = theme;
  const [bannerW, setBannerW] = useState(
    () => Dimensions.get('window').width,
  );

  return (
    <View
      style={locBanner.root}
      onLayout={(e) => setBannerW(e.nativeEvent.layout.width)}
    >
      <Svg style={StyleSheet.absoluteFill} width={bannerW} height={LOC_BANNER_H}>
        <Defs>
          <SvgLinearGradient id="locGrad" x1="0" y1="0" x2="1" y2="1">
            {gradient.map((c, i) => (
              <Stop
                key={i}
                offset={`${i / Math.max(1, gradient.length - 1)}`}
                stopColor={c}
              />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width={bannerW} height={LOC_BANNER_H} fill="url(#locGrad)" />
      </Svg>
      <View style={locBanner.content}>
        <Ionicons name="storefront-outline" size={18} color={onAccent} />
        <View style={{ flex: 1 }}>
          <Text style={[locBanner.name, { color: onAccent }]} numberOfLines={1}>
            {storeName}
          </Text>
          <Text style={[locBanner.count, { color: onAccent + 'CC' }]}>
            {playerCount === 0
              ? 'No players nearby'
              : `${playerCount} player${playerCount !== 1 ? 's' : ''} nearby`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const locBanner = StyleSheet.create({
  root: {
    height: LOC_BANNER_H,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
  },
  count: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
  },
});

// ---------------------------------------------------------------------------
// Player row
// ---------------------------------------------------------------------------

const FORMAT_LABELS: Partial<Record<MtgFormat, string>> = {
  standard: 'Std', pioneer: 'Pio', modern: 'Mod',
  legacy: 'Leg', vintage: 'Vnt', commander: 'EDH', draft: 'Draft',
};

const FORMAT_FULL_LABELS: Partial<Record<MtgFormat, string>> = {
  standard: 'Standard', pioneer: 'Pioneer', modern: 'Modern',
  legacy: 'Legacy', vintage: 'Vintage', commander: 'Commander', draft: 'Draft',
};

const ALL_FORMATS: MtgFormat[] = ['commander', 'modern', 'standard', 'pioneer', 'legacy', 'vintage', 'draft'];
const ALL_COLORS: SharedManaColor[] = ['W', 'U', 'B', 'R', 'G'];
const ALL_VIBES: PlayerVibe[] = ['casual', 'competitive', 'spike', 'timmy', 'johnny', 'vorthos'];

const VIBE_LABELS: Partial<Record<PlayerVibe, string>> = {
  competitive: 'Competitive', casual: 'Casual', spike: 'Spike',
  timmy: 'Timmy', johnny: 'Johnny', vorthos: 'Vorthos',
};

interface PlayerRowProps {
  player: NearbyPlayer;
  onPress: () => void;
  isSelected: boolean;
}

function PlayerRow({ player, onPress, isSelected }: PlayerRowProps) {
  const fill = nodeColor(player);
  const textFill = ['W', 'G'].includes(player.avatarColors[0]) ? colors.textPrimary : colors.textInverse;

  return (
    <Pressable
      style={({ pressed }) => [row.root, isSelected && row.selected, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={[row.avatar, { backgroundColor: fill }]}>
        <Text style={[row.avatarText, { color: textFill }]}>{avatarInitial(player.displayName)}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={row.nameRow}>
          <Text style={row.name} numberOfLines={1}>{player.displayName}</Text>
          {player.metBefore && (
            <View style={row.metBadge}><Text style={row.metText}>Met</Text></View>
          )}
        </View>
        {player.commander ? (
          <Text style={row.sub} numberOfLines={1}>
            {player.commander}
          </Text>
        ) : null}
        {player.formats.length > 0 && (
          <View style={row.chips}>
            {(player.formats as MtgFormat[]).slice(0, 3).map((f) => (
              <View key={f} style={row.chip}>
                <Text style={row.chipText}>{FORMAT_LABELS[f] ?? f}</Text>
              </View>
            ))}
          </View>
        )}
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
  const fill = suggestion.avatarColors.length > 0
    ? (MANA_FILL[suggestion.avatarColors[0] as SharedManaColor] ?? colors.border)
    : colors.border;
  const textFill = ['W', 'G'].includes(suggestion.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
  const topReasons = suggestion.reasons.slice(0, 2);

  return (
    <Pressable
      style={({ pressed }) => [sugg.card, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <View style={[sugg.avatar, { backgroundColor: fill }]}>
        <Text style={[sugg.avatarText, { color: textFill }]}>
          {avatarInitial(suggestion.displayName)}
        </Text>
      </View>
      <Text style={sugg.name} numberOfLines={1}>{suggestion.displayName}</Text>
      {topReasons.map((r, i) => (
        <Text key={i} style={sugg.reason} numberOfLines={1}>{r.label}</Text>
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
// Advanced filter panel
// ---------------------------------------------------------------------------

interface AdvancedFiltersProps {
  filterFormat: MtgFormat | undefined;
  onFormatToggle: (f: MtgFormat) => void;
  filterColors: SharedManaColor[];
  onColorToggle: (c: SharedManaColor) => void;
  displayPowerMin: number;
  displayPowerMax: number;
  onPowerMinChange: (v: number) => void;
  onPowerMaxChange: (v: number) => void;
  filterVibe: PlayerVibe | undefined;
  onVibeToggle: (v: PlayerVibe) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

function AdvancedFilters({
  filterFormat, onFormatToggle,
  filterColors, onColorToggle,
  displayPowerMin, displayPowerMax,
  onPowerMinChange, onPowerMaxChange,
  filterVibe, onVibeToggle,
  onClear, hasActiveFilters,
}: AdvancedFiltersProps) {
  return (
    <View style={filt.wrap}>
      {/* Format chips */}
      <Text style={filt.sectionLabel}>Format</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filt.chipScroll}>
        {ALL_FORMATS.map((f) => {
          const active = filterFormat === f;
          return (
            <Pressable
              key={f}
              style={[filt.chip, active && filt.chipActive]}
              onPress={() => onFormatToggle(f)}
            >
              <Text style={[filt.chipText, active && filt.chipTextActive]}>
                {FORMAT_FULL_LABELS[f] ?? f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Mana color pips */}
      <Text style={filt.sectionLabel}>Colors</Text>
      <View style={filt.colorRow}>
        {ALL_COLORS.map((c) => {
          const active = filterColors.includes(c);
          return (
            <Pressable
              key={c}
              style={[
                filt.colorPip,
                { backgroundColor: MANA_FILL[c] },
                active && filt.colorPipActive,
              ]}
              onPress={() => onColorToggle(c)}
            >
              <Text style={[
                filt.colorText,
                { color: c === 'W' ? colors.textPrimary : colors.textInverse },
                !active && { opacity: 0.45 },
              ]}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Power range */}
      <Text style={filt.sectionLabel}>Power range</Text>
      <View style={filt.powerRow}>
        <View style={filt.powerGroup}>
          <Text style={filt.powerLabel}>Min</Text>
          <View style={filt.stepper}>
            <Pressable
              style={filt.stepBtn}
              onPress={() => onPowerMinChange(Math.max(1, displayPowerMin - 1))}
              hitSlop={6}
            >
              <Ionicons name="remove" size={14} color={colors.textSecondary} />
            </Pressable>
            <Text style={filt.stepVal}>{displayPowerMin}</Text>
            <Pressable
              style={filt.stepBtn}
              onPress={() => onPowerMinChange(Math.min(displayPowerMax, displayPowerMin + 1))}
              hitSlop={6}
            >
              <Ionicons name="add" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
        <Text style={filt.powerSep}>–</Text>
        <View style={filt.powerGroup}>
          <Text style={filt.powerLabel}>Max</Text>
          <View style={filt.stepper}>
            <Pressable
              style={filt.stepBtn}
              onPress={() => onPowerMaxChange(Math.max(displayPowerMin, displayPowerMax - 1))}
              hitSlop={6}
            >
              <Ionicons name="remove" size={14} color={colors.textSecondary} />
            </Pressable>
            <Text style={filt.stepVal}>{displayPowerMax}</Text>
            <Pressable
              style={filt.stepBtn}
              onPress={() => onPowerMaxChange(Math.min(10, displayPowerMax + 1))}
              hitSlop={6}
            >
              <Ionicons name="add" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Vibe chips */}
      <Text style={filt.sectionLabel}>Vibe</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={filt.chipScroll}>
        {ALL_VIBES.map((v) => {
          const active = filterVibe === v;
          return (
            <Pressable
              key={v}
              style={[filt.chip, active && filt.chipActive]}
              onPress={() => onVibeToggle(v)}
            >
              <Text style={[filt.chipText, active && filt.chipTextActive]}>
                {VIBE_LABELS[v] ?? v}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Clear */}
      {hasActiveFilters && (
        <Pressable style={filt.clearBtn} onPress={onClear}>
          <Text style={filt.clearText}>Clear all filters</Text>
        </Pressable>
      )}
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

function LFGStatusBar({ session, isLoading, isCheckedIn, onOpen, onEdit, onStop, onManagePod }: LFGStatusBarProps) {
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
        style={({ pressed }) => [lfgBar.cta, !isCheckedIn && lfgBar.ctaDisabled, pressed && { opacity: 0.75 }]}
        onPress={isCheckedIn ? onOpen : undefined}
        accessibilityLabel="Open to play now"
      >
        <View style={lfgBar.dot} />
        <Text style={lfgBar.ctaText}>Open to play now</Text>
        {!isCheckedIn && (
          <Text style={lfgBar.ctaHint}>Check in to a store first</Text>
        )}
      </Pressable>
    );
  }

  const minsLeft = lfgMinutesLeft(session.expiresAt);

  return (
    <View style={lfgBar.active}>
      <View style={lfgBar.activeDot} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={lfgBar.activeLabel}>You're open to play</Text>
        <View style={lfgBar.chips}>
          {session.format && (
            <View style={lfgBar.chip}>
              <Text style={lfgBar.chipText}>{FORMAT_LABELS[session.format as MtgFormat] ?? session.format}</Text>
            </View>
          )}
          <View style={lfgBar.chip}>
            <Text style={lfgBar.chipText}>P{session.power}</Text>
          </View>
          <View style={lfgBar.chip}>
            <Text style={lfgBar.chipText}>{session.seats} seat{session.seats !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={lfgBar.timer}>{minsLeft}m left</Text>
        </View>
      </View>
      <View style={lfgBar.actions}>
        <Pressable style={({ pressed }) => [lfgBar.actionBtn, pressed && { opacity: 0.6 }]} onPress={onManagePod}>
          <Ionicons name="people-outline" size={15} color={colors.success} />
        </Pressable>
        <Pressable style={({ pressed }) => [lfgBar.actionBtn, pressed && { opacity: 0.6 }]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={({ pressed }) => [lfgBar.actionBtn, lfgBar.stopBtn, pressed && { opacity: 0.6 }]} onPress={onStop}>
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
  const fill = item.avatarColors.length > 0
    ? (MANA_FILL[item.avatarColors[0] as SharedManaColor] ?? colors.border)
    : colors.border;
  const textFill = ['W', 'G'].includes(item.avatarColors[0]) ? colors.textPrimary : colors.textInverse;

  return (
    <View style={lfgSection.row}>
      <View style={[lfgSection.avatar, { backgroundColor: fill }]}>
        <Text style={[lfgSection.avatarText, { color: textFill }]}>{avatarInitial(item.displayName)}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={lfgSection.name} numberOfLines={1}>{item.displayName}</Text>
          {item.metBefore && <View style={lfgSection.metBadge}><Text style={lfgSection.metText}>Met</Text></View>}
        </View>
        <View style={lfgSection.chips}>
          {item.session.format && (
            <View style={lfgSection.chip}><Text style={lfgSection.chipText}>{FORMAT_LABELS[item.session.format as MtgFormat] ?? item.session.format}</Text></View>
          )}
          <View style={lfgSection.chip}><Text style={lfgSection.chipText}>P{item.session.power}</Text></View>
          <View style={lfgSection.chip}><Text style={lfgSection.chipText}>{item.session.seats} seat{item.session.seats !== 1 ? 's' : ''}</Text></View>
          <Text style={lfgSection.timer}>{item.minutesLeft}m</Text>
        </View>
        {item.session.note ? (
          <Text style={lfgSection.note} numberOfLines={1}>{item.session.note}</Text>
        ) : null}
      </View>
      <Pressable
        style={({ pressed }) => [lfgSection.joinBtn, joined && lfgSection.joinBtnSent, pressed && { opacity: 0.7 }]}
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
        <View style={lfgSection.headerDot} />
        <Text style={lfgSection.headerText}>Open to play</Text>
        <Text style={lfgSection.headerCount}>{items.length}</Text>
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
          {pods.length > 0 && (
            <Text style={podsSection.headerCount}>{pods.length}</Text>
          )}
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
          <Ionicons name="add" size={13} color={isCheckedIn ? colors.accent : colors.textTertiary} />
          <Text style={[podsSection.startBtnText, !isCheckedIn && podsSection.startBtnTextDisabled]}>
            Start a pod
          </Text>
        </Pressable>
      </View>

      {pods.length === 0 ? (
        <Text style={podsSection.empty}>No pods forming at this store yet</Text>
      ) : (
        <View style={podsSection.list}>
          {pods.map((pod) => {
            const fill = pod.host.avatarColors.length > 0
              ? (MANA_FILL[pod.host.avatarColors[0] as SharedManaColor] ?? colors.border)
              : colors.border;
            const textFill = ['W', 'G'].includes(pod.host.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
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
                        <Text style={podsSection.chipText}>{FORMAT_LABELS[pod.format as MtgFormat] ?? pod.format}</Text>
                      </View>
                    )}
                    <View style={podsSection.chip}>
                      <Text style={podsSection.chipText}>P{pod.targetPower}±{pod.tolerance}</Text>
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

const ALL_POD_FORMATS: MtgFormat[] = ['commander', 'modern', 'standard', 'pioneer', 'legacy', 'vintage', 'draft'];
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
            {isSubmitting
              ? <ActivityIndicator size="small" color={colors.textInverse} />
              : <Text style={podCreate.submitText}>Create</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={podCreate.scroll} keyboardShouldPersistTaps="handled">
          <Text style={podCreate.sectionLabel}>Format (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={podCreate.chipRow}>
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
            <Pressable style={podCreate.stepBtn} onPress={() => setTargetPower((p) => Math.max(1, p - 1))} hitSlop={6}>
              <Ionicons name="remove" size={16} color={colors.textSecondary} />
            </Pressable>
            <Text style={podCreate.stepVal}>{targetPower}</Text>
            <Pressable style={podCreate.stepBtn} onPress={() => setTargetPower((p) => Math.min(10, p + 1))} hitSlop={6}>
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
                <Text style={[podCreate.segText, tolerance === t && podCreate.segTextActive]}>±{t}</Text>
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

          <Text style={podCreate.sectionLabel}>Where to meet <Text style={podCreate.required}>*</Text></Text>
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// LFGComposer (create / edit sheet)
// ---------------------------------------------------------------------------

const ALL_LFG_FORMATS: MtgFormat[] = ['commander', 'modern', 'standard', 'pioneer', 'legacy', 'vintage', 'draft'];
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
    onSubmit({ format: format ?? null, power, seats, durationMins: duration, note: note.trim() || null });
  }, [format, power, seats, duration, note, onSubmit]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={composer.safe}>
        <View style={composer.header}>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={colors.textSecondary} /></Pressable>
          <Text style={composer.title}>{initial ? 'Edit session' : "I'm open to play"}</Text>
          <Pressable
            style={({ pressed }) => [composer.submitBtn, isSubmitting && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color={colors.textInverse} />
              : <Text style={composer.submitText}>{initial ? 'Save' : 'Go open'}</Text>
            }
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={composer.scroll} keyboardShouldPersistTaps="handled">
          <Text style={composer.sectionLabel}>Format (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={composer.chipRow}>
            {ALL_LFG_FORMATS.map((f) => {
              const active = format === f;
              return (
                <Pressable key={f} style={[composer.chip, active && composer.chipActive]} onPress={() => setFormat(format === f ? null : f)}>
                  <Text style={[composer.chipText, active && composer.chipTextActive]}>{FORMAT_FULL_LABELS[f] ?? f}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={composer.sectionLabel}>Power level</Text>
          <View style={composer.stepper}>
            <Pressable style={composer.stepBtn} onPress={() => setPower((p) => Math.max(1, p - 1))} hitSlop={6}>
              <Ionicons name="remove" size={16} color={colors.textSecondary} />
            </Pressable>
            <Text style={composer.stepVal}>{power}</Text>
            <Pressable style={composer.stepBtn} onPress={() => setPower((p) => Math.min(10, p + 1))} hitSlop={6}>
              <Ionicons name="add" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={composer.sectionLabel}>Seats needed</Text>
          <View style={composer.segRow}>
            {([1, 2, 3] as const).map((s) => (
              <Pressable key={s} style={[composer.seg, seats === s && composer.segActive]} onPress={() => setSeats(s)}>
                <Text style={[composer.segText, seats === s && composer.segTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={composer.sectionLabel}>Open for</Text>
          <View style={composer.segRow}>
            {DURATIONS.map((d) => (
              <Pressable key={d} style={[composer.seg, duration === d && composer.segActive]} onPress={() => setDuration(d)}>
                <Text style={[composer.segText, duration === d && composer.segTextActive]}>{DURATION_LABELS[d]}</Text>
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
        </ScrollView>
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

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < (mySession?.seats ?? 3)) next.add(id);
      return next;
    });
  }, [mySession?.seats]);

  if (!mySession) return null;

  const minsLeft = lfgMinutesLeft(mySession.expiresAt);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={pod.safe}>
        <View style={pod.header}>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={24} color={colors.textSecondary} /></Pressable>
          <Text style={pod.title}>Lock your pod</Text>
          <Pressable
            style={({ pressed }) => [pod.lockBtn, selected.size === 0 && pod.lockBtnDisabled, pressed && { opacity: 0.75 }]}
            onPress={() => onLock([...selected])}
            disabled={isLocking || selected.size === 0}
          >
            {isLocking
              ? <ActivityIndicator size="small" color={colors.textInverse} />
              : <Text style={pod.lockText}>Lock ({selected.size})</Text>
            }
          </Pressable>
        </View>

        <View style={pod.sessionInfo}>
          <Text style={pod.sessionLabel}>Your session</Text>
          <View style={pod.sessionChips}>
            {mySession.format && <View style={pod.chip}><Text style={pod.chipText}>{FORMAT_LABELS[mySession.format as MtgFormat] ?? mySession.format}</Text></View>}
            <View style={pod.chip}><Text style={pod.chipText}>P{mySession.power}</Text></View>
            <View style={pod.chip}><Text style={pod.chipText}>{mySession.seats} seat{mySession.seats !== 1 ? 's' : ''}</Text></View>
            <Text style={pod.timerText}>{minsLeft}m left</Text>
          </View>
          <Text style={pod.hint}>Select up to {mySession.seats} player{mySession.seats !== 1 ? 's' : ''} to seat</Text>
        </View>

        {feed.length === 0 ? (
          <Text style={pod.empty}>No other open players at your store right now</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
            {feed.map((item) => {
              const isSelected = selected.has(item.id);
              const fill = item.avatarColors.length > 0
                ? (MANA_FILL[item.avatarColors[0] as SharedManaColor] ?? colors.border)
                : colors.border;
              const textFill = ['W', 'G'].includes(item.avatarColors[0]) ? colors.textPrimary : colors.textInverse;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [pod.row, isSelected && pod.rowSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => toggleSelect(item.id)}
                >
                  <View style={[pod.avatar, { backgroundColor: fill }]}>
                    <Text style={[pod.avatarText, { color: textFill }]}>{avatarInitial(item.displayName)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={pod.name} numberOfLines={1}>{item.displayName}</Text>
                    <View style={pod.chips}>
                      {item.session.format && <View style={pod.chip}><Text style={pod.chipText}>{FORMAT_LABELS[item.session.format as MtgFormat] ?? item.session.format}</Text></View>}
                      <View style={pod.chip}><Text style={pod.chipText}>P{item.session.power}</Text></View>
                    </View>
                  </View>
                  <View style={[pod.checkbox, isSelected && pod.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
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
// FeatureCards — 2×2 hub grid always shown at top of Discover
// ---------------------------------------------------------------------------

interface FeatureCardsProps {
  accent: string;
  connectionsCount: number;
  pendingRequestsCount: number;
  pendingGamesCount: number;
  todayEventsCount: number;
  activeStoreName: string | null;
  onOpenConnections: () => void;
  onOpenStores: () => void;
  onOpenGames: () => void;
}

function FeatureCards({
  accent,
  connectionsCount,
  pendingRequestsCount,
  pendingGamesCount,
  todayEventsCount,
  activeStoreName,
  onOpenConnections,
  onOpenStores,
  onOpenGames,
}: FeatureCardsProps) {
  return (
    <View style={fcStyles.grid}>
      {/* Friends */}
      <Pressable
        style={({ pressed }) => [fcStyles.card, pressed && { opacity: 0.85 }]}
        onPress={onOpenConnections}
      >
        <View style={[fcStyles.iconWrap, { backgroundColor: accent + '18' }]}>
          <Ionicons name="people-outline" size={20} color={accent} />
        </View>
        <Text style={fcStyles.title}>Friends</Text>
        <Text style={fcStyles.sub} numberOfLines={1}>
          {connectionsCount > 0 ? `${connectionsCount} connected` : 'No connections yet'}
        </Text>
        {pendingRequestsCount > 0 && (
          <View style={[fcStyles.badge, { backgroundColor: accent }]}>
            <Text style={fcStyles.badgeText}>{pendingRequestsCount} new</Text>
          </View>
        )}
        <Text style={[fcStyles.cta, { color: accent }]}>View all →</Text>
      </Pressable>

      {/* Stores */}
      <Pressable
        style={({ pressed }) => [fcStyles.card, pressed && { opacity: 0.85 }]}
        onPress={onOpenStores}
      >
        <View style={[fcStyles.iconWrap, { backgroundColor: accent + '18' }]}>
          <Ionicons name="map-outline" size={20} color={accent} />
        </View>
        <Text style={fcStyles.title}>Stores</Text>
        <Text style={fcStyles.sub} numberOfLines={1}>
          {activeStoreName ?? 'Find one near you'}
        </Text>
        <Text style={[fcStyles.cta, { color: accent }]}>See map →</Text>
      </Pressable>

      {/* Events */}
      <Pressable
        style={({ pressed }) => [fcStyles.card, pressed && { opacity: 0.85 }]}
        onPress={onOpenStores}
      >
        <View style={[fcStyles.iconWrap, { backgroundColor: accent + '18' }]}>
          <Ionicons name="calendar-outline" size={20} color={accent} />
        </View>
        <Text style={fcStyles.title}>Events</Text>
        <Text style={fcStyles.sub}>
          {todayEventsCount > 0
            ? `${todayEventsCount} today`
            : activeStoreName
            ? 'None today'
            : 'Select a store'}
        </Text>
        <Text style={[fcStyles.cta, { color: accent }]}>Browse →</Text>
      </Pressable>

      {/* Games */}
      <Pressable
        style={({ pressed }) => [fcStyles.card, pressed && { opacity: 0.85 }]}
        onPress={onOpenGames}
      >
        <View style={[fcStyles.iconWrap, { backgroundColor: accent + '18' }]}>
          <Ionicons name="game-controller-outline" size={20} color={accent} />
        </View>
        <Text style={fcStyles.title}>Games</Text>
        <Text style={fcStyles.sub}>
          {pendingGamesCount > 0 ? `${pendingGamesCount} to confirm` : 'Log a game'}
        </Text>
        {pendingGamesCount > 0 && (
          <View style={[fcStyles.badge, { backgroundColor: colors.warning }]}>
            <Text style={fcStyles.badgeText}>{pendingGamesCount}</Text>
          </View>
        )}
        <Text style={[fcStyles.cta, { color: accent }]}>
          {pendingGamesCount > 0 ? 'Confirm →' : 'Log game →'}
        </Text>
      </Pressable>
    </View>
  );
}

const fcStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginTop: 2,
  },
  badgeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textInverse,
  },
  cta: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
});

// ---------------------------------------------------------------------------
// DiscoverScreen
// ---------------------------------------------------------------------------

export function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { activeStore, setActiveStore } = useActiveStore();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // LFG state
  const [showComposer, setShowComposer] = useState(false);
  const [showPodSheet, setShowPodSheet] = useState(false);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());

  // Pod state
  const [showPodComposer, setShowPodComposer] = useState(false);

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

  // Advanced filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterFormat, setFilterFormat] = useState<MtgFormat | undefined>();
  const [filterColors, setFilterColors] = useState<SharedManaColor[]>([]);
  const [displayPowerMin, setDisplayPowerMin] = useState(1);
  const [displayPowerMax, setDisplayPowerMax] = useState(10);
  const [filterVibe, setFilterVibe] = useState<PlayerVibe | undefined>();

  const filterPowerMin = displayPowerMin > 1 ? displayPowerMin : undefined;
  const filterPowerMax = displayPowerMax < 10 ? displayPowerMax : undefined;
  const hasActiveFilters =
    !!filterFormat || filterColors.length > 0 ||
    filterPowerMin !== undefined || filterPowerMax !== undefined || !!filterVibe;

  const activeFilterCount = [
    filterFormat,
    filterColors.length > 0 ? 'colors' : null,
    filterPowerMin !== undefined || filterPowerMax !== undefined ? 'power' : null,
    filterVibe,
  ].filter(Boolean).length;

  const discoveryFilters: DiscoveryFilters = useMemo(() => {
    const f: DiscoveryFilters = {};
    if (filterFormat) f.format = filterFormat;
    if (filterColors.length > 0) f.colors = filterColors;
    if (filterPowerMin !== undefined) f.powerMin = filterPowerMin;
    if (filterPowerMax !== undefined) f.powerMax = filterPowerMax;
    if (filterVibe) f.vibe = filterVibe;
    return f;
  }, [filterFormat, filterColors, filterPowerMin, filterPowerMax, filterVibe]);

  const handleFormatToggle = useCallback((f: MtgFormat) => {
    setFilterFormat((prev) => (prev === f ? undefined : f));
  }, []);

  const handleColorToggle = useCallback((c: SharedManaColor) => {
    setFilterColors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }, []);

  const handleVibeToggle = useCallback((v: PlayerVibe) => {
    setFilterVibe((prev) => (prev === v ? undefined : v));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterFormat(undefined);
    setFilterColors([]);
    setDisplayPowerMin(1);
    setDisplayPowerMax(10);
    setFilterVibe(undefined);
  }, []);

  // Presence heartbeat
  usePresence();

  // Identity theme
  const identityTheme = useIdentityTheme();

  // Onboarding banner
  const { data: profile } = useProfile();
  const showOnboardBanner = profile != null && profile.onboardedAt == null;
  const myUserId = profile?.id ?? '';

  // LFG handlers
  const handleComposerSubmit = useCallback((data: CreateLfg) => {
    if (myLfgSession) {
      updateLfg.mutate(data, { onSuccess: () => setShowComposer(false) });
    } else {
      createLfg.mutate(data, { onSuccess: () => setShowComposer(false) });
    }
  }, [myLfgSession, createLfg, updateLfg]);

  const handleLfgJoin = useCallback((item: LfgFeedItem) => {
    setSentInvites((prev) => new Set(prev).add(item.id));
    inviteLfg.mutate(item.id);
  }, [inviteLfg]);

  const handleLfgLock = useCallback((memberIds: string[]) => {
    lockLfg.mutate(
      { hostUserId: myUserId, memberIds },
      { onSuccess: () => setShowPodSheet(false) },
    );
  }, [lockLfg, myUserId]);

  // Pod handlers
  const handlePodComposerSubmit = useCallback((data: CreatePod) => {
    createPod.mutate(data, { onSuccess: () => setShowPodComposer(false) });
  }, [createPod]);

  const handleOpenPod = useCallback((pod: PodFeedItem) => {
    navigation.navigate('Pod', { podId: pod.id });
  }, [navigation]);

  // Go invisible toggle
  const { data: privacy } = usePrivacy();
  const { mutate: updatePrivacy } = useUpdatePrivacy();
  const isInvisible = privacy?.discoverable === false;
  const handleToggleInvisible = useCallback(() => {
    updatePrivacy({ discoverable: isInvisible });
  }, [isInvisible, updatePrivacy]);

  // Nearby players (filtered)
  const { data: nearby, isLoading: isLoadingNearby } = useNearby(!!activeStore, discoveryFilters);

  // Matchmaking suggestions (unfiltered — separate ranking)
  const { data: suggestionsData } = useSuggestions(!!activeStore);

  // Crossed-paths nudge
  const crossedPathsCount = useCrossedPathsCount();

  // Connections — used to count who among nearby players is already connected
  const { data: connectionsData } = useConnections();
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of connectionsData?.accepted ?? []) ids.add(c.peer.id);
    return ids;
  }, [connectionsData]);

  // Feature card data
  const { data: pendingGames = [] } = usePendingGames();
  const { data: eventDays = [] } = useStoreEvents(activeStore?.id ?? null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEventsCount = eventDays.find((d) => d.date === todayStr)?.events.length ?? 0;
  const acceptedCount = connectionsData?.accepted.length ?? 0;
  const pendingRequestsCount = connectionsData?.incoming.length ?? 0;

  const allPlayers = nearby?.players ?? [];
  const displayedPlayers = allPlayers;

  const suggestions = suggestionsData?.suggestions ?? [];

  const handleSelectPlayer = useCallback((player: NearbyPlayer) => {
    setSelectedPlayerId((prev) => (prev === player.id ? null : player.id));
  }, []);

  const handleOpenPreview = useCallback((player: NearbyPlayer) => {
    navigation.navigate('PlayerPreview', {
      profile: player,
      sharedEvent: player.sharedEvent,
      lastMetStoreName: player.lastMetStoreName,
    });
  }, [navigation]);

  const handleOpenSuggestion = useCallback((s: Suggestion) => {
    navigation.navigate('PlayerPreview', {
      profile: s,
      sharedEvent: s.sharedEvent,
      lastMetStoreName: s.lastMetStoreName,
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      {showOnboardBanner && (
        <Pressable style={({ pressed }) => [banner.root, pressed && { opacity: 0.85 }]}>
          <Ionicons name="person-outline" size={16} color={colors.accent} />
          <Text style={banner.text}>Finish your profile to appear in nearby search</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        </Pressable>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.headerSubrow}>
          {activeStore ? (
            <Text style={[styles.storeName, { color: identityTheme.accent }]} numberOfLines={1}>{activeStore.name}</Text>
          ) : (
            <Text style={styles.storeHint}>No store selected</Text>
          )}
          <View style={styles.headerActions}>
            {/* Go invisible toggle */}
            <Pressable
              style={({ pressed }) => [
                styles.invisibleBtn,
                isInvisible && styles.invisibleBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleToggleInvisible}
              accessibilityLabel={isInvisible ? 'Go visible' : 'Go invisible'}
            >
              <Ionicons
                name={isInvisible ? 'eye-off' : 'eye-outline'}
                size={15}
                color={isInvisible ? colors.textInverse : colors.textSecondary}
              />
            </Pressable>
            {activeStore && (
              <Pressable
                style={({ pressed }) => [
                  styles.filterToggleBtn,
                  filtersOpen && { borderColor: identityTheme.accent, backgroundColor: identityTheme.soft },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setFiltersOpen((o) => !o)}
              >
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={filtersOpen ? identityTheme.accent : colors.textSecondary}
                />
                <Text style={[styles.filterToggleText, filtersOpen && { color: identityTheme.accent }]}>
                  Filters
                </Text>
                {activeFilterCount > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: identityTheme.accent }]}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.storeBtn, { borderColor: identityTheme.accent }, pressed && { opacity: 0.6 }]}
              onPress={() => setShowPicker(true)}
            >
              <Ionicons name="storefront-outline" size={16} color={identityTheme.accent} />
              <Text style={[styles.storeBtnText, { color: identityTheme.accent }]}>{activeStore ? 'Change' : 'Select store'}</Text>
            </Pressable>
            <BellButton />
          </View>
        </View>
      </View>

      {/* Invisible banner */}
      {isInvisible && (
        <Pressable style={styles.invisibleBanner} onPress={handleToggleInvisible}>
          <Ionicons name="eye-off-outline" size={16} color={colors.textInverse} />
          <Text style={styles.invisibleBannerText}>
            You're invisible — nobody here can see you
          </Text>
          <Text style={styles.invisibleBannerCta}>Go visible</Text>
        </Pressable>
      )}

      {/* Advanced filter panel (outside ScrollView — stays fixed) */}
      {filtersOpen && activeStore && (
        <AdvancedFilters
          filterFormat={filterFormat}
          onFormatToggle={handleFormatToggle}
          filterColors={filterColors}
          onColorToggle={handleColorToggle}
          displayPowerMin={displayPowerMin}
          displayPowerMax={displayPowerMax}
          onPowerMinChange={setDisplayPowerMin}
          onPowerMaxChange={setDisplayPowerMax}
          filterVibe={filterVibe}
          onVibeToggle={handleVibeToggle}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Feature card grid — always visible */}
        <FeatureCards
          accent={identityTheme.accent}
          connectionsCount={acceptedCount}
          pendingRequestsCount={pendingRequestsCount}
          pendingGamesCount={pendingGames.length}
          todayEventsCount={todayEventsCount}
          activeStoreName={activeStore?.name ?? null}
          onOpenConnections={() => navigation.navigate('Connections')}
          onOpenStores={() => navigation.navigate('StoresMap')}
          onOpenGames={() => navigation.navigate('Connections')}
        />

        {/* Empty state — shown below cards when no store selected */}
        {!activeStore && (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={40} color={colors.border} />
            <Text style={styles.emptyTitle}>Select your store to see nearby players</Text>
            <Pressable
              style={({ pressed }) => [styles.selectBtn, { backgroundColor: identityTheme.accent }, pressed && { opacity: 0.8 }]}
              onPress={() => setShowPicker(true)}
            >
              <Text style={[styles.selectBtnText, { color: identityTheme.onAccent }]}>Choose a store</Text>
            </Pressable>
          </View>
        )}

        {activeStore && (
          <>
            {/* Identity gradient location banner */}
            <LocationBanner
              storeName={activeStore.name}
              playerCount={displayedPlayers.length}
              theme={identityTheme}
            />

            {/* LFG status bar */}
            <LFGStatusBar
              session={myLfgSession}
              isLoading={false}
              isCheckedIn={!!activeStore}
              onOpen={() => setShowComposer(true)}
              onEdit={() => setShowComposer(true)}
              onStop={() => deleteLfg.mutate()}
              onManagePod={() => setShowPodSheet(true)}
            />

            {/* Suggestions carousel — sits above the radar */}
            <SuggestionsCarousel
              suggestions={suggestions}
              onSelectSuggestion={handleOpenSuggestion}
            />

            {/* Radar */}
            {isLoadingNearby ? (
              <View style={styles.radarPlaceholder}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <Radar
                players={displayedPlayers}
                onSelectPlayer={handleSelectPlayer}
                selectedId={selectedPlayerId}
                theme={identityTheme}
              />
            )}

            {/* Count row */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {(() => {
                  if (displayedPlayers.length === 0) {
                    return hasActiveFilters ? 'No players match your filters' : 'No players at this store right now';
                  }
                  const metCount = displayedPlayers.filter((p) => p.metBefore).length;
                  const connCount = displayedPlayers.filter((p) => connectedIds.has(p.id)).length;
                  const parts: string[] = [];
                  if (metCount > 0) parts.push(`${metCount} met before`);
                  if (connCount > 0) parts.push(`${connCount} connection${connCount !== 1 ? 's' : ''}`);
                  const base = `${displayedPlayers.length} player${displayedPlayers.length !== 1 ? 's' : ''} nearby`;
                  return parts.length > 0 ? `${base} (${parts.join(', ')})` : base;
                })()}
              </Text>
            </View>

            {/* Player list */}
            {displayedPlayers.length > 0 && (
              <View style={styles.list}>
                {displayedPlayers.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    isSelected={player.id === selectedPlayerId}
                    onPress={() => {
                      if (player.id === selectedPlayerId) {
                        handleOpenPreview(player);
                      } else {
                        handleSelectPlayer(player);
                      }
                    }}
                  />
                ))}
              </View>
            )}

            {/* Pods forming here */}
            <PodsSection
              pods={podFeed}
              isCheckedIn={!!activeStore}
              onStartPod={() => setShowPodComposer(true)}
              onOpenPod={handleOpenPod}
            />

            {/* Open to play — LFG feed */}
            <LFGSection
              items={lfgFeed}
              sentInvites={sentInvites}
              onJoin={handleLfgJoin}
            />

            {/* Crossed-paths nudge */}
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
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xxl,
    color: colors.textPrimary,
  },
  storeName: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
  },
  storeHint: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
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
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  filterToggleBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  filterToggleText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  filterToggleTextActive: {
    color: colors.accent,
  },
  filterBadge: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 9,
    color: colors.textInverse,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  selectBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  selectBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  radarPlaceholder: {
    height: RADAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  countText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  list: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.sm,
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

const radar = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.lg },
});

const row = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  selected: { backgroundColor: colors.accentLight },
  avatar: {
    width: 40, height: 40, borderRadius: radii.avatar,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    flex: 1,
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
  sub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
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
    width: 40, height: 40, borderRadius: radii.avatar,
    alignItems: 'center', justifyContent: 'center',
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

const filt = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceWarm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  chipScroll: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.accent },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 2,
  },
  colorPip: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPipActive: {
    borderColor: colors.accent,
  },
  colorText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  powerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  powerLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    width: 26,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
  },
  stepVal: {
    width: 28,
    textAlign: 'center',
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  powerSep: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textTertiary,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  clearText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
});

// ---------------------------------------------------------------------------
// LFG styles
// ---------------------------------------------------------------------------

const lfgBar = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.success + '18',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success + '50',
  },
  ctaDisabled: { opacity: 0.45 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.success,
  },
  ctaText: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.success,
  },
  ctaHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success + '60',
    ...shadows.sm,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.success,
  },
  activeLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  timer: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
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
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.success,
  },
  headerText: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCount: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  list: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success + '30',
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
  name: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  metBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.success + '22',
    borderRadius: radii.full,
  },
  metText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.success,
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
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
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
    backgroundColor: colors.success,
  },
  joinBtnSent: { backgroundColor: colors.success + '40' },
  joinText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textInverse,
  },
  joinTextSent: { color: colors.success },
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
    backgroundColor: colors.success,
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
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  chipActive: { borderColor: colors.success, backgroundColor: colors.success + '18' },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.success },
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
  segActive: { borderColor: colors.success, backgroundColor: colors.success + '18' },
  segText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  segTextActive: { color: colors.success, fontFamily: typography.fontFamily.semiBold },
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
