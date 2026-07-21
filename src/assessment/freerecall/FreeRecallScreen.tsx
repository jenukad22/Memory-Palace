import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { insertAssessment, useDb } from '@/db';
import { FREE_RECALL_GAP_MS, FREE_RECALL_WORD_ON_MS, scoreFreeRecall } from '@/engine';
import { AppText, Button, InputField, ScreenShell, space } from '@/ui';

type Phase = 'intro' | 'study' | 'recall' | 'summary';

export interface FreeRecallScreenProps {
  /** The fixed word list to study, in study order — the caller samples it (generic paradigm; see SPEC.md §7.6). */
  words: string[];
  /** assessments.instrument to write the result under (e.g. 'freerecall_pre'). */
  instrument: string;
  onDone: (rawScore: number) => void;
}

/**
 * Generic free-recall paradigm: a word list is studied one word at a time,
 * then the user free-types every word they remember, in any order. Presents
 * and captures only — sampling and scoring are engine/assessment/freeRecall.ts.
 */
export function FreeRecallScreen({ words, instrument, onDone }: FreeRecallScreenProps) {
  const db = useDb();
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [shownWord, setShownWord] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [recalled, setRecalled] = useState<string[]>([]);
  const [scoreCount, setScoreCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const runStudy = (i: number) => {
    setIndex(i);
    setShownWord(words[i]!);
    timer.current = setTimeout(() => {
      setShownWord(null);
      timer.current = setTimeout(() => {
        if (i + 1 < words.length) runStudy(i + 1);
        else setPhase('recall');
      }, FREE_RECALL_GAP_MS);
    }, FREE_RECALL_WORD_ON_MS);
  };

  const startStudy = () => {
    setPhase('study');
    runStudy(0);
  };

  const addWord = () => {
    const w = entry.trim();
    if (!w) return;
    setRecalled((r) => [...r, w]);
    setEntry('');
  };

  const removeWord = (i: number) => {
    setRecalled((r) => r.filter((_, idx) => idx !== i));
  };

  const finishRecall = () => {
    const score = scoreFreeRecall(words, recalled);
    insertAssessment(db, {
      instrument,
      rawScore: score.count,
      payload: JSON.stringify({
        list: words,
        recalled,
        correct: score.correct,
        missed: score.missed,
        intrusions: score.intrusions,
      }),
    });
    setScoreCount(score.count);
    setPhase('summary');
  };

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Free recall" taskName="Word list">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Word list</AppText>
          <AppText variant="secondary" color="textSecondary">
            You will see {words.length} words, one at a time. After the last one, type every word
            you remember, in any order.
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={startStudy} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'study') {
    return (
      <ScreenShell kicker={`Word ${index + 1} of ${words.length}`} taskName="Word list">
        <View style={{ alignItems: 'center', paddingTop: space.sp7 }}>
          <AppText variant="stimulus">{shownWord ?? ' '}</AppText>
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'recall') {
    return (
      <ScreenShell kicker="Recall" taskName="Word list">
        <View style={{ gap: space.sp3, paddingTop: space.sp4, flex: 1 }}>
          <AppText variant="secondary" color="textSecondary">
            Type every word you remember, in any order — one at a time.
          </AppText>
          <View style={{ flexDirection: 'row', gap: space.sp2 }}>
            <View style={{ flex: 1 }}>
              <InputField
                placeholder="Type a word"
                value={entry}
                onChangeText={setEntry}
                onSubmitEditing={addWord}
                autoCapitalize="none"
              />
            </View>
            <Button label="Add" size="sm" onPress={addWord} disabled={!entry.trim()} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.sp1 }}>
            {recalled.map((w, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText variant="body">{w}</AppText>
                <Button kind="ghost" size="sm" label="Remove" onPress={() => removeWord(i)} />
              </View>
            ))}
          </ScrollView>
          <AppText variant="caption" color="textSecondary">
            {recalled.length} word{recalled.length === 1 ? '' : 's'} entered
          </AppText>
          <Button label="Finish recall" onPress={finishRecall} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell kicker="Free recall" taskName="Word list">
      <View style={{ gap: space.sp3, paddingTop: space.sp6, alignItems: 'center' }}>
        <AppText variant="heading">Recall complete</AppText>
        <AppText variant="stimulus" color="accent">
          {scoreCount}/{words.length}
        </AppText>
        <AppText variant="secondary" color="textSecondary" style={{ textAlign: 'center' }}>
          You recalled {scoreCount} of {words.length} words.
        </AppText>
        <View style={{ paddingTop: space.sp3, alignSelf: 'stretch' }}>
          <Button label="Continue" onPress={() => onDone(scoreCount)} />
        </View>
      </View>
    </ScreenShell>
  );
}
