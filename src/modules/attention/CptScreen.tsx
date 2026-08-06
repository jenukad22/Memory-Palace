import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useDb } from '@/db';
import {
  CPT_DISTRACTOR_LETTER,
  CPT_RESPONSE_WINDOW_MS,
  CPT_STIMULUS_MS,
  CPT_TRIALS,
  generateCptStream,
  makeRng,
  scoreCpt,
  summarizeOnsets,
  type CptMetrics,
  type CptStimulus,
  type CptTrialResult,
  type OnsetSample,
  type TimingProfile,
} from '@/engine';
import { AppText, Button, ScreenShell, space } from '@/ui';
import { ResponsePad } from './ResponsePad';
import { StatList, type Stat } from './StatList';
import { TimingReport } from './TimingReport';
import { hasHighResolutionClock, nowMs, onNextPaint } from './clock';
import {
  CPT_HONESTY,
  DPRIME_EXPLANATION,
  formatCount,
  formatDPrime,
  formatMs,
  formatPercent,
} from './copy';
import { recordCptRun } from './results';

type Phase = 'intro' | 'running' | 'results';

/**
 * CPT go/no-go administration (SPEC.md §4.2): respond to every letter except
 * the distractor, withhold on that one.
 *
 * No trial-level feedback and no progress indicator during the block — both are
 * events competing for the attention the task is measuring. Onsets are
 * timestamped on their painted frame, as in the PVT, and only the first press
 * inside a response window counts.
 */
export function CptScreen() {
  const db = useDb();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(-1);
  /** The letter on screen. State, not a read of the stream ref, so rendering
   *  never depends on a ref the trial driver is mutating. */
  const [letter, setLetter] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState<CptMetrics | null>(null);
  const [profile, setProfile] = useState<TimingProfile | null>(null);
  const [saved, setSaved] = useState(true);

  const stream = useRef<CptStimulus[]>([]);
  const results = useRef<CptTrialResult[]>([]);
  const onsets = useRef<OnsetSample[]>([]);
  const responded = useRef(false);
  const rt = useRef<number | null>(null);
  const requestedAt = useRef(0);
  const paintedAt = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelPaint = useRef<(() => void) | null>(null);
  const phaseRef = useRef<Phase>('intro');

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      cancelPaint.current?.();
    },
    [],
  );

  const finish = useCallback(() => {
    clearTimers();
    phaseRef.current = 'results';
    const scored = scoreCpt(results.current);
    const timing = summarizeOnsets(onsets.current, {
      highResolutionClock: hasHighResolutionClock(),
    });
    setMetrics(scored);
    setProfile(timing);
    setSaved(recordCptRun(db, { metrics: scored, trials: results.current, timing }) !== null);
    setVisible(false);
    setPhase('results');
  }, [clearTimers, db]);

  // Trials chain through a ref rather than a direct self-reference, so the
  // recursion doesn't make the callback depend on its own identity.
  const runTrialRef = useRef<(i: number) => void>(() => {});
  const runTrial = useCallback(
    (i: number) => {
      const stimulus = stream.current[i];
      if (stimulus === undefined) {
        finish();
        return;
      }
      responded.current = false;
      rt.current = null;
      paintedAt.current = null;
      requestedAt.current = nowMs();
      setIndex(i);
      setLetter(stimulus.letter);
      setVisible(true);
      timers.current.push(setTimeout(() => setVisible(false), CPT_STIMULUS_MS));
      timers.current.push(
        setTimeout(() => {
          const shown = stream.current[i];
          if (shown !== undefined) {
            results.current.push({
              isTarget: shown.isTarget,
              responded: responded.current,
              rtMs: rt.current,
            });
          }
          timers.current = [];
          if (i + 1 < stream.current.length) runTrialRef.current(i + 1);
          else finish();
        }, CPT_RESPONSE_WINDOW_MS),
      );
    },
    [finish],
  );

  useEffect(() => {
    runTrialRef.current = runTrial;
  }, [runTrial]);

  // Timestamp each letter on the frame that paints it.
  useEffect(() => {
    if (!visible || phase !== 'running') return;
    cancelPaint.current = onNextPaint((paintedMs) => {
      // The run can end between requesting a letter and painting it (End run);
      // don't attribute that frame to a trial that is already scored.
      if (phaseRef.current !== 'running') return;
      paintedAt.current = paintedMs;
      onsets.current.push({ requestedMs: requestedAt.current, paintedMs });
    });
    return () => cancelPaint.current?.();
  }, [index, visible, phase]);

  const respond = useCallback((atMs: number) => {
    if (phaseRef.current !== 'running') return;
    if (responded.current) return; // only the first press in a window counts
    responded.current = true;
    const onset = paintedAt.current;
    // A press before the letter's frame painted is recorded as a response with
    // no usable time, not as a fabricated reaction time.
    rt.current = onset === null ? null : atMs - onset;
  }, []);

  const start = () => {
    stream.current = generateCptStream(makeRng((Date.now() ^ 0x2545f491) >>> 0));
    results.current = [];
    onsets.current = [];
    phaseRef.current = 'running';
    setPhase('running');
    runTrial(0);
  };

  if (phase === 'results' && metrics !== null && profile !== null) {
    return (
      <CptResults
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
    <ScreenShell kicker="Attention" taskName="CPT" scroll={phase === 'intro'}>
      {phase === 'intro' ? (
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Respond to every letter but one</AppText>
          <AppText variant="secondary" color="textSecondary">
            Letters appear one at a time. Press for every letter — anywhere in the box, or the space
            bar — except <AppText variant="bodyStrong">{CPT_DISTRACTOR_LETTER}</AppText>. When you
            see {CPT_DISTRACTOR_LETTER}, press nothing and wait for the next letter.
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {CPT_TRIALS} letters, about two and a half minutes, with no feedback along the way.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {CPT_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={start} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, paddingVertical: space.sp3, gap: space.sp3 }}>
          <ResponsePad onRespond={respond}>
            {visible && letter !== null ? (
              <AppText variant="stimulus">{letter}</AppText>
            ) : (
              <AppText variant="display" color="textMuted">
                +
              </AppText>
            )}
          </ResponsePad>
          <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
            Press for every letter except {CPT_DISTRACTOR_LETTER}
          </AppText>
          <Button kind="ghost" size="sm" label="End run" onPress={finish} />
        </View>
      )}
    </ScreenShell>
  );
}

