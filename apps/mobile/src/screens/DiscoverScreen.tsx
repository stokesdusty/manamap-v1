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
import { useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import type {
  ManaColor as SharedManaColor,
  MtgFormat,
  NearbyPlayer,
  PlayerVibe,
  StoreDetail,
  Suggestion,
} from '@manamap/shared';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabParamList, RootStackParamList } from '../navigation/types';
import { useNearby, useSuggestions, useStores, type DiscoveryFilters } from '../hooks/useNearby';
import { usePresence } from '../hooks/usePresence';
import { useBleProximity, sortByBleProximity } from '../hooks/useBleProximity';
import { useCrossedPathsCount } from '../hooks/useEncounters';
import { useActiveStore } from '../context/ActiveStoreContext';
import { colors, radii, shadows, spacing, typography } from '../theme';

type DiscoverScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Discover'>,
  NativeStackScreenProps<RootStackParamList>
>;

type FilterMode = 'everyone' | 'met';

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
}

function Radar({ players, onSelectPlayer, selectedId }: RadarProps) {
  const positions = playerPositions(players.length);

  return (
    <View style={radar.wrap}>
      <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accentLight} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={colors.paper} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={OUTER_RADIUS + NODE_RADIUS} fill="url(#bg)" />

        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={OUTER_RADIUS}
          stroke={colors.borderLight} strokeWidth={1} strokeDasharray="4 4" fill="none" />
        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={INNER_RADIUS}
          stroke={colors.borderLight} strokeWidth={1} strokeDasharray="4 4" fill="none" />

        {positions.map((pos, i) => (
          <Line key={`spoke-${i}`}
            x1={RADAR_CENTER} y1={RADAR_CENTER} x2={pos.x} y2={pos.y}
            stroke={colors.borderLight} strokeWidth={1} />
        ))}

        {players.map((player, i) => {
          const pos = positions[i];
          const isSelected = player.id === selectedId;
          const fill = nodeColor(player);
          const textFill = player.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
          return (
            <G key={player.id} onPress={() => onSelectPlayer(player)}>
              {isSelected && (
                <Circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 4}
                  fill={colors.accentLight} stroke={colors.accent} strokeWidth={1.5} />
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

        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={22} fill={colors.accent} />
        <SvgText x={RADAR_CENTER} y={RADAR_CENTER + 5} textAnchor="middle"
          fill={colors.textInverse} fontSize={11} fontFamily={typography.fontFamily.semiBold}>
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
  const textFill = player.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;

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
            {player.commander}{player.powerLevel != null ? ` · P${player.powerLevel}` : ''}
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
  const textFill = suggestion.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
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
// DiscoverScreen
// ---------------------------------------------------------------------------

export function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { activeStore, setActiveStore } = useActiveStore();
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('everyone');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

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

  // Nearby players (filtered)
  const { data: nearby, isLoading: isLoadingNearby } = useNearby(!!activeStore, discoveryFilters);

  // Matchmaking suggestions (unfiltered — separate ranking)
  const { data: suggestionsData } = useSuggestions(!!activeStore);

  // Crossed-paths nudge
  const crossedPathsCount = useCrossedPathsCount();

  // BLE proximity
  const { rssiMap, isSupported: bleSupported } = useBleProximity(!!activeStore);

  const allPlayers = nearby?.players ?? [];

  const displayedPlayers = useMemo(() => {
    const base = filter === 'met' ? allPlayers.filter((p) => p.metBefore) : allPlayers;
    return bleSupported && Object.keys(rssiMap).length > 0
      ? sortByBleProximity(base, rssiMap)
      : base;
  }, [allPlayers, filter, rssiMap, bleSupported]);

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
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Discover</Text>
          {activeStore ? (
            <Text style={styles.storeName} numberOfLines={1}>{activeStore.name}</Text>
          ) : (
            <Text style={styles.storeHint}>No store selected</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {activeStore && (
            <Pressable
              style={({ pressed }) => [
                styles.filterToggleBtn,
                filtersOpen && styles.filterToggleBtnActive,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setFiltersOpen((o) => !o)}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={filtersOpen ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.filterToggleText, filtersOpen && styles.filterToggleTextActive]}>
                Filters
              </Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.storeBtn, pressed && { opacity: 0.6 }]}
            onPress={() => setShowPicker(true)}
          >
            <Ionicons name="storefront-outline" size={16} color={colors.accent} />
            <Text style={styles.storeBtnText}>{activeStore ? 'Change' : 'Select store'}</Text>
          </Pressable>
        </View>
      </View>

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
        {/* Empty state */}
        {!activeStore && (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>Select your store to discover nearby players</Text>
            <Pressable
              style={({ pressed }) => [styles.selectBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.selectBtnText}>Choose a store</Text>
            </Pressable>
          </View>
        )}

        {activeStore && (
          <>
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
              />
            )}

            {/* Count + BLE */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {displayedPlayers.length === 0
                  ? hasActiveFilters
                    ? 'No players match your filters'
                    : 'No players at this store right now'
                  : `${displayedPlayers.length} player${displayedPlayers.length !== 1 ? 's' : ''} nearby`}
              </Text>
              {bleSupported && (
                <View style={styles.blePip}>
                  <Ionicons name="bluetooth" size={10} color={colors.success} />
                  <Text style={styles.bleText}>BLE</Text>
                </View>
              )}
            </View>

            {/* Filter toggle (everyone / met) */}
            {displayedPlayers.length > 0 && (
              <View style={styles.filterRow}>
                <Pressable
                  style={[styles.filterBtn, filter === 'everyone' && styles.filterBtnActive]}
                  onPress={() => setFilter('everyone')}
                >
                  <Text style={[styles.filterText, filter === 'everyone' && styles.filterTextActive]}>
                    Everyone
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.filterBtn, filter === 'met' && styles.filterBtnActive]}
                  onPress={() => setFilter('met')}
                >
                  <Text style={[styles.filterText, filter === 'met' && styles.filterTextActive]}>
                    Met before
                  </Text>
                </Pressable>
              </View>
            )}

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

            {filter === 'met' && displayedPlayers.length === 0 && (
              <Text style={styles.filterEmpty}>
                None of the players here are in your met history yet.
              </Text>
            )}

            {/* Crossed-paths nudge */}
            {crossedPathsCount > 0 && (
              <Pressable
                style={({ pressed }) => [styles.nudge, pressed && { opacity: 0.8 }]}
                onPress={() => navigation.navigate('History')}
              >
                <Ionicons name="footsteps-outline" size={14} color={colors.accent} />
                <Text style={styles.nudgeText}>
                  {`You've crossed paths with ${crossedPathsCount} player${crossedPathsCount !== 1 ? 's' : ''} you haven't connected with`}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
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
  storeName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
    marginTop: 1,
  },
  storeHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  blePip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.success,
  },
  bleText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 9,
    color: colors.success,
  },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: colors.accentLight },
  filterText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  filterTextActive: { color: colors.accent },
  list: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterEmpty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
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
    width: 40, height: 40, borderRadius: radii.full,
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
    width: 40, height: 40, borderRadius: radii.full,
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
