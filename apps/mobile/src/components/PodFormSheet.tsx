import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ConnectionsList } from '@manamap/shared';
import type { PodFormPlayer } from '../navigation/types';
import { Avatar } from './Avatar';
import type { ManaColor } from '../theme';
import { colors, radii, spacing, typography } from '../theme';

interface Props {
  visible: boolean;
  myProfile: { id: string; displayName: string; avatarColors: string[] };
  connections: ConnectionsList | undefined;
  onStartGame: (players: PodFormPlayer[]) => void;
  onClose: () => void;
}

const GUEST_COLORS: string[][] = [['R'], ['U'], ['G'], ['W'], ['B'], ['R', 'G'], ['U', 'B']];
let guestColorIdx = 0;

export function PodFormSheet({ visible, myProfile, connections, onStartGame, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([myProfile.id]);
  const [guests, setGuests] = useState<PodFormPlayer[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [search, setSearch] = useState('');

  const accepted = connections?.accepted ?? [];
  const connPlayers: PodFormPlayer[] = accepted.map((c) => ({
    id: c.peer.id,
    displayName: c.peer.displayName,
    avatarColors: c.peer.avatarColors,
    isGuest: false,
  }));

  const filtered = connPlayers.filter(
    (p) => !search.trim() || p.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  const me: PodFormPlayer = {
    id: myProfile.id,
    displayName: myProfile.displayName,
    avatarColors: myProfile.avatarColors,
    isGuest: false,
  };

  const allAvailable = [me, ...connPlayers, ...guests];
  const podPlayers = selectedIds
    .map((id) => allAvailable.find((p) => p.id === id))
    .filter((p): p is PodFormPlayer => Boolean(p));

  const isFull = podPlayers.length >= 4;
  const canStart = podPlayers.length >= 2;

  const toggle = (id: string) => {
    if (id === myProfile.id) return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const addGuest = () => {
    const name = guestInput.trim();
    if (!name || isFull) return;
    const id = `guest-${Date.now()}`;
    const avatarColors = GUEST_COLORS[guestColorIdx % GUEST_COLORS.length] ?? [];
    guestColorIdx++;
    const guest: PodFormPlayer = { id, displayName: name, avatarColors, isGuest: true };
    setGuests((gs) => [...gs, guest]);
    setSelectedIds((s) => [...s, id]);
    setGuestInput('');
  };

  const removePlayer = (id: string) => {
    if (id === myProfile.id) return;
    setGuests((gs) => gs.filter((g) => g.id !== id));
    setSelectedIds((s) => s.filter((x) => x !== id));
  };

  const handleClose = () => {
    setSelectedIds([myProfile.id]);
    setGuests([]);
    setGuestInput('');
    setSearch('');
    onClose();
  };

  const handleStart = () => {
    if (!canStart) return;
    const players = podPlayers;
    handleClose();
    onStartGame(players);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={s.root}>
        <View style={s.header}>
          <View style={s.handle} />
          <Text style={s.title}>Form a Pod</Text>
          <Text style={s.sub}>Add from your contacts or invite a guest.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rosterScroll} contentContainerStyle={s.rosterContent}>
            {podPlayers.map((p) => (
              <View key={p.id} style={s.chip}>
                <Avatar name={p.displayName} manaColors={p.avatarColors as ManaColor[]} size={26} />
                <Text style={s.chipName} numberOfLines={1}>
                  {p.id === myProfile.id ? 'You' : p.displayName.split(' ')[0]}
                </Text>
                {p.id !== myProfile.id && (
                  <Pressable onPress={() => removePlayer(p.id)} hitSlop={6}>
                    <Ionicons name="close" size={13} color={colors.accent} />
                  </Pressable>
                )}
              </View>
            ))}
            {!canStart && <Text style={s.rosterHint}>Add at least one more player</Text>}
            {isFull && <Text style={s.rosterHint}>Pod full · 4 max</Text>}
          </ScrollView>
        </View>

        <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts…"
            placeholderTextColor={colors.textTertiary}
          />
          {connPlayers.length === 0 ? (
            <Text style={s.emptyHint}>No contacts yet — add a guest below</Text>
          ) : filtered.length === 0 ? (
            <Text style={s.emptyHint}>No match for "{search}"</Text>
          ) : (
            <View style={s.list}>
              {filtered.map((p, i) => {
                const isIn = selectedIds.includes(p.id);
                const disabled = isFull && !isIn;
                return (
                  <Pressable
                    key={p.id}
                    style={[s.row, i > 0 && s.rowBorder, disabled && s.rowDisabled]}
                    onPress={() => !disabled && toggle(p.id)}
                  >
                    <Avatar name={p.displayName} manaColors={p.avatarColors as ManaColor[]} size={42} />
                    <View style={s.rowText}>
                      <Text style={s.rowName}>{p.displayName}</Text>
                    </View>
                    <View style={[s.check, isIn && s.checkActive]}>
                      {isIn && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={s.guestSection}>
            <Text style={s.guestLabel}>Add a non-user</Text>
            <View style={s.guestRow}>
              <TextInput
                style={[s.searchInput, s.guestInput]}
                value={guestInput}
                onChangeText={setGuestInput}
                onSubmitEditing={addGuest}
                placeholder="Player name…"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                maxLength={30}
              />
              <Pressable
                style={[s.addBtn, (!guestInput.trim() || isFull) && s.addBtnDisabled]}
                onPress={addGuest}
                disabled={!guestInput.trim() || isFull}
              >
                <Text style={[s.addBtnText, (!guestInput.trim() || isFull) && s.addBtnTextDisabled]}>Add</Text>
              </Pressable>
            </View>
            {guests.map((g) => (
              <View key={g.id} style={s.guestItem}>
                <View style={s.guestDot} />
                <Text style={s.guestItemName}>{g.displayName}</Text>
                <View style={s.guestTag}><Text style={s.guestTagText}>Guest</Text></View>
                <Pressable onPress={() => removePlayer(g.id)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable style={[s.startBtn, !canStart && s.startBtnDisabled]} onPress={handleStart} disabled={!canStart}>
            <Text style={[s.startBtnText, !canStart && s.startBtnTextDisabled]}>
              {canStart ? `Start Game · ${podPlayers.length} players →` : 'Add at least 2 players'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingTop: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontFamily: typography.fontFamily.bold, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: typography.fontFamily.semiBold, fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 14, lineHeight: 20 },
  rosterScroll: { flexGrow: 0 },
  rosterContent: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 38 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent + '22', borderWidth: 1.5, borderColor: colors.accent, borderRadius: radii.full, paddingLeft: 6, paddingRight: 10, paddingVertical: 5 },
  chipName: { fontFamily: typography.fontFamily.bold, fontSize: 13, color: colors.accent, maxWidth: 80 },
  rosterHint: { fontFamily: typography.fontFamily.semiBold, fontSize: 13, color: colors.textTertiary, alignSelf: 'center' },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  searchInput: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 15, paddingVertical: 13, fontFamily: typography.fontFamily.semiBold, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md },
  emptyHint: { textAlign: 'center', fontFamily: typography.fontFamily.semiBold, fontSize: 13.5, color: colors.textTertiary, paddingVertical: 10 },
  list: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  rowDisabled: { opacity: 0.4 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: typography.fontFamily.bold, fontSize: 14.5, color: colors.textPrimary },
  check: { width: 26, height: 26, borderRadius: radii.full, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  guestSection: { paddingBottom: 80 },
  guestLabel: { fontFamily: typography.fontFamily.bold, fontSize: 12, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  guestRow: { flexDirection: 'row', gap: 9 },
  guestInput: { flex: 1, marginBottom: 0 },
  addBtn: { height: 50, paddingHorizontal: 18, backgroundColor: colors.accent, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  addBtnDisabled: { backgroundColor: colors.chipBg },
  addBtnText: { fontFamily: typography.fontFamily.bold, fontSize: 14, color: colors.textInverse },
  addBtnTextDisabled: { color: colors.textTertiary },
  guestItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: spacing.md, backgroundColor: colors.chipBg, borderRadius: radii.md },
  guestDot: { width: 8, height: 8, borderRadius: radii.full, backgroundColor: colors.accent, flexShrink: 0 },
  guestItemName: { flex: 1, fontFamily: typography.fontFamily.bold, fontSize: 14, color: colors.textPrimary },
  guestTag: { backgroundColor: colors.border, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 2 },
  guestTagText: { fontFamily: typography.fontFamily.bold, fontSize: 11.5, color: colors.textTertiary },
  footer: { padding: spacing.xl, paddingBottom: 48 },
  startBtn: { height: 54, backgroundColor: colors.accent, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  startBtnDisabled: { backgroundColor: colors.chipBg, shadowOpacity: 0, elevation: 0 },
  startBtnText: { fontFamily: typography.fontFamily.bold, fontSize: 16, color: colors.textInverse },
  startBtnTextDisabled: { color: colors.textTertiary },
});
