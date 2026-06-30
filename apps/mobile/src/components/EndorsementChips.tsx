import { StyleSheet, Text, View } from 'react-native';
import type { EndorsementSummary, EndorsementTag } from '@manamap/shared';
import { colors, radii, spacing, typography } from '../theme';

export const ENDORSEMENT_TAG_LABELS: Record<EndorsementTag, string> = {
  GREAT_HOST: 'Great host',
  GOOD_SPORT: 'Good sport',
  TAUGHT_THE_FORMAT: 'Taught the format',
  FAST_PLAYER: 'Fast player',
  WELL_BREWED_DECK: 'Well-brewed deck',
  GENEROUS: 'Generous',
};

interface EndorsementChipsProps {
  summary?: EndorsementSummary;
}

export function EndorsementChips({ summary }: EndorsementChipsProps) {
  if (!summary || summary.total === 0) return null;

  const sorted = [...summary.byTag].sort((a, b) => b.count - a.count);

  return (
    <View style={styles.row}>
      {sorted.map((t) => (
        <View key={t.tag} style={styles.chip}>
          <Text style={styles.text}>
            {ENDORSEMENT_TAG_LABELS[t.tag]} ×{t.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.accentLight,
    borderRadius: radii.full,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.accentInk,
  },
});
