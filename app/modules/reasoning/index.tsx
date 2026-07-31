import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  BASE_RATE_ITEMS_PER_RUN,
  CALIBRATION_ITEMS_PER_RUN,
  DISCONFIRMATION_PROMPTS_PER_RUN,
  HYPOTHESES_PROMPTS_PER_RUN,
} from '@/engine';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

// Reasoning training hub — one card per task (src/modules/reasoning/SPEC.md).
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
    key: 'base-rate',
    name: 'Base rates',
    blurb:
      'Estimate the real probability from a base rate and an imperfect test. Some items are phrased as percentages, some as counts — the comparison between the two is the point.',
    length: `${BASE_RATE_ITEMS_PER_RUN} items, no time limit`,
    route: '/modules/reasoning/base-rate',
  },
  {
    key: 'hypotheses',
    name: 'Generate hypotheses',
    blurb:
      'Given an ambiguous observation, list as many distinct explanations as you can before moving on.',
    length: `${HYPOTHESES_PROMPTS_PER_RUN} prompts, no time limit`,
    route: '/modules/reasoning/hypotheses',
  },
  {
    key: 'disconfirmation',
    name: 'What would disconfirm this?',
    blurb:
      'Given a claim that sounds like it explains itself, state one observation that would show it’s false, then compare against examples.',
    length: `${DISCONFIRMATION_PROMPTS_PER_RUN} claims, no time limit`,
    route: '/modules/reasoning/disconfirmation',
  },
  {
    key: 'calibration',
    name: 'Calibration',
    blurb:
      'Answer two-choice questions with a confidence rating, then see a Brier score and a calibration curve — confidence vs. actual accuracy.',
    length: `${CALIBRATION_ITEMS_PER_RUN} questions, no time limit`,
    route: '/modules/reasoning/calibration',
  },
];

export default function ReasoningHub() {
  const router = useRouter();
  return (
    <ScreenShell kicker="Training" taskName="Reasoning">
      <View style={{ gap: space.sp4, paddingTop: space.sp4 }}>
        <AppText variant="heading">Reasoning</AppText>
        <AppText variant="secondary" color="textSecondary">
          Four drills. Each reports what you did on that task in this run — an estimate’s error, a
          count of distinct entries, a self-rating, a confidence-vs-accuracy statistic — and nothing
          beyond it.
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
            <Button label="Start" onPress={() => router.push(task.route)} />
          </Card>
        ))}
      </View>
    </ScreenShell>
  );
}
