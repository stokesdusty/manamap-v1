import { useState } from 'react';
import {
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ManaColor } from '@manamap/shared';
import { useConnections } from '../hooks/useConnections';
import { usePlayOnlineInvite } from '../hooks/usePlayOnline';
import { colors, radii, shadows, spacing, typography } from '../theme';

type Platform_ = 'spelltable' | 'convoke';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface ConnectionOption {
  connectionId: string;
  userId: string;
  displayName: string;
  avatarColors: string[];
}

function PlayerAvatar({
  name,
  avatarColors,
  size = 36,
}: {
  name: string;
  avatarColors: string[];
  size?: number;
}) {
  const initial = name.charAt(0).toUpperCase();
  const fill =
    avatarColors.length > 0
      ? (colors.mana[avatarColors[0] as ManaColor] ?? colors.border)
      : colors.border;
  const textFill =
    avatarColors[0] === 'W' || avatarColors[0] === 'G' ? colors.textPrimary : colors.textInverse;
  return (
    <View style={[av.root, { width: size, height: size, backgroundColor: fill }]}>
      <Text style={[av.text, { color: textFill, fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  root: {
    borderRadius: radii.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { fontFamily: typography.fontFamily.bold },
});

export function PlayOnlineSheet({ visible, onClose }: Props) {
  const { data: connections } = useConnections();
  const { mutate: sendInvite, isPending } = usePlayOnlineInvite();

  const [platform, setPlatform] = useState<Platform_>('spelltable');
  const [roomLink, setRoomLink] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const options: ConnectionOption[] = (connections?.accepted ?? []).map((c) => ({
    connectionId: c.id,
    userId: c.peer.id,
    displayName: c.peer.displayName,
    avatarColors: c.peer.avatarColors as string[],
  }));

  function reset() {
    setPlatform('spelltable');
    setRoomLink('');
    setSelected(new Set());
  }

  function toggleConnection(connectionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(connectionId)) {
        next.delete(connectionId);
      } else {
        next.add(connectionId);
      }
      return next;
    });
  }

  function handleSend() {
    const connectionIds = Array.from(selected);
    if (!roomLink.trim() || connectionIds.length === 0) return;

    sendInvite(
      { platform, roomLink: roomLink.trim(), connectionIds },
      {
        onSuccess: (data) => {
          Alert.alert(
            'Invites sent!',
            `${data.sent} player${data.sent !== 1 ? 's' : ''} will receive a notification with your room link.`,
          );
          reset();
          onClose();
        },
        onError: () => {
          Alert.alert('Error', 'Could not send invites. Please try again.');
        },
      },
    );
  }

  const canSend = roomLink.trim().length > 0 && selected.size > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={reset}
      onRequestClose={onClose}
    >
      <SafeAreaView style={sh.safe}>
        {/* Top bar */}
        <View style={sh.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={sh.topTitle}>Play Online</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={sh.scroll} keyboardShouldPersistTaps="handled">
            {/* Platform picker */}
            <Text style={sh.label}>PLATFORM</Text>
            <View style={sh.platformRow}>
              <Pressable
                style={({ pressed }) => [
                  sh.platformBtn,
                  platform === 'spelltable' && sh.platformBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setPlatform('spelltable')}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={platform === 'spelltable' ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    sh.platformBtnText,
                    platform === 'spelltable' && sh.platformBtnTextActive,
                  ]}
                >
                  SpellTable
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  sh.platformBtn,
                  platform === 'convoke' && sh.platformBtnActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setPlatform('convoke')}
              >
                <Ionicons
                  name="videocam-outline"
                  size={18}
                  color={platform === 'convoke' ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[sh.platformBtnText, platform === 'convoke' && sh.platformBtnTextActive]}
                >
                  Convoke
                </Text>
              </Pressable>
            </View>

            {/* Room link */}
            <Text style={[sh.label, { marginTop: spacing.lg }]}>ROOM NAME OR INVITE LINK</Text>
            <TextInput
              style={sh.input}
              value={roomLink}
              onChangeText={setRoomLink}
              placeholder={
                platform === 'spelltable'
                  ? 'https://spelltable.wizards.com/room/...'
                  : 'Room name or invite link'
              }
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={512}
            />

            {/* Connection picker */}
            <Text style={[sh.label, { marginTop: spacing.lg }]}>
              INVITE CONNECTIONS ({selected.size} selected)
            </Text>

            {options.length === 0 ? (
              <Text style={sh.empty}>Connect with other players to invite them to your game.</Text>
            ) : (
              options.map((opt) => {
                const isSelected = selected.has(opt.connectionId);
                return (
                  <Pressable
                    key={opt.connectionId}
                    style={({ pressed }) => [
                      sh.connectionRow,
                      isSelected && sh.connectionRowSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => toggleConnection(opt.connectionId)}
                  >
                    <PlayerAvatar name={opt.displayName} avatarColors={opt.avatarColors} />
                    <Text style={sh.connectionName} numberOfLines={1}>
                      {opt.displayName}
                    </Text>
                    <View style={[sh.checkbox, isSelected && sh.checkboxSelected]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer */}
        <View style={sh.footer}>
          <Pressable
            style={({ pressed }) => [
              sh.sendBtn,
              (!canSend || isPending) && sh.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleSend}
            disabled={!canSend || isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={16} color={colors.textInverse} />
                <Text style={sh.sendBtnText}>
                  Send{' '}
                  {selected.size > 0
                    ? `to ${selected.size} player${selected.size !== 1 ? 's' : ''}`
                    : 'Invite'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
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
    fontSize: 19,
    letterSpacing: -0.38,
    color: colors.textPrimary,
  },
  scroll: { padding: spacing.xl, gap: spacing.sm, paddingBottom: 120 },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
    marginBottom: spacing.xs,
  },

  platformRow: { flexDirection: 'row', gap: spacing.sm },
  platformBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  platformBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '10',
  },
  platformBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  platformBtnTextActive: { color: colors.accent },

  input: {
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

  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xs,
  },
  connectionRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '08',
  },
  connectionName: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    letterSpacing: -0.15,
    color: colors.textPrimary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  empty: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
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
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    ...shadows.md,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});
