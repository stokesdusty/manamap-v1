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
import type { NearbyPlayer, MtgFormat, ManaColor as SharedManaColor, StoreDetail } from '@manamap/shared';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabParamList, RootStackParamList } from '../navigation/types';
import { useNearby, useStores } from '../hooks/useNearby';
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

// Distribute players evenly around the radar
function playerPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    // Alternate between inner and outer ring for visual depth
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

        {/* Background gradient fill */}
        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={OUTER_RADIUS + NODE_RADIUS} fill="url(#bg)" />

        {/* Outer ring */}
        <Circle
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={OUTER_RADIUS}
          stroke={colors.borderLight}
          strokeWidth={1}
          strokeDasharray="4 4"
          fill="none"
        />

        {/* Inner ring */}
        <Circle
          cx={RADAR_CENTER}
          cy={RADAR_CENTER}
          r={INNER_RADIUS}
          stroke={colors.borderLight}
          strokeWidth={1}
          strokeDasharray="4 4"
          fill="none"
        />

        {/* Spoke lines from center to each player */}
        {positions.map((pos, i) => (
          <Line
            key={`spoke-${i}`}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={pos.x}
            y2={pos.y}
            stroke={colors.borderLight}
            strokeWidth={1}
          />
        ))}

        {/* Player nodes */}
        {players.map((player, i) => {
          const pos = positions[i];
          const isSelected = player.id === selectedId;
          const fill = nodeColor(player);
          const textFill = player.avatarColors[0] === 'W' ? colors.textPrimary : colors.textInverse;
          return (
            <G key={player.id} onPress={() => onSelectPlayer(player)}>
              {isSelected && (
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_RADIUS + 4}
                  fill={colors.accentLight}
                  stroke={colors.accent}
                  strokeWidth={1.5}
                />
              )}
              <Circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={fill} />
              <SvgText
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fill={textFill}
                fontSize={13}
                fontFamily={typography.fontFamily.bold}
              >
                {avatarInitial(player.displayName)}
              </SvgText>
              {player.metBefore && (
                <Circle
                  cx={pos.x + NODE_RADIUS - 4}
                  cy={pos.y - NODE_RADIUS + 4}
                  r={5}
                  fill={colors.success}
                />
              )}
            </G>
          );
        })}

        {/* Center "You" node */}
        <Circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={22} fill={colors.accent} />
        <SvgText
          x={RADAR_CENTER}
          y={RADAR_CENTER + 5}
          textAnchor="middle"
          fill={colors.textInverse}
          fontSize={11}
          fontFamily={typography.fontFamily.semiBold}
        >
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
  standard: 'Std',
  pioneer: 'Pio',
  modern: 'Mod',
  legacy: 'Leg',
  vintage: 'Vnt',
  commander: 'EDH',
  draft: 'Draft',
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
      style={({ pressed }) => [
        row.root,
        isSelected && row.selected,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      {/* Avatar pip */}
      <View style={[row.avatar, { backgroundColor: fill }]}>
        <Text style={[row.avatarText, { color: textFill }]}>
          {avatarInitial(player.displayName)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={row.nameRow}>
          <Text style={row.name} numberOfLines={1}>{player.displayName}</Text>
          {player.metBefore && (
            <View style={row.metBadge}>
              <Text style={row.metText}>Met</Text>
            </View>
          )}
        </View>
        {player.commander ? (
          <Text style={row.sub} numberOfLines={1}>
            {player.commander}
            {player.powerLevel != null ? ` · P${player.powerLevel}` : ''}
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
// DiscoverScreen
// ---------------------------------------------------------------------------

export function DiscoverScreen({ navigation }: DiscoverScreenProps) {
  const { activeStore, setActiveStore } = useActiveStore();
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('everyone');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Presence heartbeat — reads activeStore from context
  usePresence();

  // Poll for nearby players (only when checked in)
  const { data: nearby, isLoading: isLoadingNearby } = useNearby(!!activeStore);

  // Crossed-paths nudge count (cached 5min)
  const crossedPathsCount = useCrossedPathsCount();

  // BLE proximity — annotates / orders players by signal strength
  const { rssiMap, isSupported: bleSupported } = useBleProximity(!!activeStore);

  const allPlayers = nearby?.players ?? [];

  const displayedPlayers = useMemo(() => {
    const base = filter === 'met' ? allPlayers.filter((p) => p.metBefore) : allPlayers;
    return bleSupported && Object.keys(rssiMap).length > 0
      ? sortByBleProximity(base, rssiMap)
      : base;
  }, [allPlayers, filter, rssiMap, bleSupported]);

  const handleSelectPlayer = useCallback(
    (player: NearbyPlayer) => {
      setSelectedPlayerId((prev) => (prev === player.id ? null : player.id));
    },
    [],
  );

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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Active-store header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Discover</Text>
          {activeStore ? (
            <Text style={styles.storeName} numberOfLines={1}>
              {activeStore.name}
            </Text>
          ) : (
            <Text style={styles.storeHint}>No store selected</Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.storeBtn, pressed && { opacity: 0.6 }]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="storefront-outline" size={16} color={colors.accent} />
          <Text style={styles.storeBtnText}>{activeStore ? 'Change' : 'Select store'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Empty state — no store selected */}
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

        {/* Radar + player list once checked in */}
        {activeStore && (
          <>
            {/* Radar visualization */}
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

            {/* Player count + BLE indicator */}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {displayedPlayers.length === 0
                  ? 'No players at this store right now'
                  : `${displayedPlayers.length} player${displayedPlayers.length !== 1 ? 's' : ''} nearby`}
              </Text>
              {bleSupported && (
                <View style={styles.blePip}>
                  <Ionicons name="bluetooth" size={10} color={colors.success} />
                  <Text style={styles.bleText}>BLE</Text>
                </View>
              )}
            </View>

            {/* Filter toggle */}
            {displayedPlayers.length > 0 && (
              <View style={styles.filterRow}>
                <Pressable
                  style={[styles.filterBtn, filter === 'everyone' && styles.filterBtnActive]}
                  onPress={() => setFilter('everyone')}
                >
                  <Text
                    style={[styles.filterText, filter === 'everyone' && styles.filterTextActive]}
                  >
                    Everyone
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.filterBtn, filter === 'met' && styles.filterBtnActive]}
                  onPress={() => setFilter('met')}
                >
                  <Text
                    style={[styles.filterText, filter === 'met' && styles.filterTextActive]}
                  >
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

            {/* Crossed-paths nudge — never identifies non-discoverable users */}
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
  filterBtnActive: {
    backgroundColor: colors.accentLight,
  },
  filterText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.accent,
  },
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
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
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
  selected: {
    backgroundColor: colors.accentLight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
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
