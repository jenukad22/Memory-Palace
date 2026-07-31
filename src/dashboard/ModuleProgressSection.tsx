import { View } from 'react-native';
import {
  AppText,
  BaselineTrendCard,
  Card,
  LineChart,
  StreakStrip,
  space,
  type BaselineSeries,
  type ChartPoint,
} from '@/ui';

export interface BaselineTaskData {
  taskLabel: string;
  series: BaselineSeries[];
  retakeRoute: string;
}

export interface ModuleProgressData {
  eloPoints: ChartPoint[];
  retentionPoints: ChartPoint[];
  streakDays: boolean[];
  streakCount: number;
  consistencyPct: number;
  baselineTasks: BaselineTaskData[];
}

export interface ModuleProgressSectionProps {
  title: string;
  data: ModuleProgressData;
  onRetake: (route: string) => void;
}

/** One module's full progress section: Elo chart, retention curve, streak, baseline tasks. */
export function ModuleProgressSection({ title, data, onRetake }: ModuleProgressSectionProps) {
  return (
    <View style={{ gap: space.sp3 }}>
      <AppText variant="heading">{title}</AppText>

      <Card>
        <AppText variant="overline" color="textSecondary">
          Ability rating over time
        </AppText>
        <View style={{ paddingTop: space.sp2 }}>
          <LineChart
            points={data.eloPoints}
            height={120}
            emptyLabel="Rate a few reviews to see this."
          />
        </View>
      </Card>

      <Card>
        <AppText variant="overline" color="textSecondary">
          Predicted retention
        </AppText>
        <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp1 }}>
          Predicted, based on your current review schedule.
        </AppText>
        <View style={{ paddingTop: space.sp2 }}>
          <LineChart
            points={data.retentionPoints}
            height={120}
            yDomain={[0, 1]}
            yFormat={(v) => `${Math.round(v * 100)}%`}
            emptyLabel="Review a few cards to see this."
          />
        </View>
      </Card>

      <Card>
        <AppText variant="overline" color="textSecondary">
          Streak
        </AppText>
        <View style={{ paddingTop: space.sp2 }}>
          <StreakStrip
            days={data.streakDays}
            streakCount={data.streakCount}
            consistencyPct={data.consistencyPct}
          />
        </View>
      </Card>

      {data.baselineTasks.map((task) => (
        <BaselineTrendCard
          key={task.taskLabel}
          taskLabel={task.taskLabel}
          series={task.series}
          onRetake={() => onRetake(task.retakeRoute)}
        />
      ))}
    </View>
  );
}
