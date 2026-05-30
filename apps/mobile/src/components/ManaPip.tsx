import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, type ManaColor } from '../theme';

interface ManaPipProps {
  color: ManaColor;
  size?: number;
  style?: ViewStyle;
}

export function ManaPip({ color, size = 24, style }: ManaPipProps) {
  return (
    <View
      style={[
        styles.pip,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.mana[color],
          borderColor: colors.manaBorder[color],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pip: {
    borderWidth: 1.5,
  },
});
