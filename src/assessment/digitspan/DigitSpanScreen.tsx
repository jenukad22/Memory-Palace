import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { insertAssessment, useDb } from '../../db';
import {
  DIGIT_GAP_MS,
  DIGIT_ON_MS,
  DIGIT_SPAN_START,
  SPAN_MAX_LENGTH,
  TRIAL_LEAD_IN_MS,
  generateDigitSequence,
  initSpanState,
  isTrialCorrect,
  makeRng,
  recordSpanTrial,
  type SpanDirection,
  type SpanState,
} from '../../engine/assessment';
import { useBatterySession } from '../../state';
import { AppText, Button, DigitKeypad, DigitSlots, ScreenShell, color, space } from '../../ui';
import { spanPayload, type SpanTrialLogEntry } from '../battery';

type Phase = 'intro' | 'display' | 'recall';

/**
 * Digit span administration (SPEC.md sec 4) — forward then backward, stored as
 * separate instrument rows. The engine owns the rules (start 3, two trials per
 * length, 1-of-2 reproduced, discontinue on double fail, cap 9, 800/200 ms);
 * this screen presents stimuli and captures typed recall only.
 */
export function DigitSpanScreen() {
  const db = useDb();
  const router = useRouter();
  const [direction, setDirection] = useState<SpanDirection>('forward');
  const [phase, setPhase] = useState<Phase>('intro');
  const [seq, setSeq] = useState<number[]>([]);
  const [shownDigit, setShownDigit] = useState<number | null>(null);
  const [dotCount, setDotCount] = useState(0);
  const [entered, setEntered] = useState('');
  const [span, setSpan] = useState<SpanState>(() => initSpanState(DIGIT_SPAN_START));
  const logRef = useRef<SpanTrialLogEntry[]>([]);
  const seedRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const nextSeed = () => {
    seedRef.current =
      seedRef.current === null
        ? (Date.now() ^ 0x9e3779b9) >>> 0
        : (seedRef.current + 0x9e3779b9) >>> 0;
    return seedRef.current;
  };

  const runDisplay = (s: number[], i: number) => {
    setShownDigit(s[i]!);
    setDotCount(i + 1);
    timer.current = setTimeout(() => {
      setShownDigit(null);
      timer.current = setTimeout(() => {
        if (i + 1 < s.length) runDisplay(s, i + 1);
        else {
          setEntered('');
          setPhase('recall');
        }
      }, DIGIT_GAP_MS);
    }, DIGIT_ON_MS);
  };

  const startTrial = (state: SpanState) => {
    const s = generateDigitSequence(state.currentLength, makeRng(nextSeed()));
    setSeq(s);
    setDotCount(0);
    setShownDigit(null);
    setPhase('display');
    timer.current = setTimeout(() => runDisplay(s, 0), TRIAL_LEAD_IN_MS);
  };

  const finishDirection = (finished: SpanState, dir: SpanDirection) => {
    insertAssessment(db, {
      instrument: dir === 'forward' ? 'digitspan_forward' : 'digitspan_backward',
      rawScore: finished.span,
      payload: spanPayload(logRef.current),
    });
    useBatterySession.getState().recordItem();
    if (dir === 'forward') {
      setSpan(initSpanState(DIGIT_SPAN_START));
      logRef.current = [];
      setDirection('backward');
      setPhase('intro');
    } else {
      router.replace('/onboarding/checkpoint');
    }
  };

  const submit = () => {
    const passed = isTrialCorrect(
      seq,
      entered.split('').map((d) => Number(d)),
      direction,
    );
    logRef.current.push({ length: seq.length, passed });
    const next = recordSpanTrial(span, passed, { maxLength: SPAN_MAX_LENGTH });
    setSpan(next);
    if (next.finished) finishDirection(next, direction);
    else startTrial(next);
  };

  const trialNo = span.trialsAtLength.length + 1;
  const fills: [number, number, number] = [1, direction === 'backward' ? 0.5 : 0, 0];

  return (
    <ScreenShell kicker="Baseline · 2 of 3" taskName="Digit span" fills={fills}>
      {phase === 'intro' ? (
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">
            {direction === 'forward' ? 'Digit span' : 'Digit span — reversed'}
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {direction === 'forward'
              ? 'Digits appear one at a time. When they stop, enter them in the same order.'
              : 'Same task, reversed: when the digits stop, enter them in reverse order — last digit first.'}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={() => startTrial(span)} />
          </View>
        </View>
      ) : null}

      {phase === 'display' ? (
        <View style={{ alignItems: 'center', paddingTop: space.sp6 }}>
          <AppText variant="caption" color="textSecondary">
            Watch
          </AppText>
          <View style={{ height: 96, justifyContent: 'center' }}>
            <AppText variant="stimulus">{shownDigit ?? ' '}</AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sp2 - 2 }}>
            {seq.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i < dotCount ? color.accent : color.lineStrong,
                }}
              />
            ))}
          </View>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: space.sp3 }}>
            Length {seq.length} · trial {trialNo} of 2
          </AppText>
        </View>
      ) : null}

      {phase === 'recall' ? (
        <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
          <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>
            {direction === 'forward' ? 'Enter the sequence' : 'Enter in reverse order'}
          </AppText>
          <DigitSlots length={seq.length} entered={entered} />
          <DigitKeypad
            onDigit={(d) => setEntered((e) => (e.length < seq.length ? e + d : e))}
            onBackspace={() => setEntered((e) => e.slice(0, -1))}
            onClear={() => setEntered('')}
            digitsDisabled={entered.length >= seq.length}
            editDisabled={entered.length === 0}
          />
          <Button label="Submit" onPress={submit} disabled={entered.length !== seq.length} />
        </View>
      ) : null}
    </ScreenShell>
  );
}
