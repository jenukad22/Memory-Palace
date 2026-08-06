import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useDb } from '@/db';
import {
  HYPOTHESES_PROMPTS_PER_RUN,
  MAX_HYPOTHESES_PER_PROMPT,
  makeRng,
  scoreHypothesesRun,
  type HypothesesRunMetrics,
} from '@/engine';
import { AppText, Button, Card, InputField, ScreenShell, color, radius, space } from '@/ui';
import { HYPOTHESES_DEDUPE_EXPLANATION, HYPOTHESES_HONESTY, formatCount } from './copy';
import { sampleHypothesisPrompts } from './hypothesesBank';
import { recordHypothesesRun } from './results';

type Phase = 'intro' | 'prompt' | 'results';

/**
 * Generate-multiple-hypotheses drill (SPEC.md §4.2). One prompt at a time;
 * the user adds entries to a growing list, up to `MAX_HYPOTHESES_PER_PROMPT`,
 * then moves on. Untimed and self-paced, like the palace/PAO drills.
 */
export function HypothesesScreen() {
  const db = useDb();
  const router = useRouter();

  const [prompts, setPrompts] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [allEntries, setAllEntries] = useState<string[][]>([]);
  const [metrics, setMetrics] = useState<HypothesesRunMetrics | null>(null);
  const [saved, setSaved] = useState(true);

  const currentPrompt = prompts[index];

  const finish = useCallback(
    (finalEntries: string[][]) => {
      const scored = scoreHypothesesRun(finalEntries);
      const trials = prompts.map((prompt, i) => ({ prompt, entries: finalEntries[i] ?? [] }));
      setMetrics(scored);
      setSaved(recordHypothesesRun(db, { metrics: scored, trials }) !== null);
      setPhase('results');
    },
    [db, prompts],
  );

  const addEntry = () => {
    const trimmed = draft.trim();
    if (trimmed === '' || entries.length >= MAX_HYPOTHESES_PER_PROMPT) return;
    setEntries([...entries, trimmed]);
    setDraft('');
  };

  const nextPrompt = () => {
    // A typed-but-not-"Add"ed draft must not vanish silently — flush it in,
    // the same as pressing Add, before moving on.
    const pending = draft.trim();
    const finalEntries =
      pending !== '' && entries.length < MAX_HYPOTHESES_PER_PROMPT
        ? [...entries, pending]
        : entries;
    const next = [...allEntries, finalEntries];
    setAllEntries(next);
    setEntries([]);
    setDraft('');
    if (index + 1 < prompts.length) setIndex(index + 1);
    else finish(next);
  };

  if (phase === 'results' && metrics !== null) {
    return (
      <HypothesesResults
        metrics={metrics}
        saved={saved}
        onDone={() => router.replace('/modules/reasoning')}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Reasoning" taskName="Hypotheses">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Generate multiple explanations</AppText>
          <AppText variant="secondary" color="textSecondary">
            You’ll see an ambiguous observation. List as many distinct, plausible explanations as
            you can think of — up to {MAX_HYPOTHESES_PER_PROMPT} per prompt — then move to the next
            one.
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {HYPOTHESES_PROMPTS_PER_RUN} prompts, no time limit.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {HYPOTHESES_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button
              label="Start"
              onPress={() => {
                setPrompts(sampleHypothesisPrompts(makeRng(Date.now() >>> 0)));
                setPhase('prompt');
              }}
            />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell kicker="Reasoning" taskName="Hypotheses">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="caption" color="textMuted">
          Prompt {index + 1} of {prompts.length}
        </AppText>
        <Card>
          <AppText variant="body">{currentPrompt}</AppText>
        </Card>

        <View style={{ gap: space.sp2 }}>
          {entries.map((entry, i) => (
            <View
              key={`${i}-${entry}`}
              style={{
                paddingVertical: space.sp2,
                paddingHorizontal: space.sp3,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: color.line,
                backgroundColor: color.surface1,
              }}
            >
              <AppText variant="secondary">{entry}</AppText>
            </View>
          ))}
        </View>

        {entries.length < MAX_HYPOTHESES_PER_PROMPT ? (
          <View style={{ gap: space.sp2 }}>
            <InputField
              value={draft}
              onChangeText={setDraft}
              placeholder="Another explanation…"
              onSubmitEditing={addEntry}
              returnKeyType="done"
            />
            <Button label="Add" kind="secondary" onPress={addEntry} />
          </View>
        ) : (
          <AppText variant="caption" color="textMuted">
            Reached the {MAX_HYPOTHESES_PER_PROMPT}-entry limit for this prompt.
          </AppText>
        )}

        <Button
          label={index + 1 < prompts.length ? 'Next prompt' : 'Finish'}
          onPress={nextPrompt}
        />
      </View>
    </ScreenShell>
  );
}

function HypothesesResults({
  metrics,
  saved,
  onDone,
}: {
  metrics: HypothesesRunMetrics;
  saved: boolean;
  onDone: () => void;
}) {
  return (
    <ScreenShell kicker="Reasoning" taskName="Hypotheses">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">This run</AppText>
        <Card>
          <AppText variant="overline" color="textSecondary">
            Hypothesis fluency
          </AppText>
          <AppText variant="title" style={{ paddingTop: space.sp2 }}>
            {formatCount(metrics.meanUniquePerPrompt)}
          </AppText>
          <AppText variant="caption" color="textMuted">
            distinct explanations per prompt, on average
          </AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingTop: space.sp3 }}>
            {metrics.totalUnique} total across {metrics.trials} prompts
            {metrics.totalDuplicates > 0
              ? ` (${metrics.totalDuplicates} exact repeats not counted)`
              : ''}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp3 }}>
            {HYPOTHESES_DEDUPE_EXPLANATION}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp2 }}>
            {HYPOTHESES_HONESTY}
          </AppText>
        </Card>
        {!saved ? (
          <AppText variant="secondary" color="error">
            This run had no prompts, so it was not recorded.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </View>
    </ScreenShell>
  );
}
