import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { STRATEGY_FIT_LINE, strategyCopy } from '@/assessment/vviq';
import { getVviqStrategy, listAssessments, useDb } from '@/db';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

// Baseline results. Every figure is the raw task result — a span, a rating
// total — reported for that task only (SPEC.md sec 0). The training-path card
// is where the VVIQ routing outcome (sec 8) surfaces: the strategy derives
// from the most recent VVIQ row via getVviqStrategy, so a retake supersedes.
export default function CompleteRoute() {
  const db = useDb();
  const router = useRouter();

  const results = useMemo(() => {
    const latest = (instrument: string) => listAssessments(db, instrument)[0]?.rawScore ?? null;
    return {
      vviq: latest('vviq'),
      digitF: latest('digitspan_forward'),
      digitB: latest('digitspan_backward'),
      corsiF: latest('corsi_forward'),
      corsiB: latest('corsi_backward'),
      strategy: getVviqStrategy(db),
    };
  }, [db]);

  const path = results.strategy === null ? null : strategyCopy(results.strategy);

  return (
    <ScreenShell kicker="Baseline · complete" fills={[1, 1, 1]}>
      <View style={{ gap: space.sp3, paddingTop: space.sp4 }}>
        <AppText variant="title">Baseline complete</AppText>

        <Card>
          <AppText variant="overline" color="textSecondary">
            Digit span
          </AppText>
          <AppText variant="body" tabular style={{ marginTop: space.sp1 }}>
            Forward {results.digitF ?? '—'} · Backward {results.digitB ?? '—'}
          </AppText>
        </Card>

        <Card>
          <AppText variant="overline" color="textSecondary">
            Corsi blocks
          </AppText>
          <AppText variant="body" tabular style={{ marginTop: space.sp1 }}>
            Forward {results.corsiF ?? '—'} · Backward {results.corsiB ?? '—'}
          </AppText>
        </Card>

        <Card>
          <AppText variant="overline" color="textSecondary">
            Imagery rating
          </AppText>
          <AppText variant="body" tabular style={{ marginTop: space.sp1 }}>
            {results.vviq ?? '—'} of 80
          </AppText>
        </Card>

        {path !== null ? (
          <Card>
            <AppText variant="overline" color="textSecondary">
              {path.heading}
            </AppText>
            <AppText variant="secondary" color="textSecondary" style={{ marginTop: space.sp1 }}>
              {path.body}
            </AppText>
            <AppText variant="caption" color="textSecondary" style={{ marginTop: space.sp2 }}>
              {STRATEGY_FIT_LINE}
            </AppText>
          </Card>
        ) : null}

        <View style={{ paddingTop: space.sp2 }}>
          <Button label="Back to dashboard" onPress={() => router.replace('/')} />
        </View>
      </View>
    </ScreenShell>
  );
}
