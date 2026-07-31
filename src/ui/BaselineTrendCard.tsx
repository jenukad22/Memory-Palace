import { View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { LineChart } from './LineChart';
import { space } from './tokens';

export interface BaselineSeries {
  label: string;
  history: { ts: Date; rawScore: number }[];
}

export interface BaselineTrendCardProps {
  taskLabel: string;
  series: BaselineSeries[];
  onRetake: () => void;
}

/**
 * One baseline task (VVIQ / digit span / Corsi): latest score + a sparkline
 * per raw instrument, plus a retake action. Forward/backward are shown as
 * separate sparklines rather than merged into one line — they're different
 * scales and merging them would misrepresent both.
 */
export function BaselineTrendCard({ taskLabel, series, onRetake }: BaselineTrendCardProps) {
  return (
    <Card>
      <AppText variant="bodyStrong">{taskLabel}</AppText>
      <View style={{ gap: space.sp3, paddingTop: space.sp3 }}>
        {series.map((s) => {
          const latest = s.history.at(-1);
          return (
            <View key={s.label} style={{ gap: space.sp1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="secondary" color="textSecondary">
                  {s.label}
                </AppText>
                <AppText variant="secondary" tabular>
                  {latest ? latest.rawScore : '—'}
                </AppText>
              </View>
              <LineChart
                points={s.history.map((h) => ({ x: h.ts.getTime(), y: h.rawScore }))}
                height={32}
                compact
                emptyLabel="No results yet"
              />
            </View>
          );
        })}
      </View>
      <View style={{ paddingTop: space.sp3 }}>
        <Button kind="secondary" size="sm" label="Retake" onPress={onRetake} />
      </View>
    </Card>
  );
}
