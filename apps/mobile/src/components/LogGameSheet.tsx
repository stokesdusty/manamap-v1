import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ManaColor } from '@manamap/shared';
import { useProfile } from '../hooks/useMe';
import { useConnections } from '../hooks/useConnections';
import { useCreateGame } from '../hooks/useGames';
import { colors, radii, shadows, spacing, typography } from '../theme';

export interface RosterPlayer {
  userId: string;
  displayName: string;
  avatarColors: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedPlayers?: RosterPlayer[];
  storeId?: string;
}

type Step = 'roster' | 'decks' | 'winner' | 'confirm';

interface DraftPlayer extends RosterPlayer {
  deck: string;
}

function PlayerAvatar({ player, size = 36 }: { player: RosterPlayer; size?: number }) {
  const initial = player.displayName.charAt(0).toUpperCase();
  const fill = player.avatarColors.length > 0 ? colors.mana[player.avatarColors[0] as ManaColor] ?? colors.border : colors.border;
  const textFill =
    player.avatarColors[0] === 'W' || player.avatarColors[0] === 'G'
      ? colors.textPrimary
      : colors.textInverse;
  return (
    <View style={[avatar.root, { width: size, height: size, backgroundColor: fill }]}>
      <Text style={[avatar.text, { color: textFill, fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const avatar = StyleSheet.create({
  root: { borderRadius: radii.avatar, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { fontFamily: typography.fontFamily.bold },
});

function StepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
}) {
  return (
    <View style={hdr.row}>
      <Pressable
        style={({ pressed }) => [hdr.back, pressed && { opacity: 0.6 }]}
        onPress={onBack}
        hitSlop={8}
      >
        {onBack ? (
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        ) : (
          <View style={{ width: 22 }} />
        )}
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <Text style={hdr.stepLabel}>
          {step} of {total}
        </Text>
        <Text style={hdr.title}>{title}</Text>
      </View>
      <View style={{ width: 22 }} />
    </View>
  );
}

const hdr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  back: { padding: 2 },
  stepLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
});

export function LogGameSheet({ visible, onClose, onSuccess, preselectedPlayers, storeId }: Props) {
  const { data: profile } = useProfile();
  const { data: connections } = useConnections();
  const { mutate: createGame, isPending } = useCreateGame();

  const mePlayer: RosterPlayer | null = profile
    ? { userId: profile.id, displayName: profile.displayName, avatarColors: profile.avatarColors as string[] }
    : null;

  const [step, setStep] = useState<Step>('roster');
  const [roster, setRoster] = useState<DraftPlayer[]>([]);
  const [winnerId, setWinnerId] = useState('');

  function initRoster() {
    if (!mePlayer) return;
    const base: DraftPlayer[] = [
      { ...mePlayer, deck: profile?.commander ?? '' },
    ];
    if (preselectedPlayers) {
      for (const p of preselectedPlayers) {
        if (p.userId !== mePlayer.userId) {
          base.push({ ...p, deck: '' });
        }
      }
    }
    setRoster(base);
    setWinnerId('');
    setStep('roster');
  }

  const acceptedConnections: RosterPlayer[] = (connections?.accepted ?? []).map((c) => ({
    userId: c.peer.id,
    displayName: c.peer.displayName,
    avatarColors: c.peer.avatarColors as string[],
  }));

  const rosterIds = new Set(roster.map((p) => p.userId));
  const availableToAdd = acceptedConnections.filter((c) => !rosterIds.has(c.userId));

  function addToRoster(player: RosterPlayer) {
    if (roster.length >= 4) return;
    setRoster((prev) => [...prev, { ...player, deck: '' }]);
  }

  function removeFromRoster(userId: string) {
    if (!mePlayer || userId === mePlayer.userId) return;
    setRoster((prev) => prev.filter((p) => p.userId !== userId));
    if (winnerId === userId) setWinnerId('');
  }

  function updateDeck(userId: string, deck: string) {
    setRoster((prev) => prev.map((p) => (p.userId === userId ? { ...p, deck } : p)));
  }

  function handleSubmit() {
    if (!mePlayer || !winnerId) return;

    const dto = {
      storeId: storeId ?? undefined,
      winnerId,
      players: roster.map((p) => ({
        userId: p.userId,
        ...(p.deck.trim() ? { deck: p.deck.trim() } : {}),
      })),
    };

    createGame(dto, {
      onSuccess: () => {
        Alert.alert('Logged!', 'Other players have been notified to confirm.');
        onSuccess?.();
        onClose();
      },
      onError: () => {
        Alert.alert('Error', 'Could not log the game. Please try again.');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Step: Roster
  // ---------------------------------------------------------------------------

  function RosterStep() {
    return (
      <>
        <StepHeader step={1} total={3} title="Who played?" />
        <ScrollView contentContainerStyle={sh.scroll} keyboardShouldPersistTaps="handled">
          <Text style={sh.sectionLabel}>IN GAME ({roster.length}/4)</Text>
          {roster.map((p) => (
            <View key={p.userId} style={sh.playerRow}>
              <PlayerAvatar player={p} />
              <Text style={sh.playerName} numberOfLines={1}>
                {p.displayName}
                {p.userId === mePlayer?.userId ? ' (you)' : ''}
              </Text>
              {p.userId !== mePlayer?.userId && (
                <Pressable
                  hitSlop={8}
                  onPress={() => removeFromRoster(p.userId)}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}

          {!preselectedPlayers && availableToAdd.length > 0 && roster.length < 4 && (
            <>
              <Text style={[sh.sectionLabel, { marginTop: spacing.lg }]}>ADD FROM CONNECTIONS</Text>
              {availableToAdd.map((c) => (
                <Pressable
                  key={c.userId}
                  style={({ pressed }) => [sh.addRow, pressed && { opacity: 0.7 }]}
                  onPress={() => addToRoster(c)}
                >
                  <PlayerAvatar player={c} />
                  <Text style={sh.playerName} numberOfLines={1}>{c.displayName}</Text>
                  <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                </Pressable>
              ))}
            </>
          )}

          {!preselectedPlayers && availableToAdd.length === 0 && roster.length < 2 && (
            <Text style={sh.empty}>Connect with other players to add them to a game.</Text>
          )}
        </ScrollView>

        <View style={sh.footer}>
          <Pressable
            style={({ pressed }) => [sh.nextBtn, roster.length < 2 && sh.nextBtnDisabled, pressed && { opacity: 0.8 }]}
            onPress={() => setStep('decks')}
            disabled={roster.length < 2}
          >
            <Text style={sh.nextBtnText}>Next — Decks</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textInverse} />
          </Pressable>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Decks
  // ---------------------------------------------------------------------------

  function DecksStep() {
    return (
      <>
        <StepHeader step={2} total={3} title="What did you play?" onBack={() => setStep('roster')} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={sh.scroll} keyboardShouldPersistTaps="handled">
            <Text style={sh.hint}>Optional — deck names shown in your game history.</Text>
            {roster.map((p) => (
              <View key={p.userId} style={sh.deckRow}>
                <PlayerAvatar player={p} size={32} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={sh.deckName} numberOfLines={1}>
                    {p.displayName}
                    {p.userId === mePlayer?.userId ? ' (you)' : ''}
                  </Text>
                  <TextInput
                    style={sh.deckInput}
                    value={p.deck}
                    onChangeText={(v) => updateDeck(p.userId, v)}
                    placeholder="Deck name (optional)"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={128}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={sh.footer}>
          <Pressable
            style={({ pressed }) => [sh.nextBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setStep('winner')}
          >
            <Text style={sh.nextBtnText}>Next — Who won?</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textInverse} />
          </Pressable>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Winner
  // ---------------------------------------------------------------------------

  function WinnerStep() {
    return (
      <>
        <StepHeader step={3} total={3} title="Who won?" onBack={() => setStep('decks')} />
        <ScrollView contentContainerStyle={sh.scroll}>
          {roster.map((p) => {
            const selected = winnerId === p.userId;
            return (
              <Pressable
                key={p.userId}
                style={({ pressed }) => [sh.winnerRow, selected && sh.winnerRowSelected, pressed && { opacity: 0.8 }]}
                onPress={() => setWinnerId(p.userId)}
              >
                <PlayerAvatar player={p} />
                <Text style={[sh.playerName, { flex: 1 }]} numberOfLines={1}>
                  {p.displayName}
                  {p.userId === mePlayer?.userId ? ' (you)' : ''}
                  {p.deck.trim() ? ` · ${p.deck}` : ''}
                </Text>
                <View style={[sh.radio, selected && sh.radioSelected]}>
                  {selected && <View style={sh.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={sh.footer}>
          <Pressable
            style={({ pressed }) => [sh.nextBtn, !winnerId && sh.nextBtnDisabled, pressed && { opacity: 0.8 }]}
            onPress={() => winnerId && setStep('confirm')}
            disabled={!winnerId}
          >
            <Text style={sh.nextBtnText}>Review & submit</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textInverse} />
          </Pressable>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Confirm
  // ---------------------------------------------------------------------------

  function ConfirmStep() {
    const winner = roster.find((p) => p.userId === winnerId);

    return (
      <>
        <View style={hdr.row}>
          <Pressable
            style={({ pressed }) => [hdr.back, pressed && { opacity: 0.6 }]}
            onPress={() => setStep('winner')}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={[hdr.title, { flex: 1, textAlign: 'center' }]}>Confirm game</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={sh.scroll}>
          <View style={sh.confirmCard}>
            <Text style={sh.sectionLabel}>PLAYERS</Text>
            {roster.map((p) => (
              <View key={p.userId} style={sh.confirmRow}>
                <PlayerAvatar player={p} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={sh.confirmName} numberOfLines={1}>{p.displayName}</Text>
                  {p.deck.trim() ? (
                    <Text style={sh.confirmDeck} numberOfLines={1}>{p.deck}</Text>
                  ) : null}
                </View>
                {p.userId === winnerId && (
                  <View style={sh.winBadge}>
                    <Text style={sh.winBadgeText}>Winner</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {winner && (
            <View style={sh.winnerBanner}>
              <Ionicons name="trophy-outline" size={20} color={colors.success} />
              <Text style={sh.winnerBannerText}>{winner.displayName} wins</Text>
            </View>
          )}

          <Text style={sh.confirmHint}>
            Other players will be notified to confirm. Stats update when everyone confirms.
          </Text>
        </ScrollView>

        <View style={sh.footer}>
          <Pressable
            style={({ pressed }) => [sh.nextBtn, isPending && sh.nextBtnDisabled, pressed && { opacity: 0.8 }]}
            onPress={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                <Text style={sh.nextBtnText}>Log game</Text>
              </>
            )}
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={initRoster}
      onRequestClose={onClose}
    >
      <SafeAreaView style={sh.safe}>
        <View style={sh.topBar}>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={sh.topTitle}>Log game</Text>
          <View style={{ width: 24 }} />
        </View>

        {!mePlayer ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {step === 'roster' && <RosterStep />}
            {step === 'decks' && <DecksStep />}
            {step === 'winner' && <WinnerStep />}
            {step === 'confirm' && <ConfirmStep />}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const sh = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  topTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  playerName: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  deckName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  deckInput: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  winnerRowSelected: {
    borderColor: colors.success,
    backgroundColor: colors.success + '12',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.success, backgroundColor: colors.success + '20' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  confirmName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  confirmDeck: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  winBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.success + '20',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.success + '60',
  },
  winBadgeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.success,
  },
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success + '18',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success + '50',
    padding: spacing.md,
    justifyContent: 'center',
  },
  winnerBannerText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.success,
  },
  confirmHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
