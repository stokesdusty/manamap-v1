import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRef, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrackerPlayer, TrackerState, TrackerCounter } from '@manamap/shared';
import { useLifeTracker } from '../hooks/useLifeTracker';
import { useProfile } from '../hooks/useMe';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LifeTracker'>;

const MANA_FILL: Record<string, string> = {
  W: colors.mana.W, U: colors.mana.U, B: colors.mana.B, R: colors.mana.R, G: colors.mana.G,
};

function playerColor(avatarColors: string[]): string {
  return MANA_FILL[avatarColors[0] ?? ''] ?? colors.border;
}

// ---------------------------------------------------------------------------
// RepeatButton — fires once on press, repeats on long-press
// ---------------------------------------------------------------------------

interface RepeatButtonProps {
  onDelta: () => void;
  label: string;
  style?: object;
  textStyle?: object;
}

function RepeatButton({ onDelta, label, style, textStyle }: RepeatButtonProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  return (
    <Pressable
      style={({ pressed }) => [rb.btn, style, pressed && { opacity: 0.6 }]}
      onPress={onDelta}
      onLongPress={() => { intervalRef.current = setInterval(onDelta, 120); }}
      onPressOut={stop}
      delayLongPress={400}
    >
      <Text style={[rb.text, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const rb = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  text: {
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
  },
});

// ---------------------------------------------------------------------------
// CommanderDamageSheet — modal for per-source commander damage
// ---------------------------------------------------------------------------

interface CmdSheetProps {
  player: TrackerPlayer;
  allPlayers: TrackerPlayer[];
  onDelta: (sourceUserId: string, delta: number) => void;
  onClose: () => void;
}

function CommanderDamageSheet({ player, allPlayers, onDelta, onClose }: CmdSheetProps) {
  const sources = allPlayers.filter((p) => p.userId !== player.userId);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cds.overlay} onPress={onClose} />
      <View style={cds.sheet}>
        <View style={cds.handle} />
        <Text style={cds.title}>Commander Damage → {player.displayName}</Text>
        {sources.map((src) => {
          const dmg = player.commanderDamage[src.userId] ?? 0;
          const fill = playerColor(src.avatarColors);
          const danger = dmg >= 18;
          return (
            <View key={src.userId} style={cds.row}>
              <View style={[cds.dot, { backgroundColor: fill }]} />
              <Text style={cds.name} numberOfLines={1}>{src.displayName}</Text>
              <Text style={[cds.dmg, danger && cds.dmgDanger]}>{dmg}</Text>
              <View style={cds.btns}>
                <RepeatButton
                  onDelta={() => onDelta(src.userId, -1)}
                  label="−"
                  style={cds.adjBtn}
                  textStyle={cds.adjText}
                />
                <RepeatButton
                  onDelta={() => onDelta(src.userId, 1)}
                  label="+"
                  style={[cds.adjBtn, cds.adjBtnPlus]}
                  textStyle={cds.adjTextPlus}
                />
              </View>
            </View>
          );
        })}
        <Pressable style={cds.doneBtn} onPress={onClose}>
          <Text style={cds.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const cds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  dmg: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  dmgDanger: { color: colors.error },
  btns: { flexDirection: 'row', gap: spacing.sm },
  adjBtn: {
    width: 36, height: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjBtnPlus: { backgroundColor: colors.accent, borderColor: colors.accent },
  adjText: { fontSize: typography.fontSize.lg, color: colors.textPrimary },
  adjTextPlus: { fontSize: typography.fontSize.lg, color: colors.textInverse },
  doneBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});

// ---------------------------------------------------------------------------
// CounterRow — poison / energy / experience
// ---------------------------------------------------------------------------

interface CounterRowProps {
  player: TrackerPlayer;
  compact: boolean;
  onDelta: (counter: TrackerCounter, delta: number) => void;
}

function CounterRow({ player, compact, onDelta }: CounterRowProps) {
  const counters: Array<{ key: TrackerCounter; icon: string; danger?: boolean }> = [
    { key: 'poison', icon: '☠', danger: player.poison >= 8 },
    { key: 'energy', icon: '⚡' },
    { key: 'experience', icon: '✦' },
  ];

  return (
    <View style={[cr.row, compact && cr.rowCompact]}>
      {counters.map(({ key, icon, danger }) => {
        const val = player[key];
        if (compact && val === 0 && key !== 'poison') return null;
        return (
          <View key={key} style={cr.item}>
            <Pressable onPress={() => onDelta(key, -1)} hitSlop={6} style={cr.adjMin}>
              <Text style={cr.adjText}>−</Text>
            </Pressable>
            <Text style={[cr.icon, compact && cr.iconCompact, danger && cr.iconDanger]}>{icon}</Text>
            <Text style={[cr.val, danger && cr.valDanger]}>{val}</Text>
            <Pressable onPress={() => onDelta(key, 1)} hitSlop={6} style={cr.adjPlus}>
              <Text style={[cr.adjText, cr.adjPlusText]}>+</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  rowCompact: { gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  adjMin: { paddingHorizontal: 4 },
  adjPlus: { paddingHorizontal: 4 },
  adjText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  adjPlusText: { color: colors.accent },
  icon: { fontSize: 14 },
  iconCompact: { fontSize: 12 },
  iconDanger: { color: colors.error },
  val: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    minWidth: 14,
    textAlign: 'center',
  },
  valDanger: { color: colors.error },
});

// ---------------------------------------------------------------------------
// PlayerPanel
// ---------------------------------------------------------------------------

interface PlayerPanelProps {
  player: TrackerPlayer;
  allPlayers: TrackerPlayer[];
  isFlipped: boolean;
  compact: boolean;
  isActiveTurn: boolean;
  onLifeDelta: (delta: number) => void;
  onCommanderDamage: (sourceUserId: string, delta: number) => void;
  onCounterDelta: (counter: TrackerCounter, delta: number) => void;
  onEliminateToggle: () => void;
}

function PlayerPanel({
  player,
  allPlayers,
  isFlipped,
  compact,
  isActiveTurn,
  onLifeDelta,
  onCommanderDamage,
  onCounterDelta,
  onEliminateToggle,
}: PlayerPanelProps) {
  const [cmdSheetOpen, setCmdSheetOpen] = useState(false);

  const hasCmdDamage = Object.keys(player.commanderDamage).length > 0;
  const cmdTotal = Object.values(player.commanderDamage).reduce((s, v) => s + v, 0);
  const fill = playerColor(player.avatarColors);
  const lifeFontSize = compact ? 56 : 80;

  const content = (
    <View
      style={[
        pp.panel,
        { borderColor: fill + '60' },
        isActiveTurn && pp.activeBorder,
        player.isEliminated && pp.eliminated,
      ]}
    >
      {/* Header row */}
      <View style={pp.header}>
        <View style={[pp.dot, { backgroundColor: fill }]} />
        <Text style={[pp.name, compact && pp.nameCompact]} numberOfLines={1}>
          {player.displayName}
          {player.commanderCastCount > 0 && (
            <Text style={pp.castCount}> (×{player.commanderCastCount + 1})</Text>
          )}
        </Text>
        {!compact && (
          <View style={pp.badges}>
            {player.hasCitysBlessing && <Text style={pp.badge}>🏙</Text>}
          </View>
        )}
        <Pressable onPress={onEliminateToggle} hitSlop={8} style={pp.xBtn}>
          <Ionicons
            name={player.isEliminated ? 'refresh-circle' : 'close-circle-outline'}
            size={compact ? 18 : 22}
            color={player.isEliminated ? colors.success : colors.textTertiary}
          />
        </Pressable>
      </View>

      {/* Life display + ±1 / ±5 tap zones */}
      <View style={pp.lifeSection}>
        <View style={pp.lifeTotalRow}>
          <Text
            style={[pp.lifeTotal, { fontSize: lifeFontSize }, player.isEliminated && pp.lifeDead]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {player.life}
          </Text>
          {player.isEliminated && <Text style={pp.deadLabel}>OUT</Text>}
        </View>
        <View style={[pp.btnRow, compact && pp.btnRowCompact]}>
          <RepeatButton
            onDelta={() => onLifeDelta(-5)}
            label="-5"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
          <RepeatButton
            onDelta={() => onLifeDelta(-1)}
            label="−"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
          <RepeatButton
            onDelta={() => onLifeDelta(1)}
            label="+"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
          <RepeatButton
            onDelta={() => onLifeDelta(5)}
            label="+5"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
        </View>
      </View>

      {/* Counters */}
      <CounterRow player={player} compact={compact} onDelta={onCounterDelta} />

      {/* Commander damage row */}
      {hasCmdDamage && (
        <Pressable style={pp.cmdRow} onPress={() => setCmdSheetOpen(true)}>
          <Text style={[pp.cmdLabel, compact && pp.cmdLabelCompact]}>
            CMD {cmdTotal > 0 ? `${cmdTotal}` : '—'}
          </Text>
          {!compact && Object.entries(player.commanderDamage).map(([srcId, dmg]) => {
            const src = allPlayers.find((p) => p.userId === srcId);
            if (!src) return null;
            const srcFill = playerColor(src.avatarColors);
            return (
              <View key={srcId} style={pp.cmdChip}>
                <View style={[pp.cmdDot, { backgroundColor: srcFill }]} />
                <Text style={[pp.cmdChipText, dmg >= 18 && pp.cmdChipDanger]}>{dmg}</Text>
              </View>
            );
          })}
          <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
        </Pressable>
      )}

      {/* Eliminated overlay */}
      {player.isEliminated && <View style={pp.eliminatedOverlay} pointerEvents="none" />}

      {cmdSheetOpen && (
        <CommanderDamageSheet
          player={player}
          allPlayers={allPlayers}
          onDelta={(srcId, delta) => onCommanderDamage(srcId, delta)}
          onClose={() => setCmdSheetOpen(false)}
        />
      )}
    </View>
  );

  return isFlipped ? (
    <View style={{ flex: 1, transform: [{ rotate: '180deg' }] }}>{content}</View>
  ) : (
    <View style={{ flex: 1 }}>{content}</View>
  );
}

const pp = StyleSheet.create({
  panel: {
    flex: 1,
    margin: 2,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  activeBorder: { borderColor: colors.accent + '80', borderWidth: 2 },
  eliminated: { opacity: 0.55 },
  eliminatedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md,
    backgroundColor: colors.error + '15',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  nameCompact: { fontSize: typography.fontSize.xs },
  castCount: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  badges: { flexDirection: 'row', gap: 2 },
  badge: { fontSize: 14 },
  xBtn: { padding: 2 },
  lifeSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  lifeTotalRow: { alignItems: 'center', justifyContent: 'center' },
  lifeTotal: {
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    lineHeight: undefined,
  },
  lifeDead: { color: colors.textTertiary },
  deadLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
    color: colors.error,
    letterSpacing: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 4,
    alignSelf: 'stretch',
  },
  btnRowCompact: { gap: 2 },
  bigBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.chipBg,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtnCompact: { minHeight: 32 },
  bigBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  bigBtnTextCompact: { fontSize: typography.fontSize.sm },
  cmdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.chipBg,
  },
  cmdLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  cmdLabelCompact: { fontSize: 10 },
  cmdChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cmdDot: { width: 8, height: 8, borderRadius: 4 },
  cmdChipText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  cmdChipDanger: { color: colors.error },
});

// ---------------------------------------------------------------------------
// GameBar
// ---------------------------------------------------------------------------

interface GameBarProps {
  state: TrackerState;
  allPlayers: TrackerPlayer[];
  canUndo: boolean;
  onUndo: () => void;
  onNextTurn: () => void;
  onReset: () => void;
  onClose: () => void;
}

function GameBar({ state, allPlayers, canUndo, onUndo, onNextTurn, onReset, onClose }: GameBarProps) {
  const active = allPlayers.find((p) => p.userId === state.activePlayerId);
  const monarch = allPlayers.find((p) => p.userId === state.monarchId);
  const initiative = allPlayers.find((p) => p.userId === state.initiativeId);

  return (
    <View style={gb.bar}>
      <Pressable onPress={onClose} hitSlop={8} style={gb.closeBtn}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>

      <View style={gb.chips}>
        <View style={gb.chip}>
          <Text style={gb.chipLabel}>T{state.turnNumber}</Text>
        </View>
        {active && (
          <View style={[gb.chip, gb.activeChip]}>
            <View style={[gb.dot, { backgroundColor: playerColor(active.avatarColors) }]} />
            <Text style={[gb.chipLabel, gb.activeLabel]} numberOfLines={1}>
              {active.displayName}
            </Text>
          </View>
        )}
        {monarch && (
          <View style={[gb.chip, gb.tokenChip]}>
            <Text style={gb.tokenIcon}>👑</Text>
            <Text style={gb.chipLabel} numberOfLines={1}>{monarch.displayName}</Text>
          </View>
        )}
        {initiative && (
          <View style={[gb.chip, gb.tokenChip]}>
            <Text style={gb.tokenIcon}>⚔️</Text>
            <Text style={gb.chipLabel} numberOfLines={1}>{initiative.displayName}</Text>
          </View>
        )}
      </View>

      <View style={gb.actions}>
        <Pressable
          onPress={onUndo}
          disabled={!canUndo}
          hitSlop={8}
          style={[gb.actionBtn, !canUndo && gb.actionDisabled]}
        >
          <Ionicons name="arrow-undo" size={18} color={canUndo ? colors.textSecondary : colors.border} />
        </Pressable>
        <Pressable onPress={onNextTurn} hitSlop={8} style={gb.actionBtn}>
          <Ionicons name="play-skip-forward" size={18} color={colors.accent} />
        </Pressable>
        <Pressable onPress={onReset} hitSlop={8} style={gb.actionBtn}>
          <Ionicons name="refresh" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const gb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  closeBtn: { padding: spacing.xs },
  chips: { flex: 1, flexDirection: 'row', gap: spacing.xs, flexWrap: 'nowrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.chipBg,
  },
  activeChip: { backgroundColor: colors.accent + '18' },
  tokenChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    maxWidth: 80,
  },
  activeLabel: { color: colors.accent },
  tokenIcon: { fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionBtn: { padding: spacing.xs },
  actionDisabled: { opacity: 0.35 },
});

// ---------------------------------------------------------------------------
// SetupSheet — shown when tracker hasn't been started yet
// ---------------------------------------------------------------------------

interface SetupSheetProps {
  format: string | null;
  isHost: boolean;
  onStart: (life: number) => void;
  onClose: () => void;
}

function SetupSheet({ format, isHost, onStart, onClose }: SetupSheetProps) {
  const defaultLife = format === 'commander' ? 40 : 20;
  const [life, setLife] = useState(defaultLife);
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const presets = [20, 40];

  return (
    <View style={ss.container}>
      <View style={ss.card}>
        <View style={ss.header}>
          <Text style={ss.title}>
            {isHost ? 'Start Life Tracker' : 'Waiting for host…'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {isHost ? (
          <>
            <Text style={ss.label}>Starting life total</Text>
            <View style={ss.presets}>
              {presets.map((p) => (
                <Pressable
                  key={p}
                  style={[ss.preset, life === p && ss.presetActive]}
                  onPress={() => { setLife(p); setShowCustom(false); }}
                >
                  <Text style={[ss.presetText, life === p && ss.presetTextActive]}>{p}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[ss.preset, showCustom && ss.presetActive]}
                onPress={() => setShowCustom(true)}
              >
                <Text style={[ss.presetText, showCustom && ss.presetTextActive]}>Custom</Text>
              </Pressable>
            </View>

            {showCustom && (
              <TextInput
                style={ss.input}
                keyboardType="number-pad"
                placeholder="Enter life total"
                placeholderTextColor={colors.textTertiary}
                value={custom}
                onChangeText={(v) => { setCustom(v); const n = parseInt(v, 10); if (n > 0) setLife(n); }}
                autoFocus
              />
            )}

            <Pressable
              style={ss.startBtn}
              onPress={() => onStart(life)}
            >
              <Text style={ss.startBtnText}>Start — {life} life</Text>
            </Pressable>
          </>
        ) : (
          <View style={ss.waitRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={ss.waitText}>The host will start the tracker</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  presets: { flexDirection: 'row', gap: spacing.sm },
  preset: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  presetActive: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  presetText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  presetTextActive: { color: colors.accent },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  startBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  waitText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});

type PanelProps = Omit<Parameters<typeof PlayerPanel>[0], never>;

// ---------------------------------------------------------------------------
// LifeTrackerScreen
// ---------------------------------------------------------------------------

export function LifeTrackerScreen({ route, navigation }: Props) {
  const { podId } = route.params;
  const { state, isConnected: _conn, isLoading, actions } = useLifeTracker(podId);
  const { data: profile } = useProfile();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const handleConfirmReset = useCallback(() => {
    Alert.alert('Reset game?', 'All life totals will return to starting values.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => actions.resetGame() },
    ]);
  }, [actions]);

  const selfId = profile?.id ?? '';

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Connecting…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!state) {
    const isSelfHost = true; // anyone in the pod can start the tracker
    return (
      <SafeAreaView style={s.safe}>
        <SetupSheet
          format={null}
          isHost={isSelfHost}
          onStart={(life) => actions.startTracker(life)}
          onClose={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const players = state.players;
  const selfIdx = players.findIndex((p) => p.userId === selfId);
  const count = players.length;

  const canUndo = true; // server safely returns current state when history is empty

  // Build per-player action props
  const makeProps = (player: TrackerPlayer): Omit<PanelProps, 'isFlipped' | 'compact'> => ({
    player,
    allPlayers: players,
    isActiveTurn: player.userId === state.activePlayerId,
    onLifeDelta: (delta) => actions.lifeDelta(player.userId, delta),
    onCommanderDamage: (srcId, delta) =>
      actions.commanderDamage({
        targetUserId: player.userId,
        sourceUserId: srcId,
        delta,
      }),
    onCounterDelta: (counter, delta) => actions.counterDelta(player.userId, counter, delta),
    onEliminateToggle: () =>
      actions.eliminate({ userId: player.userId, eliminated: !player.isEliminated }),
  });

  const renderPanel = (player: TrackerPlayer, isFlipped: boolean, compact: boolean) => (
    <PlayerPanel key={player.userId} {...makeProps(player)} isFlipped={isFlipped} compact={compact} />
  );

  let grid: React.ReactNode;
  if (count === 1) {
    grid = <View style={{ flex: 1 }}>{renderPanel(players[0]!, false, false)}</View>;
  } else if (count === 2) {
    const self = selfIdx >= 0 ? players[selfIdx]! : players[0]!;
    const other = players.find((p) => p.userId !== self.userId)!;
    grid = isLandscape ? (
      // Landscape: side by side — opponent left (flipped), self right
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {renderPanel(other, true, false)}
        {renderPanel(self, false, false)}
      </View>
    ) : (
      // Portrait: stacked — opponent top (flipped), self bottom
      <View style={{ flex: 1 }}>
        {renderPanel(other, true, false)}
        {renderPanel(self, false, false)}
      </View>
    );
  } else if (count === 3) {
    const self = selfIdx >= 0 ? players[selfIdx]! : players[players.length - 1]!;
    const others = players.filter((p) => p.userId !== self.userId);
    grid = isLandscape ? (
      // Landscape: opponents stacked on left, self takes right half
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          {others.map((p) => renderPanel(p, true, false))}
        </View>
        {renderPanel(self, false, false)}
      </View>
    ) : (
      // Portrait: opponents side by side on top, self on bottom
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {others.map((p) => renderPanel(p, true, false))}
        </View>
        {renderPanel(self, false, false)}
      </View>
    );
  } else {
    // 4 players — 2×2 works in both orientations; compact in both (panels are small either way)
    const self = selfIdx >= 0 ? players[selfIdx]! : players[3]!;
    const rest = players.filter((p) => p.userId !== self.userId);
    const [p0, p1, p2] = rest as [TrackerPlayer, TrackerPlayer, TrackerPlayer];
    grid = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {renderPanel(p0, true, true)}
          {renderPanel(p1, true, true)}
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {renderPanel(p2, false, true)}
          {renderPanel(self, false, true)}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.safe, { backgroundColor: colors.paper }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <GameBar
          state={state}
          allPlayers={players}
          canUndo={canUndo}
          onUndo={actions.undo}
          onNextTurn={actions.nextTurn}
          onReset={handleConfirmReset}
          onClose={() => navigation.goBack()}
        />
        {grid}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
