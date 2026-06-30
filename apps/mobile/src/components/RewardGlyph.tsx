// Custom reward mark — gift box + sparkle, stroke-drawn to match the app's
// outline icon set (Ionicons-style stroke weight) instead of an emoji.
// Tinted by the caller (store accent, falling back to brand) and backed by
// a soft radial glow in the same color, echoing ManaPip's gradient treatment.

import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Rect, Line } from 'react-native-svg';

interface RewardGlyphProps {
  color: string;
  size?: number;
  style?: ViewStyle;
}

export function RewardGlyph({ color, size = 56, style }: RewardGlyphProps) {
  const gradId = `reward-glow-${color.replace('#', '')}`;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="48%" r="60%">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={12} cy={12} r={12} fill={`url(#${gradId})`} />

        <Path
          d="M20 12v10H4V12"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Rect
          x={2}
          y={7}
          width={20}
          height={5}
          rx={1}
          stroke={color}
          strokeWidth={1.75}
          fill="none"
        />
        <Line
          x1={12}
          y1={22}
          x2={12}
          y2={7}
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
        />
        <Path
          d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          fill="none"
        />

        <Path d="M19 1l.6 1.9 1.9.6-1.9.6L19 6l-.6-1.9-1.9-.6 1.9-.6z" fill={color} />
      </Svg>
    </View>
  );
}
