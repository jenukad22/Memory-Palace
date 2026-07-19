import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { endSession, insertAssessment, listAssessments, upsertAbility, useDb } from '../../db';
import {
  CORSI_GAP_MS,
  CORSI_ON_MS,
  CORSI_SPAN_START,
  SPAN_MAX_LENGTH,
  TRIAL_LEAD_IN_MS,
  generateCorsiSequence,
  initSpanState,
  isTrialCorrect,
  makeRng,
  normalizeSpan,
  recordSpanTrial,
  seedModuleElo,
  type SpanDirection,
  type SpanState,
} from '../../engine/assessment';
import { useBatterySession } from '../../state';
import { AppText, Button, CorsiBoard, ScreenShell, color, motion, space } from '../../ui';
import { SPAN_INSTRUMENTS, spanPayload, type SpanTrialLogEntry } from '../battery';

type Phase = 'intro' | 'display' | 'recall';

/**
 * Corsi block-tapping administration (SPEC.md sec 5) — forward then backward,
 * separate instrument rows. Engine owns the rules (start 2, two trials per
 * length, 1-of-2 reproduced, discontinue on double fail, cap 9, 1000/250 ms).
 * After the backward pass this screen finalizes the battery: memory Elo is
 * seeded from the four span instruments and the sessions row is closed
 * (accuracy stays 0 for battery sessions, SPEC.md sec 10).
 */
export function CorsiScreen() {
  const db = useDb();
  const router = useRouter();
  const [direction, setDirection] = useState<SpanDirection>('forward');
  const [phase, setPhase] = useState<Phase>('intro');
  const [seq, setSeq] = useState<number[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [dotCount, setDotCount] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [span, setSpan] = useState<SpanState>(() => initSpanState(CORSI_SPAN_START));
  const logRef = useRef<SpanTrialLogEntry[]>([]);
  const seedRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const nextSeed = () => {
    seedRef.current =
      seedRef.current === null
        ? (Date.now() ^ 0x51ed270b) >>> 0
        : (seedRef.current + 0x9e3779b9) >>> 0;
    return seedRef.current;
  };

  const runDisplay = (s: number[], i: number) => {
    setHighlightIndex(s[i]!);
    setDotCount(i + 1);
    timer.current = setTimeout(() => {
      setHighlightIndex(null);
      timer.current = setTimeout(() => {
        if (i + 1 < s.length) runDisplay(s, i + 1);
        else {
          setTaps([]);
          submitting.current = false;
          setPhase('recall');
        }
      }, CORSI_GAP_MS);
    }, CORSI_ON_MS);
  };

  const startTrial = (state: SpanState) => {
    const s = generateCorsiSequence(state.currentLength, makeRng(nextSeed()));
    setSeq(s);
    setDotCount(0);
    setHighlightIndex(null);
    setPhase('display');
    timer.current = setTimeout(() => runDisplay(s, 0), TRIAL_LEAD_IN_MS);
  };

  /** Seed the memory Elo from the four span rows, close the session, finish. */
  const finalizeBattery = () => {
    const normalized = SPAN_INSTRUMENTS.map((instrument) => {
      const rows = listAssessments(db, instrument);
      const samples = rows.map((r) => r.rawScore);
      return normalizeSpan(rows[0]!.rawScore, samples);
    });
    upsertAbility(db, 'memory', seedModuleElo(normalized));
    const { sessionId, itemsDone } = useBatterySession.getState();
    if (sessionId !== null) {
      endSession(db, sessionId, { items: itemsDone, accuracy: 0 });
    }
    useBatterySession.getState().reset();
    router.replace('/onboarding/complete');
  };

  const finishDirection = (finished: SpanState, dir: SpanDirection) => {
    insertAssessment(db, {
      instrument: dir === 'forward' ? 'corsi_forward' : 'corsi_backward',
      rawScore: finished.span,
      payload: spanPayload(logRef.current),
    });
    useBatterySession.getState().recordItem();
    if (dir === 'forward') {
      setSpan(initSpanState(CORSI_SPAN_START));
      logRef.current = [];
      setDirection('backward');
      setPhase('intro');
    } else {
      finalizeBattery();
    }
  };

  const submit = (tapped: number[]) => {
    const passed = isTrialCorrect(seq, tapped, direction);
    logRef.current.push({ length: seq.length, passed });
    const next = recordSpanTrial(span, passed, { maxLength: SPAN_MAX_LENGTH });
    setSpan(next);
    if (next.finished) finishDirection(next, direction);
    else startTrial(next);
  };

  const onTapBlock = (index: number) => {
    if (phase !== 'recall' || submitting.current) return;
    setTaps((prev) => {
      const nextTaps = [...prev, index];
      if (nextTaps.length === seq.length) {
        // Let the tap-flash play out before evaluating (classic: no feedback).
        submitting.current = true;
        timer.current = setTimeout(() => submit(nextTaps), motion.tapFlashMs);
      }
      return nextTaps;
    });
  };

  const trialNo = span.trialsAtLength.length + 1;
  const fills: [number, number, number] = [1, 1, direction === 'backward' ? 0.5 : 0];

  return (
    <ScreenShell kicker="Baseline · 3 of 3" taskName="Corsi blocks" fills={fills}>
      {phase === 'intro' ? (
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">
            {direction === 'forward' ? 'Corsi block-tapping' : 'Corsi — reversed'}
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {direction === 'forward'
              ? 'Blocks light up one at a time. When they stop, tap them back in the same order.'
              : 'Same task, reversed: when the blocks stop, tap them in reverse order — last block first.'}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={() => startTrial(span)} />
          </View>
        </View>
      ) : null}

      {phase === 'display' || phase === 'recall' ? (
        <View style={{ gap: space.sp4, paddingTop: space.sp4 }}>
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
            {phase === 'display'
              ? 'Watch'
              : direction === 'forward'
                ? 'Tap the blocks in the same order'
                : 'Tap the blocks in reverse order'}
          </AppText>
          <CorsiBoard
            phase={phase === 'recall' ? 'recall' : 'display'}
            highlightIndex={highlightIndex}
            onTapBlock={onTapBlock}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sp2 - 2 }}>
            {seq.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: (phase === 'display' ? i < dotCount : i < taps.length)
                    ? color.accent
                    : color.lineStrong,
                }}
              />
            ))}
          </View>
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
            Length {seq.length} · trial {trialNo} of 2
          </AppText>
        </View>
      ) : null}
    </ScreenShell>
  );
}
