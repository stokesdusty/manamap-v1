// Backward-compatible upgrade: when `manaColors` is provided (and there's no
// photo), the avatar fills with a diagonal gradient of the player's mana
// colors — matching the prototype. Existing <Avatar name uri /> calls are
// unchanged (they fall back to the plain warm-grey circle).

import { View, Image, Text, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, typography, type ManaColor } from '../theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  /** Player color identity — drives the gradient fill when no photo is set. */
  manaColors?: ManaColor[];
  size?: number;
  style?: ViewStyle;
}

function initialsOf(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ uri, name, manaColors, size = 40, style }: AvatarProps) {
  const initials = initialsOf(name);
  const radius = size * 0.32; // prototype uses a squircle, not a full circle
  const tinted = !uri && manaColors && manaColors.length > 0;
  const gradId = `av-grad-${(manaColors ?? []).join('')}-${size}`;

  // Build gradient stops. Single color → fill→dark; multi → spread fills.
  const stops =
    manaColors && manaColors.length === 1
      ? [colors.mana[manaColors[0]], colors.manaDark[manaColors[0]]]
      : (manaColors ?? []).map((c) => colors.mana[c]);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: uri ? size / 2 : radius },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <>
          {tinted && (
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                  {stops.map((c, i) => (
                    <Stop
                      key={i}
                      offset={stops.length === 1 ? `${i}` : `${i / (stops.length - 1)}`}
                      stopColor={c}
                    />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect width={size} height={size} rx={radius} ry={radius} fill={`url(#${gradId})`} />
            </Svg>
          )}
          <Text
            style={[
              styles.initials,
              { fontSize: size * 0.4, color: tinted ? colors.textInverse : colors.textSecondary },
              tinted && styles.initialsOnTint,
            ]}
          >
            {initials}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: typography.fontFamily.bold,
  },
  initialsOnTint: {
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
