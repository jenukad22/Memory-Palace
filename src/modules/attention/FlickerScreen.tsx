import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useDb } from '@/db';
import {
  FLICKER_BLANK_MS,
  FLICKER_SCENE_MS,
  FLICKER_TIMEOUT_MS,
  FLICKER_TRIALS,
  detectionCycles,
  generateFlickerTrial,
  makeRng,
  scoreFlicker,
  summarizeOnsets,
  type FlickerMetrics,
  type FlickerTrialResult,
  type FlickerTrialSpec,
  type OnsetSample,
  type Rng,
  type TimingProfile,
} from '@/engine';
import { AppText, Button, ScreenShell, space } from '@/ui';
import { FlickerBoard } from './FlickerBoard';
import { StatList, type Stat } from './StatList';
import { TimingReport } from './TimingReport';
import { hasHighResolutionClock, nowMs, onNextPaint } from './clock';
import {
  DETECTION_EXPLANATION,
  FLICKER_HONESTY,
  formatCount,
  formatPercent,
  formatSeconds,
} from './copy';
import { recordFlickerRun } from './results';

type Phase = 'intro' | 'running' | 'between' | 'results';

/** One alternation: scene A, blank, scene A′, blank — then round again. */
const FRAME_CYCLE = ['base', 'blank', 'alternate', 'blank'] as const;
type Frame = (typeof FRAME_CYCLE)[number];

/**
 * Change-blindness flicker task (SPEC.md §4.3). Two versions of a scene
 * alternate across a blank; exactly one element differs.
 *
 * The response is a tap on the element that changed, not a "found it" button —
 * a detection that cannot be localized is not a detection. A tap on an
 * unchanged element is recorded as a false tap and the trial continues, so
 * guessing costs time rather than buying a detection.
 *
 * The trial clock starts on the frame that painted the first scene, the same
 * paint-aligned onset the reaction-time tasks use (SPEC.md §3.1).
 */