function CptResults({
  metrics,
  profile,
  saved,
  onDone,
}: {
  metrics: CptMetrics;
  profile: TimingProfile;
  saved: boolean;
  onDone: () => void;
}) {
  const stats: Stat[] = [
    {
      label: 'd′',
      value: formatDPrime(metrics.dPrime, metrics.maxDPrime),
      headline: true,
      note: DPRIME_EXPLANATION,
    },
    {
      label: 'Targets caught',
      value: formatCount(metrics.hits, metrics.targets),
      note: `${formatPercent(metrics.hitRate)} of targets.`,
    },
    {
      label: 'Targets missed',
      value: formatCount(metrics.omissions, metrics.targets),
      note: 'Omission errors — a target went by with no press.',
    },
    {
      label: `Presses on ${CPT_DISTRACTOR_LETTER}`,
      value: formatCount(metrics.commissions, metrics.distractors),
      note: `Commission errors — ${formatPercent(metrics.commissionRate)} of the letters you were meant to withhold on.`,
    },
    { label: 'Median reaction time', value: formatMs(metrics.medianHitRtMs) },
    {
      label: 'Reaction-time spread',
      value: formatMs(metrics.rtSdMs),
      ...(metrics.rtCoefficientOfVariation === null
        ? {}
        : {
            note: `${formatPercent(metrics.rtCoefficientOfVariation)} of your mean — how steady the responding was, not how fast.`,
          }),
    },
    {
      label: 'Response bias',
      value: metrics.criterion.toFixed(2),
      note:
        metrics.criterion < 0
          ? 'Below zero: you pressed readily.'
          : 'Above zero: you withheld readily.',
    },
  ];

  return (
    <ScreenShell kicker="Attention" taskName="CPT">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">This run</AppText>
        <StatList title={`CPT · ${metrics.trials} letters`} stats={stats} footnote={CPT_HONESTY} />
        <TimingReport profile={profile} />
        {!saved ? (
          <AppText variant="secondary" color="error">
            This run had no trials, so it was not recorded.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </View>
    </ScreenShell>
  );
}
