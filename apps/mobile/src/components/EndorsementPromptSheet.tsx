import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { EndorsementTag, ManaColor } from '@manamap/shared';
import { useEndorse } from '../hooks/useEndorsements';
import { ENDORSEMENT_TAG_LABELS } from './EndorsementChips';
import { Chip } from './Chip';
import { colors, radii, shadows, spacing, typography } from '../theme';

export interface EndorsableCoPlayer {
  userId: string;
  displayName: string;
  avatarColors: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  gameLogId: string;
  coPlayers: EndorsableCoPlayer[];
}

const TAGS: EndorsementTag[] = [
  'GREAT_HOST',
  'GOOD_SPORT',
  'TAUGHT_THE_FORMAT',
  'FAST_PLAYER',
  'WELL_BREWED_DECK',
  'GENEROUS',
];

function PlayerInitial({ player }: { player: EndorsableCoPlayer }) {
  const initial = player.displayName.charAt(0).toUpperCase();
  const fill =
    player.avatarColors.length > 0
      ? (colors.mana[player.avatarColors[0] as ManaColor] ?? colors.border)
      : colors.border;
  return (
    <View style={[av.root, { backgroundColor: fill }]}>
      <Text style={av.text}>{initial}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  root: {
    width: 36,
    height: 36,
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: typography.fontFamily.bold, fontSize: 16, color: colors.textInverse },
});

// "How was the table?" — fires after a game is confirmed. Each co-player gets
// at most one positive tag per game (mirrors the unique constraint on Endorsement).
export function EndorsementPromptSheet({ visible, onClose, gameLogId, coPlayers }: Props) {
  const [selections, setSelections] = useState<Record<string, EndorsementTag | undefined>>({});
  const { mutate: endorse } = useEndorse();

  function pick(userId: string, tag: EndorsementTag) {
    setSelections((prev) => ({ ...prev, [userId]: prev[userId] === tag ? undefined : tag }));
  }

  function finish() {
    for (const [userId, tag] of Object.entries(selections)) {
      if (tag) endorse({ gameLogId, toUserId: userId, tag });
    }
    setSelections({});
    onClose();
  }

  const hasAny = Object.values(selections).some(Boolean);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={finish}
    >
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <Pressable
            onPress={finish}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={s.title}>How was the table?</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.hint}>Give a shout-out to your co-players — totally optional.</Text>
          {coPlayers.map((p) => (
            <View key={p.userId} style={s.playerCard}>
              <View style={s.playerRow}>
                <PlayerInitial player={p} />
                <Text style={s.playerName} numberOfLines={1}>
                  {p.displayName}
                </Text>
              </View>
              <View style={s.tagRow}>
                {TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={ENDORSEMENT_TAG_LABELS[tag]}
                    selected={selections[p.userId] === tag}
                    onPress={() => pick(p.userId, tag)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [s.sendBtn, pressed && { opacity: 0.85 }]}
            onPress={finish}
            accessibilityRole="button"
          >
            <Text style={s.sendBtnText}>{hasAny ? 'Send' : 'Skip'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
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
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },
  hint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerName: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
  sendBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  sendBtnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});
