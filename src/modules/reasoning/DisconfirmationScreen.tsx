import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useDb } from '@/db';
import {
  DISCONFIRMATION_PROMPTS_PER_RUN,
  makeRng,
  scoreDisconfirmationRun,
  type DisconfirmationRunMetrics,
  type SelfRating,
} from '@/engine';
import { AppText, Button, Card, InputField, LikertScale, ScreenShell, space } from '@/ui';
import {
  DISCONFIRMATION_HONESTY,
  DISCONFIRMATION_SELF_RATE_EXPLANATION,
  formatCount,
} from './copy';
import { sampleDisconfirmationClaims, type DisconfirmationClaim } from './disconfirmationBank';
import { recordDisconfirmationRun } from './results';

type Phase = 'intro' | 'answer' | 'reveal' | 'results';

const RATING_OPTIONS = [
  { value: 0, label: 'No — this would not really test the claim' },
  { value: 0.5, label: 'Partially — it would test part of it' },
  { value: 1, label: 'Yes — this would genuinely put the claim to the test' },
];

function ratingFromValue(value: number): Exclude<SelfRating, 'skipped'> {
  if (value >= 1) return 'yes';
  if (value >= 0.5) return 'partial';
  return 'no';
}

/**
 * "What would disconfirm this?" (SPEC.md §4.3). One claim at a time: type an
 * answer (or skip), then see example disconfirming conditions and self-rate
 * your own answer against them — the same active-retrieval-then-reveal shape
 * the palace/PAO drills use, but the "grade" here is explicitly the user's
 * own judgment, never the app's (SPEC.md §0).
 */
export function DisconfirmationScreen() {
  const db = useDb();
  const router = useRouter();

  const [claims, setClaims] = useState<DisconfirmationClaim[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [records, setRecords] = useState<{ claim: string; answer: string; rating: SelfRating }[]>(
    [],
  );
  const [metrics, setMetrics] = useState<DisconfirmationRunMetrics | null>(null);
  const [saved, setSaved] = useState(true);

  const current = claims[index];

  const finish = useCallback(
    (finalRecords: { claim: string; answer: string; rating: SelfRating }[]) => {
      const scored = scoreDisconfirmationRun(finalRecords.map((r) => r.rating));
      setMetrics(scored);
      setSaved(recordDisconfirmationRun(db, { metrics: scored, trials: finalRecords }) !== null);
      setPhase('results');
    },
    [db],
  );

  const reveal = () => setPhase('reveal');

  const skip = () => {
    const next = [...records, { claim: current!.claim, answer: '', rating: 'skipped' as const }];
    advance(next);
  };

  const submitRating = () => {
    if (ratingValue === null) return;
    const next = [
      ...records,
      { claim: current!.claim, answer, rating: ratingFromValue(ratingValue) },
    ];
    advance(next);
  };

  const advance = (next: typeof records) => {
    setRecords(next);
    setAnswer('');
    setRatingValue(null);
    if (index + 1 < claims.length) {
      setIndex(index + 1);
      setPhase('answer');
    } else {
      finish(next);
    }
  };

  if (phase === 'results' && metrics !== null) {
    return (
      <DisconfirmationResults
        metrics={metrics}
        saved={saved}
        onDone={() => router.replace('/modules/reasoning')}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Reasoning" taskName="Disconfirmation">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">What would prove this wrong?</AppText>
          <AppText variant="secondary" color="textSecondary">
            Each claim sounds like it explains itself. Write one observation that would show it’s
            false — then compare your answer to some examples and rate it yourself.
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {DISCONFIRMATION_PROMPTS_PER_RUN} claims, no time limit.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {DISCONFIRMATION_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button
              label="Start"
              onPress={() => {
                setClaims(sampleDisconfirmationClaims(makeRng(Date.now() >>> 0)));
                setPhase('answer');
              }}
            />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell kicker="Reasoning" taskName="Disconfirmation">
      <ScrollView contentContainerStyle={{ gap: space.sp4, paddingVertical: space.sp4 }}>
        <AppText variant="caption" color="textMuted">
          Claim {index + 1} of {claims.length}
        </AppText>
        <Card>
          <AppText variant="body">{current?.claim}</AppText>
        </Card>

        {phase === 'answer' ? (
          <View style={{ gap: space.sp3 }}>
            <InputField
              value={answer}
              onChangeText={setAnswer}
              placeholder="What would show this is false?"
              multiline
              style={{ height: 96, paddingTop: space.sp3, textAlignVertical: 'top' }}
            />
            <Button label="Reveal examples" onPress={reveal} disabled={answer.trim() === ''} />
            <Button kind="ghost" size="sm" label="Skip this one" onPress={skip} />
          </View>
        ) : (
          <View style={{ gap: space.sp3 }}>
            <Card>
              <AppText variant="overline" color="textSecondary">
                Your answer
              </AppText>
              <AppText variant="secondary" style={{ paddingTop: space.sp1 }}>
                {answer}
              </AppText>
            </Card>
            <Card>
              <AppText variant="overline" color="textSecondary">
                Example disconfirming conditions
              </AppText>
              <View style={{ paddingTop: space.sp2, gap: space.sp2 }}>
                {current?.examples.map((example, i) => (
                  <AppText key={i} variant="secondary" color="textSecondary">
                    • {example}
                  </AppText>
                ))}
              </View>
            </Card>
            <AppText variant="secondary" color="textSecondary">
              {DISCONFIRMATION_SELF_RATE_EXPLANATION}
            </AppText>
            <LikertScale options={RATING_OPTIONS} value={ratingValue} onSelect={setRatingValue} />
            <Button
              label={index + 1 < claims.length ? 'Next claim' : 'Finish'}
              onPress={submitRating}
              disabled={ratingValue === null}
            />
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function DisconfirmationResults({
  metrics,
  saved,
  onDone,
}: {
  metrics: DisconfirmationRunMetrics;
  saved: boolean;
  onDone: () => void;
}) {
  return (
    <ScreenShell kicker="Reasoning" taskName="Disconfirmation">
      <ScrollView contentContainerStyle={{ gap: space.sp4, paddingVertical: space.sp4 }}>
        <AppText variant="title">This run</AppText>
        <Card>
          <AppText variant="overline" color="textSecondary">
            Self-rated disconfirmation
          </AppText>
          <AppText variant="title" style={{ paddingTop: space.sp2 }}>
            {formatCount(metrics.meanSelfScore, 2)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            mean self-score (0 = no, 1 = yes), out of {metrics.rated} rated
          </AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingTop: space.sp3 }}>
            Yes: {metrics.yesCount} · Partial: {metrics.partialCount} · No: {metrics.noCount}
            {metrics.skipped > 0 ? ` · Skipped: ${metrics.skipped}` : ''}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp3 }}>
            {DISCONFIRMATION_HONESTY}
          </AppText>
        </Card>
        {!saved ? (
          <AppText variant="secondary" color="error">
            Every claim was skipped, so nothing was self-rated to record.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </ScrollView>
    </ScreenShell>
  );
}