export function FlickerScreen() {
  const db = useDb();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('intro');
  const [frameIndex, setFrameIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  /** Trials finished so far — state, so the between-trials screen can render it
   *  without reading the results ref during render. */
  const [completed, setCompleted] = useState(0);
  const [spec, setSpec] = useState<FlickerTrialSpec | null>(null);
  const [lastOutcome, setLastOutcome] = useState<FlickerTrialResult | null>(null);
  const [metrics, setMetrics] = useState<FlickerMetrics | null>(null);
  const [profile, setProfile] = useState<TimingProfile | null>(null);
  const [saved, setSaved] = useState(true);

  const results = useRef<FlickerTrialResult[]>([]);
  const onsets = useRef<OnsetSample[]>([]);
  const specRef = useRef<FlickerTrialSpec | null>(null);
  const trialStart = useRef(0);
  const falseTaps = useRef(0);
  const requestedAt = useRef(0);
  // Seeded on first use, in the Start handler — never during render.
  const rng = useRef<Rng | null>(null);
  const cancelPaint = useRef<(() => void) | null>(null);
  const phaseRef = useRef<Phase>('intro');

  useEffect(() => () => cancelPaint.current?.(), []);

  const finishRun = useCallback(() => {
    phaseRef.current = 'results';
    const scored = scoreFlicker(results.current);
    const timing = summarizeOnsets(onsets.current, {
      highResolutionClock: hasHighResolutionClock(),
    });
    setMetrics(scored);
    setProfile(timing);
    setSaved(recordFlickerRun(db, { metrics: scored, trials: results.current, timing }) !== null);
    setPhase('results');
  }, [db]);

  const endTrial = useCallback(
    (outcome: FlickerTrialResult) => {
      if (phaseRef.current !== 'running') return;
      phaseRef.current = 'between';
      results.current.push(outcome);
      setLastOutcome(outcome);
      setCompleted(results.current.length);
      if (results.current.length >= FLICKER_TRIALS) finishRun();
      else setPhase('between');
    },
    [finishRun],
  );

  const startTrial = useCallback((index: number) => {
    rng.current ??= makeRng((Date.now() ^ 0x7f4a7c15) >>> 0);
    specRef.current = generateFlickerTrial(rng.current);
    setSpec(specRef.current);
    setTrialIndex(index);
    falseTaps.current = 0;
    trialStart.current = 0;
    setLastOutcome(null);
    requestedAt.current = nowMs();
    phaseRef.current = 'running';
    setFrameIndex(0);
    setPhase('running');
  }, []);

  const frame: Frame = FRAME_CYCLE[frameIndex % FRAME_CYCLE.length]!;

  // The alternation. Each frame holds for its own duration, then advances; the
  // effect's cleanup cancels the pending advance whenever the trial ends.
  useEffect(() => {
    if (phase !== 'running') return;
    const holdMs = frame === 'blank' ? FLICKER_BLANK_MS : FLICKER_SCENE_MS;
    const id = setTimeout(() => setFrameIndex((i) => i + 1), holdMs);
    return () => clearTimeout(id);
  }, [phase, frameIndex, frame]);

  // Start the trial clock on the frame that painted the first scene.
  useEffect(() => {
    if (phase !== 'running' || frameIndex !== 0) return;
    cancelPaint.current = onNextPaint((paintedMs) => {
      if (phaseRef.current !== 'running') return;
      trialStart.current = paintedMs;
      onsets.current.push({ requestedMs: requestedAt.current, paintedMs });
    });
    return () => cancelPaint.current?.();
  }, [phase, frameIndex, trialIndex]);

  // Trial timeout — a change never found is a miss, not an endless search.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setTimeout(
      () => endTrial({ detected: false, detectionMs: null, falseTaps: falseTaps.current }),
      FLICKER_TIMEOUT_MS,
    );
    return () => clearTimeout(id);
  }, [phase, trialIndex, endTrial]);

  const onTapCell = useCallback(
    (index: number) => {
      if (phaseRef.current !== 'running') return;
      const current = specRef.current;
      if (current === null) return;
      if (index !== current.changedIndex) {
        falseTaps.current += 1;
        return;
      }
      // Tapped before the first scene's frame was even timed: there is no clock
      // to read, and the user cannot have seen what they tapped. Let the trial
      // run on rather than ending it as a miss on a stray touch.
      if (trialStart.current === 0) return;
      endTrial({
        detected: true,
        detectionMs: nowMs() - trialStart.current,
        falseTaps: falseTaps.current,
      });
    },
    [endTrial],
  );

  const giveUp = useCallback(() => {
    endTrial({ detected: false, detectionMs: null, falseTaps: falseTaps.current });
  }, [endTrial]);

  if (phase === 'results' && metrics !== null && profile !== null) {
    return (
      <FlickerResults
        metrics={metrics}
        profile={profile}
        saved={saved}
        onDone={() => router.replace('/modules/attention')}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Attention" taskName="Flicker">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Find the one thing that changes</AppText>
          <AppText variant="secondary" color="textSecondary">
            A pattern flickers: two versions of it alternate with a blank in between. Exactly one
            element differs — its colour, its size, or whether it is there at all. Tap the element
            you think it is. A wrong tap costs nothing but keeps the clock running.
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {FLICKER_TRIALS} patterns, up to {Math.round(FLICKER_TIMEOUT_MS / 1000)} seconds each.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {FLICKER_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={() => startTrial(0)} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'between') {
    const found = lastOutcome !== null && lastOutcome.detected && lastOutcome.detectionMs !== null;
    return (
      <ScreenShell kicker="Attention" taskName="Flicker">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">{found ? 'Found it' : 'Not found'}</AppText>
          <AppText variant="secondary" color="textSecondary">
            {found
              ? `${formatSeconds(lastOutcome.detectionMs)} — ${detectionCycles(lastOutcome.detectionMs!)} alternations.`
              : 'That one went unfound. It counts as the full time limit.'}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button
              label={`Next pattern (${completed + 1} of ${FLICKER_TRIALS})`}
              onPress={() => startTrial(completed)}
            />
          </View>
        </View>
      </ScreenShell>
    );
  }

  const cells =
    spec === null || frame === 'blank' ? null : frame === 'base' ? spec.base : spec.alternate;

  return (
    // The board sizes itself against the leftover box (boardLayout.ts), so it
    // must not be handed a scroll container's unbounded height.
    <ScreenShell kicker="Attention" taskName="Flicker" scroll={false}>
      <View style={{ flex: 1, paddingVertical: space.sp3, gap: space.sp3 }}>
        <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
          Pattern {trialIndex + 1} of {FLICKER_TRIALS} · tap the element that changes
        </AppText>
        <FlickerBoard
          cols={spec?.cols ?? 0}
          rows={spec?.rows ?? 0}
          cells={cells}
          onTapCell={onTapCell}
        />
        <Button kind="ghost" size="sm" label="I can’t find it" onPress={giveUp} />
      </View>
    </ScreenShell>
  );
}

function FlickerResults({
  metrics,
  profile,
  saved,
  onDone,
}: {
  metrics: FlickerMetrics;
  profile: TimingProfile;
  saved: boolean;
  onDone: () => void;
}) {
  const stats: Stat[] = [
    {
      label: 'Mean time to find',
      value: formatSeconds(metrics.scoreDetectionMs),
      headline: true,
      note: DETECTION_EXPLANATION,
    },
    {
      label: 'Changes found',
      value: formatCount(metrics.detected, metrics.trials),
      note: `${formatPercent(metrics.detectionRate)} of patterns.`,
    },
    { label: 'Median time (found only)', value: formatSeconds(metrics.medianDetectionMs) },
    {
      label: 'Median alternations',
      value: metrics.medianCycles === null ? '—' : `${metrics.medianCycles}`,
    },
    {
      label: 'Taps on unchanged elements',
      value: `${metrics.falseTaps}`,
      note: 'Guesses that were not the change. They cost time, not score.',
    },
  ];

  return (
    <ScreenShell kicker="Attention" taskName="Flicker">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">This run</AppText>
        <StatList title="Flicker" stats={stats} footnote={FLICKER_HONESTY} />
        <TimingReport profile={profile} />
        {!saved ? (
          <AppText variant="secondary" color="error">
            This run had no patterns, so it was not recorded.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </View>
    </ScreenShell>
  );
}
