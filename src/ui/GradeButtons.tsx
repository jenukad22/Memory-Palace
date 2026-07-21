import { View } from 'react-native';
import type { ReviewRating } from '@/engine';
import { Button } from './Button';
import { space } from './tokens';

export interface GradeButtonsProps {
  onGrade: (rating: ReviewRating) => void;
}

const GRADES: { label: string; rating: ReviewRating }[] = [
  { label: 'Missed', rating: 'again' },
  { label: 'Hard', rating: 'hard' },
  { label: 'Good', rating: 'good' },
  { label: 'Easy', rating: 'easy' },
];

/**
 * Self-graded rating row mapping onto the FSRS four ("Missed" is a failed
 * retrieval). Shared by every active-recall drill (palace training, PAO drill,
 * daily review) so the rating vocabulary and layout stay identical everywhere.
 */
export function GradeButtons({ onGrade }: GradeButtonsProps) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sp2 }}>
      {GRADES.map((g) => (
        <View key={g.rating} style={{ flex: 1 }}>
          <Button kind="secondary" size="sm" label={g.label} onPress={() => onGrade(g.rating)} />
        </View>
      ))}
    </View>
  );
}
