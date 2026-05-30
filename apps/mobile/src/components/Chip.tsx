import { Pressable, View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, spacing, radii } from '../theme';

interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
}

export function Chip({ label, onPress, selected = false, style }: ChipProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          selected && styles.selected,
          pressed && styles.pressed,
          style,
        ]}
      >
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.chip, selected && styles.selected, style]}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignSelf: 'flex-start',
  },
  selected: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.accent,
  },
});
