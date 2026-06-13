// Upgraded to match the prototype pip: radial sheen + ring + the WUBRG letter.
// Uses react-native-svg (already a dependency). Backward-compatible API —
// existing <ManaPip color="U" /> call sites keep working and now render richer.

import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { colors, type ManaColor } from '../theme';

interface ManaPipProps {
  color: ManaColor;
  size?: number;
  /** Show the W/U/B/R/G letter inside the pip. Default true. */
  showLetter?: boolean;
  /** Draw the inset ring. Default true. */
  ring?: boolean;
  style?: ViewStyle;
}

export function ManaPip({
  color,
  size = 24,
  showLetter = true,
  ring = true,
  style,
}: ManaPipProps) {
  const gradId = `mana-grad-${color}`;
  const stroke = ring ? 1.5 : 0;
  const r = (size - stroke) / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradId} cx="32%" cy="28%" r="75%">
            <Stop offset="0" stopColor={colors.manaLight[color]} />
            <Stop offset="0.6" stopColor={colors.mana[color]} />
            <Stop offset="1" stopColor={colors.manaDark[color]} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={`url(#${gradId})`}
          stroke={ring ? colors.manaBorder[color] : 'none'}
          strokeWidth={stroke}
        />
      </Svg>
      {showLetter && (
        <View style={styles.letterWrap} pointerEvents="none">
          <Text
            style={[
              styles.letter,
              { color: colors.manaLetter[color], fontSize: size * 0.5 },
            ]}
          >
            {color}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  letterWrap: {
    ...StyleSheet.absoluteFill as object,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '800',
    letterSpacing: -0.3,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
