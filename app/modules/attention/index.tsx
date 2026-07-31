import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { CPT_TRIALS, FLICKER_TIMEOUT_MS, FLICKER_TRIALS, PVTB_DURATION_MS } from '@/engine';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

// Attention training hub — one card per task (src/modules/attention/SPEC.md).
// Each is standalone: any one can be run on its own, and the module rating is
// recomputed from whichever have results.
interface Task {
  key: string;
  name: string;
  blurb: string;
  length: string;
  route: string;
}

const TASKS: readonly Task[] = [
  {
    key: 'pvt',
    name: 'PVT-B',
    blurb:
      'Press as soon as a dot appears, at unpredictable intervals. Reports response speed, reaction times and lapses.',
    length: `${PVTB_DURATION_MS / 60000} minutes`,
    route: '/modules/attention/pvt',
  },
  {
    key: 'cpt',
    name: 'Go / no-go letters',
    blurb:
      'Respond to every letter but one, and withhold on that one. Reports targets caught, targets missed and presses you meant to hold back.',
    length: `${CPT_TRIALS} letters, about 2½ minutes`,
    route: '/modules/attention/cpt',
  },
  {
    key: 'flicker',
    name: 'Change flicker',
    blurb:
      'Two versions of a pattern alternate across a blank; one element differs. Tap the element that changes.',
    length: `${FLICKER_TRIALS} patterns, up to ${Math.round(FLICKER_TIMEOUT_MS / 1000)}s each`,
    route: '/modules/attention/flicker',
  },
];

export default function AttentionHub() {
  const router = useRouter();
  return (
    <ScreenShell kicker="Training" taskName="Attention">
      <View style={{ gap: space.sp4, paddingTop: space.sp4 }}>
        <AppText variant="heading">Attention</AppText>
        <AppText variant="secondary" color="textSecondary">
          Three timed tasks. Each reports what you did on that task in this run — reaction times in
          milliseconds, counts of what you caught and missed — and nothing beyond it.
        </AppText>
        {TASKS.map((task) => (
          <Card key={task.key}>
            <AppText variant="bodyStrong">{task.name}</AppText>
            <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp1 }}>
              {task.length}
            </AppText>
            <AppText
              variant="secondary"
              color="textSecondary"
              style={{ paddingVertical: space.sp2 }}
            >
              {task.blurb}
            </AppText>
            <Button label={`Start ${task.name}`} onPress={() => router.push(task.route)} />
          </Card>
        ))}
      </View>
    </ScreenShell>
  );
}
