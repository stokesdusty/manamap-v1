import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text } from 'react-native';
import type { EarnedBadge } from '@manamap/shared';
import { colors, radii, shadows, spacing, typography } from '../theme';

interface Props {
  badges: EarnedBadge[];
  onDismiss: () => void;
}

export function BadgeEarnedSheet({ badges, onDismiss }: Props) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const visible = badges.length > 0;
  const badge = badges[0]; // Show one at a time; user dismisses to see next

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible, badge?.id]);

  if (!badge) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View style={[styles.sheet, { transform: [{ scale }], opacity }]}>
          <Text style={styles.unlocked}>Badge unlocked!</Text>
          <Text style={styles.icon}>{badge.icon}</Text>
          <Text style={styles.name}>{badge.name}</Text>
          {badge.description ? <Text style={styles.description}>{badge.description}</Text> : null}
          {badges.length > 1 && <Text style={styles.more}>+{badges.length - 1} more</Text>}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
            onPress={onDismiss}
          >
            <Text style={styles.btnText}>Nice!</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 320,
    ...shadows.lg,
  },
  unlocked: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  icon: {
    fontSize: 64,
    lineHeight: 80,
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  more: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
  },
  btnText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.textInverse,
  },
});
