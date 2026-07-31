import { View } from 'react-native';
import { AppText, Card, space } from '@/ui';

export interface Stat {
  label: string;
  value: string;
  /** Optional one-line note under the value — where an imputation is disclosed. */
  note?: string;
  /** Draw the value large; use for the one headline number per task. */
  headline?: boolean;
}

export interface StatListProps {
  title: string;
  stats: readonly Stat[];
  /** The honesty line for this task — always rendered, never optional. */
  footnote: string;
}

/** The shared result block for the three attention tasks. */
export function StatList({ title, stats, footnote }: StatListProps) {
  return (
    <Card>
      <AppText variant="overline" color="textSecondary">
        {title}
      </AppText>
      <View style={{ paddingTop: space.sp2, gap: space.sp2 }}>
        {stats.map((stat) => (
          <View key={stat.label}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: space.sp3,
              }}
            >
              <AppText variant={stat.headline ? 'bodyStrong' : 'secondary'} color="textSecondary">
                {stat.label}
              </AppText>
              <AppText variant={stat.headline ? 'title' : 'secondary'} tabular>
                {stat.value}
              </AppText>
            </View>
            {stat.note !== undefined ? (
              <AppText variant="caption" color="textMuted">
                {stat.note}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
      <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp3 }}>
        {footnote}
      </AppText>
    </Card>
  );
}
