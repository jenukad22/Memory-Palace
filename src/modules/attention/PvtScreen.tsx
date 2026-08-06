import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useDb } from '@/db';
import {
  PVTB_DURATION_MS,
  PVTB_FEEDBACK_MS,
  PVTB_LAPSE_MS,
  PVTB_MAX_STIMULUS_MS,
  classifyPvtPress,
  isPvtRunOver,
  makeRng,
  nextIsiMs,
  scorePvt,
  summarizeOnsets,
  type OnsetSample,
  type PvtMetrics,
  type PvtTrial,
  type Rng,
  type TimingProfile,
} from '@/engine';
import { AppText, Button, ScreenShell, color, space } from '@/ui';
import { ResponsePad } from './ResponsePad';
import { StatList, type Stat } from './StatList';
import { TimingReport } from './TimingReport';
import { hasHighResolutionClock, nowMs, onNextPaint } from './clock';
import {
  LAPSE_EXPLANATION,
  NON_RESPONSE_EXPLANATION,
  PVT_HONESTY,
  formatCount,
  formatMs,
  formatPercent,
  formatSpeed,
} from './copy';
import { recordPvtRun } from './results';

type Phase = 'intro' | 'waiting' | 'stimulus' | 'feedback' | 'results';
type Feedback = { kind: 'rt'; rtMs: number } | { kind: 'tooSoon' } | { kind: 'missed' };

/**
 * PVT-B administration (SPEC.md §4.1). Three minutes of simple reaction time to
 * an unpredictable stimulus.
 *
 * The measurement discipline lives here, not in the scoring:
 * - the stimulus onset is timestamped on the frame that painted it
 *   (`onNextPaint`), so a late timer shifts the trial rather than inflating the
 *   reaction time (SPEC.md §3.1);
 * - there is no live millisecond counter during the stimulus — re-rendering
 *   text at 60 fps competes with input handling on the same thread and would
 *   inflate the number being measured (SPEC.md §3.4). The RT is shown after the
 *   press instead;
 * - trials, onset samples and phase live in refs, so nothing in the response
 *   path depends on a re-render having landed.
 */
export function PvtScreen() {
  const db = useDb();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('intro');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [remainingMs, setRemainingMs] = useState(PVTB_DURATION_MS);
  const [metrics, setMetrics] = useState<PvtMetrics | null>(null);
  const [profile, setProfile] = useState<TimingProfile | null>(null);
  const [saved, setSaved] = useState(true);

  const trials = useRef<PvtTrial[]>([]);
  const onsets = useRef<OnsetSample[]>([]);
  const runStart = useRef(0);
  const requestedAt = useRef(0);
  const paintedAt = useRef<number | null>(null);
  // Seeded on first use, in the Start handler — never during render, where a
  // clock read would be a new value on every re-render.
  const rng = useRef<Rng | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPaint = useRef<(() => void) | null>(null);
  const phaseRef = useRef<Phase>('intro');

  const setPhaseNow = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      cancelPaint.current?.();
    },
    [],
  );

  const finish = useCallback(() => {
    clearTimer();
    const scored = scorePvt(trials.current);
    const timing = summarizeOnsets(onsets.current, {
      highResolutionClock: hasHighResolutionClock(),
    });
    setMetrics(scored);
    setProfile(timing);
    // An unscorable run is never written as if it were a result (results.ts).
    setSaved(recordPvtRun(db, { metrics: scored, trials: trials.current, timing }) !== null);
    setPhaseNow('results');
  }, [clearTimer, db, setPhaseNow]);

  const startTrial = useCallback(() => {
    const generator = rng.current;
    if (generator === null) return; // unreachable: start() seeds it first
    if (isPvtRunOver(nowMs() - runStart.current)) {
      finish();
      return;
    }
    setRemainingMs(Math.max(0, PVTB_DURATION_MS - (nowMs() - runStart.current)));
    paintedAt.current = null;
    setPhaseNow('waiting');
    const isi = nextIsiMs(generator);
    timer.current = setTimeout(() => {
      // Clock read immediately before the update that shows the stimulus; the
      // gap to the painted frame is this run's measured onset delay.
      requestedAt.current = nowMs();
      setPhaseNow('stimulus');
    }, isi);
  }, [finish, setPhaseNow]);

  const showFeedback = useCallback(
    (next: Feedback) => {
      clearTimer();
      setFeedback(next);
      setPhaseNow('feedback');
      timer.current = setTimeout(startTrial, PVTB_FEEDBACK_MS);
    },
    [clearTimer, setPhaseNow, startTrial],
  );

  // Timestamp the onset on the frame that paints it, and only then start the
  // no-response timer — so the 3 s window runs from what the user actually saw.
  useEffect(() => {
    if (phase !== 'stimulus') return;
    cancelPaint.current = onNextPaint((paintedMs) => {
      // The trial can already be over: a press lands in the ~1 frame between
      // requesting the stimulus and painting it, React re-renders, and this
      // callback still runs before the effect cleanup cancels it. Without this
      // guard it would overwrite the feedback timer's handle with a
      // no-response timer, losing one and firing the other into the next trial.
      if (phaseRef.current !== 'stimulus') return;
      paintedAt.current = paintedMs;
      onsets.current.push({ requestedMs: requestedAt.current, paintedMs });
      timer.current = setTimeout(() => {
        if (phaseRef.current !== 'stimulus') return;
        trials.current.push({ rtMs: null, preStimulus: false });
        showFeedback({ kind: 'missed' });
      }, PVTB_MAX_STIMULUS_MS);
    });
    return () => cancelPaint.current?.();
  }, [phase, showFeedback]);

  const respond = useCallback(
    (atMs: number) => {
      // What a press means is engine logic (classifyPvtPress), not screen logic:
      // it decides whether a press before the stimulus' frame painted counts as
      // an anticipation, and it never times a reaction from anything but the
      // painted frame.
      const phaseNow = phaseRef.current;
      const press = classifyPvtPress(
        phaseNow === 'waiting' ? 'interval' : phaseNow === 'stimulus' ? 'stimulus' : 'inactive',
        atMs,
        paintedAt.current,
      );
      if (press.kind === 'ignored') return;
      trials.current.push(press.trial);
      showFeedback(
        press.trial.rtMs === null ? { kind: 'tooSoon' } : { kind: 'rt', rtMs: press.trial.rtMs },
      );
    },
    [showFeedback],
  );

  const start = () => {
    rng.current = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
    trials.current = [];
    onsets.current = [];
    runStart.current = nowMs();
    startTrial();
  };

  if (phase === 'results' && metrics !== null && profile !== null) {
    return (
      <PvtResults
        metrics={metrics}
        profile={profile}
        saved={saved}
        onDone={() => router.replace('/modules/attention')}
      />
    );
  }

  return (
    // The running phase is a flex:1 response pad measured against the box it is
    // given; only the intro reads as a page and scrolls.
    <ScreenShell kicker="Attention" taskName="PVT-B" scroll={phase === 'intro'}>
      {phase === 'intro' ? (
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Three minutes of reaction time</AppText>
          <AppText variant="secondary" color="textSecondary">
            A dot appears at unpredictable intervals. Press as soon as you see it — anywhere in the
            box, or the space bar. Pressing before it appears is recorded as a false start, so wait
            for it rather than guessing the rhythm.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {PVT_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={start} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, paddingVertical: space.sp3, gap: space.sp3 }}>
          <ResponsePad onRespond={respond}>
            {phase === 'stimulus' ? (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: color.accent,
                }}
              />
            ) : phase === 'feedback' && feedback !== null ? (
              <FeedbackText feedback={feedback} />
            ) : (
              <AppText variant="display" color="textMuted">
                +
              </AppText>
            )}
          </ResponsePad>
          <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
            {phase === 'feedback'
              ? `${Math.ceil(remainingMs / 1000)}s left`
              : 'Press as soon as the dot appears'}
          </AppText>
          {/* Ends the run and scores the trials done so far — a short run is
              reported as a short run, never padded out. */}
          <Button kind="ghost" size="sm" label="End run" onPress={finish} />
        </View>
      )}
    </ScreenShell>
  );
}

