import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  createTrainingSet,
  getVviqStrategy,
  listLoci,
  listPlacementsBySet,
  recentModuleAccuracy,
  recordReview,
  useDb,
  type PlacementView,
} from '@/db';
import { makeRng, recallOrder, type MemoryStrategy, type ReviewRating } from '@/engine';
import { AppText, Button, Card, GradeButtons, ScreenShell, color, space } from '@/ui';
import { RECALL_PROMPT, encodingCopy } from './copy';
import { palaceListLength, sessionDifficulty } from './difficulty';

const MEMORY_MODULE = 'memory';

// A small pool of concrete, picturable items to place along the route. The
// route (technique) is the durable scaffold; the item list is this session's
// material (SPEC.md §1).
const ITEM_POOL = [
  'a brass key',
  'a ripe tomato',
  'a paper crane',
  'a violin',
  'a green umbrella',
  'a stack of coins',
  'a candle',
  'a goldfish',
  'a wool scarf',
  'a pocket watch',
  'a jar of honey',
  'a red bicycle',
  'a chess knight',
  'a light bulb',
  'a bar of soap',
];

type Phase = 'intro' | 'encode' | 'recall' | 'done';

/** A fresh PRNG seed, out of the component so the purity rule doesn't see Date.now in render. */
function freshSeed(): number {
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

export function PalaceTrainingScreen() {
  const db = useDb();
  const router = useRouter();
  const { palaceId } = useLocalSearchParams<{ palaceId: string }>();

  const strategy: MemoryStrategy = useMemo(() => getVviqStrategy(db) ?? 'visual', [db]);
  const copy = encodingCopy(strategy);

  const [phase, setPhase] = useState<Phase>('intro');
  const [encoded, setEncoded] = useState<PlacementView[]>([]);
  const [recallSeq, setRecallSeq] = useState<PlacementView[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hits, setHits] = useState(0);

  const start = () => {
    const loci = listLoci(db, palaceId);
    const difficulty = sessionDifficulty(recentModuleAccuracy(db, MEMORY_MODULE));
    const count = palaceListLength(difficulty, loci.length);
    const seed = freshSeed();
    const items = recallOrder(ITEM_POOL, makeRng(seed)).slice(0, count);
    const { setId } = createTrainingSet(db, { palaceId, items });
    const placements = listPlacementsBySet(db, setId);
    setEncoded(placements);
    setRecallSeq(recallOrder(placements, makeRng(seed + 1)));
    setHits(0);
    setIdx(0);
    setPhase('encode');
  };

  const advanceEncode = () => {
    if (idx + 1 < encoded.length) setIdx(idx + 1);
    else {
      setIdx(0);
      setRevealed(false);
      setPhase('recall');
    }
  };

  const grade = (rating: ReviewRating) => {
    const current = recallSeq[idx]!;
    recordReview(db, { cardId: current.cardId, module: MEMORY_MODULE, rating });
    if (rating !== 'again') setHits((h) => h + 1);
    if (idx + 1 < recallSeq.length) {
      setIdx(idx + 1);
      setRevealed(false);
    } else {
      setPhase('done');
    }
  };

  if (phase === 'intro') {
    return (
      <ScreenShell kicker="Memory · Palace" taskName="Training">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Walk your route</AppText>
          <AppText variant="secondary" color="textSecondary">
            You will place a few items along your route, one per stop. {copy.placePrompt} Then you
            will be asked to recall each item before it is shown.
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Start" onPress={start} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'encode') {
    const p = encoded[idx]!;
    return (
      <ScreenShell kicker={`Place · ${idx + 1} of ${encoded.length}`} taskName="Training">
        <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
          <Card>
            <AppText variant="caption" color="textSecondary">
              Stop {idx + 1}
            </AppText>
            <AppText variant="title" style={{ paddingTop: space.sp1 }}>
              {p.locusLabel}
            </AppText>
            <AppText variant="display" color="accent" style={{ paddingTop: space.sp3 }}>
              {p.item}
            </AppText>
          </Card>
          <AppText variant="secondary" color="textSecondary">
            {copy.placePrompt}
          </AppText>
          <Button
            label={idx + 1 < encoded.length ? 'Next stop' : 'Start recall'}
            onPress={advanceEncode}
          />
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'recall') {
    const p = recallSeq[idx]!;
    return (
      <ScreenShell kicker={`Recall · ${idx + 1} of ${recallSeq.length}`} taskName="Training">
        <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
          <Card>
            <AppText variant="caption" color="textSecondary">
              {p.locusLabel}
            </AppText>
            <AppText variant="heading" style={{ paddingTop: space.sp2 }}>
              {RECALL_PROMPT}
            </AppText>
            {revealed ? (
              <AppText variant="display" color="accent" style={{ paddingTop: space.sp4 }}>
                {p.item}
              </AppText>
            ) : (
              <View style={{ paddingTop: space.sp4 }}>
                <Button label="Reveal answer" kind="secondary" onPress={() => setRevealed(true)} />
              </View>
            )}
          </Card>
          {revealed ? (
            <View style={{ gap: space.sp2 }}>
              <AppText variant="caption" color="textSecondary">
                How did that retrieval go?
              </AppText>
              <GradeButtons onGrade={grade} />
            </View>
          ) : null}
        </View>
      </ScreenShell>
    );
  }

  const total = recallSeq.length;
  return (
    <ScreenShell kicker="Memory · Palace" taskName="Training">
      <View style={{ gap: space.sp3, paddingTop: space.sp6, alignItems: 'center' }}>
        <AppText variant="heading">Route recall</AppText>
        <AppText variant="stimulus" color="accent">
          {hits}/{total}
        </AppText>
        <AppText variant="secondary" color="textSecondary" style={{ textAlign: 'center' }}>
          You retrieved {hits} of {total} items on this route. Each attempt was logged; the next
          session adapts to how it went.
        </AppText>
        <View style={{ paddingTop: space.sp3, alignSelf: 'stretch', gap: space.sp2 }}>
          <Button label="Done" onPress={() => router.back()} />
        </View>
        <View style={{ height: 1, backgroundColor: color.line, alignSelf: 'stretch' }} />
      </View>
    </ScreenShell>
  );
}
