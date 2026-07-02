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
import { useRef, useState, useCallback, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrackerPlayer, TrackerState, TrackerCounter } from '@manamap/shared';
import { useLifeTracker } from '../hooks/useLifeTracker';
import { useProfile } from '../hooks/useMe';
import type { PodFormPlayer, RootStackParamList } from '../navigation/types';
import { colors, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LifeTracker'>;

const MANA_FILL: Record<string, string> = {
  W: colors.mana.W,
  U: colors.mana.U,
  B: colors.mana.B,
  R: colors.mana.R,
  G: colors.mana.G,
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
  accessibilityLabel?: string;
  style?: object;
  textStyle?: object;
}

function RepeatButton({ onDelta, label, accessibilityLabel, style, textStyle }: RepeatButtonProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return (
    <Pressable
      style={({ pressed }) => [rb.btn, style, pressed && { opacity: 0.6 }]}
      onPress={onDelta}
      onLongPress={() => {
        intervalRef.current = setInterval(onDelta, 120);
      }}
      onPressOut={stop}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
      <Pressable
        style={cds.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
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
              <Text style={cds.name} numberOfLines={1}>
                {src.displayName}
              </Text>
              <Text style={[cds.dmg, danger && cds.dmgDanger]}>{dmg}</Text>
              <View style={cds.btns}>
                <RepeatButton
                  onDelta={() => onDelta(src.userId, -1)}
                  label="−"
                  accessibilityLabel={`Decrease commander damage from ${src.displayName}`}
                  style={cds.adjBtn}
                  textStyle={cds.adjText}
                />
                <RepeatButton
                  onDelta={() => onDelta(src.userId, 1)}
                  label="+"
                  accessibilityLabel={`Increase commander damage from ${src.displayName}`}
                  style={[cds.adjBtn, cds.adjBtnPlus]}
                  textStyle={cds.adjTextPlus}
                />
              </View>
            </View>
          );
        })}
        <Pressable style={cds.doneBtn} onPress={onClose} accessibilityRole="button">
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
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
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
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  dmg: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  dmgDanger: { color: colors.error },
  btns: { flexDirection: 'row', gap: spacing.sm },
  adjBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjBtnPlus: { backgroundColor: colors.accent, borderColor: colors.accent },
  adjText: { fontSize: typography.fontSize.xl, color: colors.textPrimary },
  adjTextPlus: { fontSize: typography.fontSize.xl, color: colors.textInverse },
  doneBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.lg,
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
            <Pressable
              onPress={() => onDelta(key, -1)}
              hitSlop={8}
              style={cr.adjMin}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${key}`}
            >
              <Text style={cr.adjText}>−</Text>
            </Pressable>
            <Text style={[cr.icon, compact && cr.iconCompact, danger && cr.iconDanger]}>
              {icon}
            </Text>
            <Text style={[cr.val, danger && cr.valDanger]}>{val}</Text>
            <Pressable
              onPress={() => onDelta(key, 1)}
              hitSlop={8}
              style={cr.adjPlus}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${key}`}
            >
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
    fontSize: typography.fontSize.md,
    color: colors.textTertiary,
  },
  adjPlusText: { color: colors.accent },
  icon: { fontSize: 17 },
  iconCompact: { fontSize: 14 },
  iconDanger: { color: colors.error },
  val: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    minWidth: 16,
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
  const lifeFontSize = compact ? 64 : 90;

  const content = (
    <View
      style={[
        pp.panel,
        { borderColor: fill + '55', borderWidth: 1.5 },
        isActiveTurn && { borderColor: fill, borderWidth: 2.5 },
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
        <Pressable
          onPress={onEliminateToggle}
          hitSlop={8}
          style={pp.xBtn}
          accessibilityRole="button"
          accessibilityLabel={
            player.isEliminated ? `Restore ${player.displayName}` : `Eliminate ${player.displayName}`
          }
        >
          <Ionicons
            name={player.isEliminated ? 'refresh-circle' : 'close-circle-outline'}
            size={compact ? 20 : 26}
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
            accessibilityLabel="Decrease life by 5"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
          <RepeatButton
            onDelta={() => onLifeDelta(-1)}
            label="−"
            accessibilityLabel="Decrease life by 1"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
          <RepeatButton
            onDelta={() => onLifeDelta(1)}
            label="+"
            accessibilityLabel="Increase life by 1"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
          <RepeatButton
            onDelta={() => onLifeDelta(5)}
            label="+5"
            accessibilityLabel="Increase life by 5"
            style={[pp.bigBtn, compact && pp.bigBtnCompact]}
            textStyle={[pp.bigBtnText, compact && pp.bigBtnTextCompact]}
          />
        </View>
      </View>

      {/* Counters */}
      <CounterRow player={player} compact={compact} onDelta={onCounterDelta} />

      {/* Commander damage row — always visible so the first hit can be recorded */}
      <Pressable
        style={pp.cmdRow}
        onPress={() => setCmdSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Commander damage for ${player.displayName}`}
      >
        <Text
          style={[pp.cmdLabel, compact && pp.cmdLabelCompact, hasCmdDamage && pp.cmdLabelActive]}
        >
          CMD {cmdTotal > 0 ? `${cmdTotal}` : '+'}
        </Text>
        {!compact &&
          Object.entries(player.commanderDamage).map(([srcId, dmg]) => {
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
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      </Pressable>

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
  eliminated: { opacity: 0.55 },
  eliminatedOverlay: {
    ...(StyleSheet.absoluteFill as object),
    borderRadius: radii.md,
    backgroundColor: colors.error + '15',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  nameCompact: { fontSize: typography.fontSize.sm },
  castCount: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  badges: { flexDirection: 'row', gap: 2 },
  badge: { fontSize: 16 },
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
    letterSpacing: -2,
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
    minHeight: 54,
    backgroundColor: colors.chipBg,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtnCompact: { minHeight: 40 },
  bigBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
  },
  bigBtnTextCompact: { fontSize: typography.fontSize.md },
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
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  cmdLabelCompact: { fontSize: 11 },
  cmdLabelActive: { color: colors.error },
  cmdChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cmdDot: { width: 9, height: 9, borderRadius: 5 },
  cmdChipText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
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

function GameBar({
  state,
  allPlayers,
  canUndo,
  onUndo,
  onNextTurn,
  onReset,
  onClose,
}: GameBarProps) {
  const active = allPlayers.find((p) => p.userId === state.activePlayerId);
  const monarch = allPlayers.find((p) => p.userId === state.monarchId);
  const initiative = allPlayers.find((p) => p.userId === state.initiativeId);

  return (
    <View style={gb.bar}>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        style={gb.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
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
            <Text style={gb.chipLabel} numberOfLines={1}>
              {monarch.displayName}
            </Text>
          </View>
        )}
        {initiative && (
          <View style={[gb.chip, gb.tokenChip]}>
            <Text style={gb.tokenIcon}>⚔️</Text>
            <Text style={gb.chipLabel} numberOfLines={1}>
              {initiative.displayName}
            </Text>
          </View>
        )}
      </View>

      <View style={gb.actions}>
        <Pressable
          onPress={onUndo}
          disabled={!canUndo}
          hitSlop={8}
          style={[gb.actionBtn, !canUndo && gb.actionDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          accessibilityState={{ disabled: !canUndo }}
        >
          <Ionicons
            name="arrow-undo"
            size={20}
            color={canUndo ? colors.textSecondary : colors.border}
          />
        </Pressable>
        <Pressable
          onPress={onNextTurn}
          hitSlop={8}
          style={[gb.actionBtn, gb.actionBtnNext]}
          accessibilityRole="button"
          accessibilityLabel="Next turn"
        >
          <Ionicons name="play-skip-forward" size={20} color={colors.accentInk} />
        </Pressable>
        <Pressable
          onPress={onReset}
          hitSlop={8}
          style={gb.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Reset game"
        >
          <Ionicons name="refresh" size={20} color={colors.textTertiary} />
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
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    maxWidth: 90,
  },
  activeLabel: { color: colors.accent },
  tokenIcon: { fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnNext: {
    backgroundColor: colors.accentLight,
  },
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
          <Text style={ss.title}>{isHost ? 'Start Life Tracker' : 'Waiting for host…'}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
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
                  onPress={() => {
                    setLife(p);
                    setShowCustom(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: life === p && !showCustom }}
                >
                  <Text style={[ss.presetText, life === p && ss.presetTextActive]}>{p}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[ss.preset, showCustom && ss.presetActive]}
                onPress={() => setShowCustom(true)}
                accessibilityRole="button"
                accessibilityState={{ selected: showCustom }}
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
                onChangeText={(v) => {
                  setCustom(v);
                  const n = parseInt(v, 10);
                  if (n > 0) setLife(n);
                }}
                autoFocus
                accessibilityLabel="Custom life total"
              />
            )}

            <Pressable style={ss.startBtn} onPress={() => onStart(life)} accessibilityRole="button">
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
    fontSize: 20,
    letterSpacing: -0.4,
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
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  waitText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});

type PanelProps = Omit<Parameters<typeof PlayerPanel>[0], never>;

// ---------------------------------------------------------------------------
// LocalLifeTracker — offline pod tracker (Form a Pod flow)
// ---------------------------------------------------------------------------

function toTrackerPlayers(players: PodFormPlayer[], life: number): TrackerPlayer[] {
  return players.map((p) => ({
    userId: p.id,
    displayName: p.displayName,
    avatarColors: p.avatarColors,
    life,
    poison: 0,
    energy: 0,
    experience: 0,
    commanderDamage: {},
    commanderCastCount: 0,
    isEliminated: false,
    hasCitysBlessing: false,
  }));
}

function LocalSetupSheet({
  players,
  onStart,
  onClose,
}: {
  players: PodFormPlayer[];
  onStart: (life: number) => void;
  onClose: () => void;
}) {
  const [life, setLife] = useState(40);
  return (
    <View style={ss.container}>
      <View style={ss.card}>
        <View style={ss.header}>
          <Text style={ss.title}>Confirm Starting Life</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={[ss.label, lss.sectionLabel]}>Pod · {players.length} players</Text>
        <View style={lss.playerList}>
          {players.map((p) => (
            <View key={p.id} style={lss.playerRow}>
              <View style={[lss.dot, { backgroundColor: playerColor(p.avatarColors) }]} />
              <Text style={lss.playerName} numberOfLines={1}>
                {p.displayName}
              </Text>
              {p.isGuest && <Text style={lss.guestTag}>Guest</Text>}
            </View>
          ))}
        </View>
        <Text style={ss.label}>Starting life total</Text>
        <View style={ss.presets}>
          {[20, 40].map((n) => (
            <Pressable
              key={n}
              style={[ss.preset, life === n && ss.presetActive]}
              onPress={() => setLife(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: life === n }}
            >
              <Text style={[ss.presetText, life === n && ss.presetTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={ss.startBtn} onPress={() => onStart(life)} accessibilityRole="button">
          <Text style={ss.startBtnText}>Continue →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const lss = StyleSheet.create({
  sectionLabel: { marginBottom: 8 },
  playerList: { marginBottom: 20, gap: 6 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.chipBg,
    borderRadius: radii.md,
  },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  playerName: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  guestTag: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 11,
    color: colors.textTertiary,
  },
});

function FirstPlayerPicker({
  players,
  onConfirm,
}: {
  players: TrackerPlayer[];
  onConfirm: (idx: number) => void;
}) {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const winner = Math.floor(Math.random() * players.length);
    const totalSteps = 20 + Math.floor(Math.random() * 8);
    let step = 0;
    let currentIdx = 0;

    const tick = () => {
      step++;
      currentIdx = (currentIdx + 1) % players.length;
      setHighlightIdx(currentIdx);
      if (step < totalSteps) {
        const t = step / totalSteps;
        timerRef.current = setTimeout(tick, 55 + t * t * 445);
      } else {
        const dist = (((winner - currentIdx) % players.length) + players.length) % players.length;
        if (dist === 0) {
          timerRef.current = setTimeout(() => setPickedIdx(winner), 500);
        } else {
          let s = 0;
          const settle = () => {
            s++;
            currentIdx = (currentIdx + 1) % players.length;
            setHighlightIdx(currentIdx);
            if (s < dist) {
              timerRef.current = setTimeout(settle, 480 + s * 70);
            } else {
              timerRef.current = setTimeout(() => setPickedIdx(winner), 520);
            }
          };
          timerRef.current = setTimeout(settle, 480);
        }
      }
    };
    timerRef.current = setTimeout(tick, 80);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <View style={fpp.container}>
      <View style={fpp.top}>
        <Text style={fpp.title}>
          {pickedIdx !== null
            ? `${players[pickedIdx]?.displayName} goes first!`
            : 'Who goes first?'}
        </Text>
        <Text style={fpp.sub}>
          {pickedIdx !== null ? 'Tap below to begin.' : '🎲 Rolling the dice…'}
        </Text>
      </View>
      <View style={fpp.list}>
        {players.map((p, i) => {
          const isHighlit = i === highlightIdx;
          const isPicked = pickedIdx === i;
          const fill = playerColor(p.avatarColors);
          return (
            <View
              key={p.userId}
              style={[
                fpp.row,
                isPicked && {
                  backgroundColor: fill + '18',
                  borderColor: fill,
                  borderWidth: 2.5,
                  transform: [{ scale: 1.025 }],
                },
                !isPicked && isHighlit && fpp.rowHighlit,
              ]}
            >
              <View style={[fpp.dot, { backgroundColor: fill }]} />
              <Text
                style={[
                  fpp.name,
                  isPicked && { color: fill },
                  !isPicked && isHighlit && fpp.nameHighlit,
                ]}
              >
                {p.displayName}
              </Text>
              {isPicked && <Text style={fpp.dice}>🎲</Text>}
            </View>
          );
        })}
      </View>
      {pickedIdx !== null && (
        <Pressable
          style={fpp.letsPlay}
          onPress={() => onConfirm(pickedIdx)}
          accessibilityRole="button"
        >
          <Text style={fpp.letsPlayText}>Let's play!</Text>
        </Pressable>
      )}
    </View>
  );
}

const fpp = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    gap: 28,
  },
  top: { alignItems: 'center' },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
  },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  rowHighlit: { backgroundColor: colors.accent + '18', borderColor: colors.accent, borderWidth: 2 },
  dot: { width: 11, height: 11, borderRadius: 6, flexShrink: 0 },
  name: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: -0.15,
  },
  nameHighlit: { color: colors.accent },
  dice: { fontSize: 18 },
  letsPlay: {
    marginTop: 24,
    height: 54,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  letsPlayText: { fontFamily: typography.fontFamily.bold, fontSize: 16, color: colors.textInverse },
});

function LocalLifeTracker({
  initialPlayers,
  onClose,
}: {
  initialPlayers: PodFormPlayer[];
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'setup' | 'picking' | 'playing'>('setup');
  const [startingLife, setStartingLife] = useState(40);
  const [localPlayers, setLocalPlayers] = useState<TrackerPlayer[]>([]);
  const [turnNumber, setTurnNumber] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [history, setHistory] = useState<TrackerPlayer[][]>([]);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const applyUpdate = (updater: (ps: TrackerPlayer[]) => TrackerPlayer[]) => {
    setHistory((h) => [...h.slice(-19), localPlayers]);
    setLocalPlayers(updater);
  };

  const handleStart = (life: number) => {
    setStartingLife(life);
    setLocalPlayers(toTrackerPlayers(initialPlayers, life));
    setPhase('picking');
  };

  const handlePicked = (idx: number) => {
    setActiveIdx(idx);
    setPhase('playing');
  };

  const handleConfirmReset = useCallback(() => {
    Alert.alert('Reset game?', 'All life totals will return to starting values.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setHistory([]);
          setLocalPlayers(toTrackerPlayers(initialPlayers, startingLife));
          setTurnNumber(1);
          setActiveIdx(0);
        },
      },
    ]);
  }, [initialPlayers, startingLife]);

  if (phase === 'setup') {
    return (
      <SafeAreaView style={s.safe}>
        <LocalSetupSheet players={initialPlayers} onStart={handleStart} onClose={onClose} />
      </SafeAreaView>
    );
  }

  if (phase === 'picking') {
    return (
      <SafeAreaView style={s.safe}>
        <FirstPlayerPicker players={localPlayers} onConfirm={handlePicked} />
      </SafeAreaView>
    );
  }

  // playing phase
  const count = localPlayers.length;
  const syntheticState: TrackerState = {
    podId: 'local',
    format: null,
    startingLife,
    turnNumber,
    activePlayerId: localPlayers[activeIdx]?.userId ?? null,
    monarchId: null,
    initiativeId: null,
    players: localPlayers,
    createdAt: new Date().toISOString(),
  };

  const makeLocalProps = (player: TrackerPlayer): Omit<PanelProps, 'isFlipped' | 'compact'> => ({
    player,
    allPlayers: localPlayers,
    isActiveTurn: player.userId === syntheticState.activePlayerId,
    onLifeDelta: (delta) =>
      applyUpdate((ps) =>
        ps.map((p) => (p.userId === player.userId ? { ...p, life: p.life + delta } : p)),
      ),
    onCommanderDamage: (srcId, delta) =>
      applyUpdate((ps) =>
        ps.map((p) =>
          p.userId === player.userId
            ? {
                ...p,
                commanderDamage: {
                  ...p.commanderDamage,
                  [srcId]: Math.max(0, (p.commanderDamage[srcId] ?? 0) + delta),
                },
              }
            : p,
        ),
      ),
    onCounterDelta: (counter, delta) =>
      applyUpdate((ps) =>
        ps.map((p) =>
          p.userId === player.userId ? { ...p, [counter]: Math.max(0, p[counter] + delta) } : p,
        ),
      ),
    onEliminateToggle: () =>
      applyUpdate((ps) =>
        ps.map((p) => (p.userId === player.userId ? { ...p, isEliminated: !p.isEliminated } : p)),
      ),
  });

  const renderLocalPanel = (player: TrackerPlayer, isFlipped: boolean, compact: boolean) => (
    <PlayerPanel
      key={player.userId}
      {...makeLocalProps(player)}
      isFlipped={isFlipped}
      compact={compact}
    />
  );

  let grid: React.ReactNode;
  if (count === 1) {
    grid = <View style={{ flex: 1 }}>{renderLocalPanel(localPlayers[0]!, false, false)}</View>;
  } else if (count === 2) {
    const self = localPlayers[0]!;
    const other = localPlayers[1]!;
    grid = isLandscape ? (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {renderLocalPanel(other, true, false)}
        {renderLocalPanel(self, false, false)}
      </View>
    ) : (
      <View style={{ flex: 1 }}>
        {renderLocalPanel(other, true, false)}
        {renderLocalPanel(self, false, false)}
      </View>
    );
  } else if (count === 3) {
    const self = localPlayers[0]!;
    const others = localPlayers.slice(1);
    grid = isLandscape ? (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>{others.map((p) => renderLocalPanel(p, true, false))}</View>
        {renderLocalPanel(self, false, false)}
      </View>
    ) : (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {others.map((p) => renderLocalPanel(p, true, false))}
        </View>
        {renderLocalPanel(self, false, false)}
      </View>
    );
  } else {
    const [self, p1, p2, p3] = localPlayers as [
      TrackerPlayer,
      TrackerPlayer,
      TrackerPlayer,
      TrackerPlayer,
    ];
    grid = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {renderLocalPanel(p1, true, true)}
          {renderLocalPanel(p2, true, true)}
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {renderLocalPanel(p3, false, true)}
          {renderLocalPanel(self, false, true)}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.safe, { backgroundColor: colors.paper }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <GameBar
          state={syntheticState}
          allPlayers={localPlayers}
          canUndo={history.length > 0}
          onUndo={() => {
            if (!history.length) return;
            setLocalPlayers(history[history.length - 1]!);
            setHistory((h) => h.slice(0, -1));
          }}
          onNextTurn={() => {
            setTurnNumber((t) => t + 1);
            setActiveIdx((i) => (i + 1) % localPlayers.length);
          }}
          onReset={handleConfirmReset}
          onClose={onClose}
        />
        <>{grid}</>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LifeTrackerScreen
// ---------------------------------------------------------------------------

export function LifeTrackerScreen({ route, navigation }: Props) {
  const { podId, initialPlayers } = route.params;
  const {
    state,
    isConnected: _conn,
    isLoading,
    actions,
  } = useLifeTracker(initialPlayers ? null : (podId ?? null));
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

  // Local (offline) mode: launched from "Form a Pod" with pre-selected players.
  if (initialPlayers) {
    return <LocalLifeTracker initialPlayers={initialPlayers} onClose={() => navigation.goBack()} />;
  }

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
    <PlayerPanel
      key={player.userId}
      {...makeProps(player)}
      isFlipped={isFlipped}
      compact={compact}
    />
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
        <View style={{ flex: 1 }}>{others.map((p) => renderPanel(p, true, false))}</View>
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
        <>{grid}</>
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