function FeedbackText({ feedback }: { feedback: Feedback }) {
  if (feedback.kind === 'tooSoon') {
    return (
      <AppText variant="title" color="error">
        Too soon
      </AppText>
    );
  }
  if (feedback.kind === 'missed') {
    return (
      <AppText variant="title" color="textMuted">
        No response
      </AppText>
    );
  }
  return (
    <AppText
      variant="stimulus"
      color={feedback.rtMs >= PVTB_LAPSE_MS ? 'textSecondary' : 'textPrimary'}
    >
      {Math.round(feedback.rtMs)}
    </AppText>
  );
}

function PvtResults({
  metrics,
  profile,
  saved,
  onDone,
}: {
  metrics: PvtMetrics;
  profile: TimingProfile;
  saved: boolean;
  onDone: () => void;
}) {
  const stats: Stat[] = [
    {
      label: 'Response speed',
      value: formatSpeed(metrics.responseSpeed),
      headline: true,
      note: 'Mean of 1/reaction time across this run.',
    },
    { label: 'Median reaction time', value: formatMs(metrics.medianRtMs) },
    { label: 'Fastest tenth', value: formatMs(metrics.fastest10PctMeanRtMs) },
    { label: 'Slowest tenth', value: formatMs(metrics.slowest10PctMeanRtMs) },
    {
      label: `Lapses (≥ ${PVTB_LAPSE_MS} ms)`,
      value: formatCount(metrics.lapses, metrics.scoredTrials),
      note: `${formatPercent(metrics.lapseRate)} of scored trials. ${LAPSE_EXPLANATION}`,
    },
    {
      label: 'False starts',
      value: formatCount(metrics.falseStarts, metrics.trials),
      note: 'Presses before the dot appeared. Excluded from the times above.',
    },
    ...(metrics.noResponses > 0
      ? [
          {
            label: 'No response',
            value: formatCount(metrics.noResponses, metrics.trials),
            note: NON_RESPONSE_EXPLANATION,
          },
        ]
      : []),
  ];

  return (
    <ScreenShell kicker="Attention" taskName="PVT-B">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">This run</AppText>
        <StatList title="PVT-B" stats={stats} footnote={PVT_HONESTY} />
        <TimingReport profile={profile} />
        {!saved ? (
          <AppText variant="secondary" color="error">
            Nothing in this run could be scored, so it was not recorded.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </View>
    </ScreenShell>
  );
}
