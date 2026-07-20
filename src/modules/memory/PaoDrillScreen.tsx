import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  getVviqStrategy,
  listPaoCards,
  PAO_MODULE,
  recentModuleAccuracy,
  recordReview,
  useDb,
  type PaoCard,
} from '@/db';
import {
  composeScene,
  entriesForNumber,
  indexByNumber,
  makeRng,
  pad2,
  splitSixDigits,
  type MemoryStrategy,
  type ReviewRating,
  type Rng,
} from '@/engine';
import { AppText, Button, Card, ScreenShell, color, space } from '@/ui';
import { PAO_RECALL_PROMPT, encodingCopy } from './copy';
import { paoDrillParams, sessionDifficulty } from './difficulty';

const MIN_AUTHORED = 3;

/** A fresh PRNG seed, out of the component so the purity rule doesn't see Date.now in render. */
function freshSeed(): number {
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

type Phase = 'intro' | 'expose' | 'recall' | 'done';

const GRADES: { label: string; rating: ReviewRating }[] = [
  { label: 'Missed', rating: 'again' },
  { label: 'Hard', rating: 'hard' },
  { label: 'Good', rating: 'good' },
  { label: 'Easy', rating: 'easy' },
];

/** Build one 6-digit number from three authored numbers (pairs), preserving leading zeros. */
function makeNumber(pool: readonly number[], rng: Rng): string {
  let digits = '';
  for (let i = 0; i < 3; i += 1) {
    digits += pad2(pool[Math.floor(rng() * pool.length)]!);
  }
  return digits;
}

/**
 * PAO drill (SPEC.md §1, §4). A 6-digit number is compressed into one scene
 * (Person·Action·Object across the three pairs). Exposure then hide, then active
 * retrieval: the scene is recalled before the answer is shown. Each attempt logs
 * a review against the three involved entry cards.
 */
export function PaoDrillScreen() {
  const db = useDb();
  const router = useRouter();

  const cards = useMemo<PaoCard[]>(() => listPaoCards(db), [db]);
  const strategy: MemoryStrategy = useMemo(() => getVviqStrategy(db) ?? 'visual', [db]);
  const copy = encodingCopy(strategy);
  const entryMap = useMemo(() => indexByNumber(cards.map((c) => c.entry)), [cards]);
  const cardIdByNumber = useMemo(() => new Map(cards.map((c) => [c.entry.n, c.cardId])), [cards]);

  const params = useMemo(
    () => paoDrillParams(sessionDifficulty(recentModuleAccuracy(db, PAO_MODULE))),
    [db],
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [numbers, setNumbers] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hits, setHits] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const enoughEntries = cards.length >= MIN_AUTHORED;

  const start = () => {
    const pool = cards.map((c) => c.entry.n);
    const rng = makeRng(freshSeed());
    const generated = Array.from({ length: params.count }, () => makeNumber(pool, rng));
    setNumbers(generated);
    setHits(0);
    setIdx(0);
    exposeNumber();
  };

  const exposeNumber = () => {
    setRevealed(false);
    setPhase('expose');
    timer.current = setTimeout(() => setPhase('recall'), params.exposureMs);
  };

  const grade = (rating: ReviewRating) => {
    const digits = numbers[idx]!;
    for (const n of splitSixDigits(digits)) {
      const cardId = cardIdByNumber.get(n);
      if (cardId) recordReview(db, { cardId, module: PAO_MODULE, rating });
    }
    if (rating !== 'again') setHits((h) => h + 1);
    if (idx + 1 < numbers.length) {
      setIdx(idx + 1);
      exposeNumber();
    } else {
      setPhase('done');
    }
  };

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Memory · PAO" taskName="Drill">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Compress the number</AppText>
          <AppText variant="secondary" color="textSecondary">
            A 6-digit number appears briefly, then hides. Turn it into one scene:{' '}
            {copy.paoScenePrompt}
          </AppText>
          {enoughEntries ? (
            <View style={{ paddingTop: space.sp3 }}>
              <Button label="Start" onPress={start} />
            </View>
          ) : (
            <AppText variant="secondary" color="textMuted">
              Author at least {MIN_AUTHORED} numbers in the PAO builder first.
            </AppText>
          )}
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'expose') {
    const digits = numbers[idx]!;
    return (
      <ScreenShell kicker={`Number · ${idx + 1} of ${numbers.length}`} taskName="Drill">
        <View style={{ gap: space.sp3, paddingTop: space.sp6, alignItems: 'center' }}>
          <AppText variant="caption" color="textSecondary">
            Compress into a scene
          </AppText>
          <AppText variant="stimulus" color="accent" tabular>
            {digits}
          </AppText>
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'recall') {
    const digits = numbers[idx]!;
    const [p, a, o] = splitSixDigits(digits);
    const scene = composeScene(entriesForNumber(digits, entryMap));
    return (
      <ScreenShell kicker={`Number · ${idx + 1} of ${numbers.length}`} taskName="Drill">
        <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
          <Card>
            <AppText variant="heading">{PAO_RECALL_PROMPT}</AppText>
            <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp2 }}>
              Pairs: {pad2(p!)} · {pad2(a!)} · {pad2(o!)}
            </AppText>
            {revealed ? (
              <View style={{ paddingTop: space.sp4, gap: space.sp1 }}>
                <AppText variant="bodyStrong" color="accent">
                  {scene.person}
                </AppText>
                <AppText variant="bodyStrong" color="accent">
                  {scene.action}
                </AppText>
                <AppText variant="bodyStrong" color="accent">
                  {scene.object}
                </AppText>
              </View>
            ) : (
              <View style={{ paddingTop: space.sp4 }}>
                <Button label="Reveal scene" kind="secondary" onPress={() => setRevealed(true)} />
              </View>
            )}
          </Card>
          {revealed ? (
            <View style={{ gap: space.sp2 }}>
              <AppText variant="caption" color="textSecondary">
                How did that retrieval go?
              </AppText>
              <View style={{ flexDirection: 'row', gap: space.sp2 }}>
                {GRADES.map((g) => (
                  <View key={g.rating} style={{ flex: 1 }}>
                    <Button
                      kind="secondary"
                      size="sm"
                      label={g.label}
                      onPress={() => grade(g.rating)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScreenShell>
    );
  }

  const total = numbers.length;
  return (
    <ScreenShell kicker="Memory · PAO" taskName="Drill">
      <View style={{ gap: space.sp3, paddingTop: space.sp6, alignItems: 'center' }}>
        <AppText variant="heading">Scene recall</AppText>
        <AppText variant="stimulus" color="accent">
          {hits}/{total}
        </AppText>
        <AppText variant="secondary" color="textSecondary" style={{ textAlign: 'center' }}>
          You recalled {hits} of {total} numbers as scenes. Each attempt was logged.
        </AppText>
        <View style={{ paddingTop: space.sp3, alignSelf: 'stretch' }}>
          <Button label="Done" onPress={() => router.back()} />
        </View>
        <View style={{ height: 1, backgroundColor: color.line, alignSelf: 'stretch' }} />
      </View>
    </ScreenShell>
  );
}
