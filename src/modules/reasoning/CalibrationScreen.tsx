import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useDb } from '@/db';
import {
  CALIBRATION_ITEMS_PER_RUN,
  CONFIDENCE_LEVELS,
  calibrationCurve,
  makeRng,
  scoreCalibrationRun,
  type CalibrationRunMetrics,
} from '@/engine';
import { AppText, Button, Card, LikertScale, ScreenShell, space } from '@/ui';
import { CalibrationChart } from './CalibrationChart';
import {
  BRIER_EXPLANATION,
  CALIBRATION_CURVE_EXPLANATION,
  CALIBRATION_CURVE_OMISSION_EXPLANATION,
  CALIBRATION_HONESTY,
  formatBrier,
  formatFraction,
  formatPct,
} from './copy';
import {
  generateCalibrationRun,
  isCalibrationAnswerCorrect,
  resolveCalibrationChoice,
  type CalibrationRunEntry,
} from './calibrationBank';
import {
  allCalibrationTrials,
  recordCalibrationRun,
  type CalibrationPayloadTrial,
} from './results';

type Phase = 'intro' | 'choose' | 'confidence' | 'results';

const CONFIDENCE_OPTIONS = CONFIDENCE_LEVELS.map((level) => ({
  value: level,
  label: level === 50 ? '50% — a guess' : level === 100 ? '100% — certain' : `${level}%`,
}));

/**
 * Calibration training (SPEC.md §4.4). Pick an option, state a confidence
 * 50-100%, move on; scored with a Brier score and a reliability curve. The
 * two-choice content lives in `calibrationBank.ts`; every item there is
 * written with the correct answer as `optionA`, so `generateCalibrationRun`'s
 * per-item position swap is what stands between that and a free win from
 * always tapping the same slot (calibrationBank.ts, `CalibrationRunEntry`).
 */
export function CalibrationScreen() {
  const db = useDb();
  const router = useRouter();

  const [run, setRun] = useState<CalibrationRunEntry[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<'first' | 'second' | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [trials, setTrials] = useState<CalibrationPayloadTrial[]>([]);
  const [metrics, setMetrics] = useState<CalibrationRunMetrics | null>(null);
  const [runningCurve, setRunningCurve] = useState<ReturnType<typeof calibrationCurve>>([]);
  const [saved, setSaved] = useState(true);

  const current = run[index];

  const finish = useCallback(
    (finalTrials: CalibrationPayloadTrial[]) => {
      const scored = scoreCalibrationRun(finalTrials);
      setMetrics(scored);
      setSaved(recordCalibrationRun(db, { metrics: scored, trials: finalTrials }) !== null);
      setRunningCurve(calibrationCurve(allCalibrationTrials(db)));
      setPhase('results');
    },
    [db],
  );

  const choose = (slot: 'first' | 'second') => {
    setPicked(slot);
    setPhase('confidence');
  };

  const submitConfidence = () => {
    if (picked === null || confidence === null || current === undefined) return;
    const choice = resolveCalibrationChoice(current, picked);
    const trial: CalibrationPayloadTrial = {
      itemId: current.item.id,
      confidencePct: confidence,
      correct: isCalibrationAnswerCorrect(current.item, choice),
    };
    const next = [...trials, trial];
    setTrials(next);
    setPicked(null);
    setConfidence(null);
    if (index + 1 < run.length) {
      setIndex(index + 1);
      setPhase('choose');
    } else {
      finish(next);
    }
  };

  if (phase === 'results' && metrics !== null) {
    return (
      <CalibrationResults
        metrics={metrics}
        runningCurve={runningCurve}
        saved={saved}
        onDone={() => router.replace('/modules/reasoning')}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Reasoning" taskName="Calibration">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Rate your confidence</AppText>
          <AppText variant="secondary" color="textSecondary">
            For each question, pick an answer, then say how confident you are — from 50% (a guess)
            to 100% (certain). Confident and right pays off; confident and wrong costs more than a
            cautious guess.
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {CALIBRATION_ITEMS_PER_RUN} questions, no time limit.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {CALIBRATION_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button
              label="Start"
              onPress={() => {
                setRun(generateCalibrationRun(makeRng(Date.now() >>> 0)));
                setPhase('choose');
              }}
            />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell kicker="Reasoning" taskName="Calibration">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="caption" color="textMuted">
          Question {index + 1} of {run.length}
        </AppText>
        <Card>
          <AppText variant="body">{current?.item.prompt}</AppText>
        </Card>

        {phase === 'choose' ? (
          <View style={{ gap: space.sp2 }}>
            <Button
              label={current?.displayFirst ?? ''}
              kind="secondary"
              onPress={() => choose('first')}
            />
            <Button
              label={current?.displaySecond ?? ''}
              kind="secondary"
              onPress={() => choose('second')}
            />
          </View>
        ) : (
          <View style={{ gap: space.sp3 }}>
            <AppText variant="secondary" color="textSecondary">
              You picked: {picked === 'first' ? current?.displayFirst : current?.displaySecond}
            </AppText>
            <AppText variant="secondary" color="textSecondary">
              How confident are you?
            </AppText>
            <LikertScale options={CONFIDENCE_OPTIONS} value={confidence} onSelect={setConfidence} />
            <Button
              label={index + 1 < run.length ? 'Next question' : 'Finish'}
              onPress={submitConfidence}
              disabled={confidence === null}
            />
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

function CalibrationResults({
  metrics,
  runningCurve,
  saved,
  onDone,
}: {
  metrics: CalibrationRunMetrics;
  runningCurve: ReturnType<typeof calibrationCurve>;
  saved: boolean;
  onDone: () => void;
}) {
  return (
    <ScreenShell kicker="Reasoning" taskName="Calibration">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">This run</AppText>

        <Card>
          <AppText variant="overline" color="textSecondary">
            Brier score
          </AppText>
          <AppText variant="title" style={{ paddingTop: space.sp2 }}>
            {formatBrier(metrics.brierScore)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            lower is better · {formatFraction(metrics.correctCount, metrics.trials)} correct · mean
            confidence {formatPct(metrics.meanConfidencePct)}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp3 }}>
            {BRIER_EXPLANATION}
          </AppText>
        </Card>

        <Card>
          <AppText variant="overline" color="textSecondary">
            This run’s calibration curve
          </AppText>
          <View style={{ paddingTop: space.sp2 }}>
            <CalibrationChart buckets={metrics.curve} />
          </View>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp2 }}>
            {CALIBRATION_CURVE_EXPLANATION} {CALIBRATION_CURVE_OMISSION_EXPLANATION}
          </AppText>
        </Card>

        <Card>
          <AppText variant="overline" color="textSecondary">
            Running calibration curve
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp1 }}>
            Across every calibration run you’ve completed.
          </AppText>
          <View style={{ paddingTop: space.sp2 }}>
            <CalibrationChart buckets={runningCurve} />
          </View>
        </Card>

        <AppText variant="caption" color="textMuted">
          {CALIBRATION_HONESTY}
        </AppText>

        {!saved ? (
          <AppText variant="secondary" color="error">
            This run had no questions, so it was not recorded.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </View>
    </ScreenShell>
  );
}
