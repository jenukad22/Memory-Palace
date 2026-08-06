import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useDb } from '@/db';
import {
  BASE_RATE_ITEMS_PER_RUN,
  generateBaseRateRun,
  makeRng,
  scoreBaseRateRun,
  type BaseRateItem,
  type BaseRateRunMetrics,
} from '@/engine';
import { AppText, Button, Card, InputField, ScreenShell, space } from '@/ui';
import { renderBaseRateItem } from './baseRateCopy';
import {
  BASE_RATE_FORMAT_EXPLANATION,
  BASE_RATE_HONESTY,
  formatErrorPct,
  formatFraction,
} from './copy';
import { recordBaseRateRun } from './results';

type Phase = 'intro' | 'item' | 'results';

/**
 * Base-rate items in both formats (SPEC.md §4.1). One item at a time; the
 * answer's unit depends on the item's own format (a percentage, or a count
 * out of the shown total) — `renderBaseRateItem` supplies the right label and
 * bound, `scoreBaseRateAnswer` converts either into the same error scale.
 */
export function BaseRateScreen() {
  const db = useDb();
  const router = useRouter();

  // Generated on Start (an event handler), never during render — Date.now()
  // is impure and must not run as part of a render-time initializer.
  const [items, setItems] = useState<BaseRateItem[]>([]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [answers, setAnswers] = useState<number[]>([]);
  const [metrics, setMetrics] = useState<BaseRateRunMetrics | null>(null);
  const [saved, setSaved] = useState(true);

  const current: BaseRateItem | undefined = items[index];
  const rendered = current ? renderBaseRateItem(current) : null;

  const finish = useCallback(
    (finalAnswers: number[]) => {
      const scored = scoreBaseRateRun(items, finalAnswers);
      setMetrics(scored);
      setSaved(recordBaseRateRun(db, { metrics: scored, items, answers: finalAnswers }) !== null);
      setPhase('results');
    },
    [db, items],
  );

  // Number('') is 0, not NaN — an empty field must not be indistinguishable
  // from a deliberate "0" answer, so emptiness is checked before parsing.
  const trimmedInput = inputValue.trim();
  const parsedAnswer = trimmedInput === '' ? null : Number(trimmedInput);
  const hasValidAnswer = parsedAnswer !== null && Number.isFinite(parsedAnswer);

  const submit = () => {
    if (!hasValidAnswer) return;
    const next = [...answers, parsedAnswer];
    setAnswers(next);
    setInputValue('');
    if (index + 1 < items.length) setIndex(index + 1);
    else finish(next);
  };

  if (phase === 'results' && metrics !== null) {
    return (
      <BaseRateResults
        metrics={metrics}
        saved={saved}
        onDone={() => router.replace('/modules/reasoning')}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Reasoning" taskName="Base rates">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Estimate the real probability</AppText>
          <AppText variant="secondary" color="textSecondary">
            Each item gives you a base rate and a test with some error built in. Some are phrased as
            percentages, some as counts out of a stated total — read carefully, the phrasing changes
            each time.
          </AppText>
          <AppText variant="secondary" color="textSecondary">
            {BASE_RATE_ITEMS_PER_RUN} items, no time limit.
          </AppText>
          <AppText variant="caption" color="textMuted">
            {BASE_RATE_HONESTY}
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button
              label="Start"
              onPress={() => {
                setItems(generateBaseRateRun(makeRng(Date.now() >>> 0)));
                setPhase('item');
              }}
            />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell kicker="Reasoning" taskName="Base rates">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="caption" color="textMuted">
          Item {index + 1} of {items.length}
        </AppText>
        <Card>
          <AppText variant="body">{rendered?.promptText}</AppText>
        </Card>
        <View style={{ gap: space.sp2 }}>
          <AppText variant="secondary" color="textSecondary">
            {rendered?.answerLabel}
          </AppText>
          <InputField
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
        <Button
          label={index + 1 < items.length ? 'Next' : 'Finish'}
          onPress={submit}
          disabled={!hasValidAnswer}
        />
      </View>
    </ScreenShell>
  );
}

function BaseRateResults({
  metrics,
  saved,
  onDone,
}: {
  metrics: BaseRateRunMetrics;
  saved: boolean;
  onDone: () => void;
}) {
  return (
    <ScreenShell kicker="Reasoning" taskName="Base rates">
      <View style={{ gap: space.sp4 }}>
        <AppText variant="title">This run</AppText>
        <Card>
          <AppText variant="overline" color="textSecondary">
            Base rates
          </AppText>
          <View style={{ paddingTop: space.sp2, gap: space.sp2 }}>
            <Row label="Mean error, overall" value={formatErrorPct(metrics.meanAbsoluteErrorPct)} />
            <Row
              label="Mean error, percentage-format items"
              value={formatErrorPct(metrics.byFormat.probability.meanAbsoluteErrorPct)}
              note={formatFraction(metrics.byFormat.probability.trials, metrics.trials)}
            />
            <Row
              label="Mean error, frequency-format items"
              value={formatErrorPct(metrics.byFormat.frequency.meanAbsoluteErrorPct)}
              note={formatFraction(metrics.byFormat.frequency.trials, metrics.trials)}
            />
          </View>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp3 }}>
            {BASE_RATE_FORMAT_EXPLANATION}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp2 }}>
            {BASE_RATE_HONESTY}
          </AppText>
        </Card>
        {!saved ? (
          <AppText variant="secondary" color="error">
            This run had no items, so it was not recorded.
          </AppText>
        ) : null}
        <Button label="Done" onPress={onDone} />
      </View>
    </ScreenShell>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sp3 }}>
        <AppText variant="secondary" color="textSecondary">
          {label}
        </AppText>
        <AppText variant="secondary" tabular>
          {value}
        </AppText>
      </View>
      {note !== undefined ? (
        <AppText variant="caption" color="textMuted">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}
