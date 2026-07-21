import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { listDueCards, recordReview, useDb, type DueCard } from '@/db';
import type { ReviewRating } from '@/engine';
import { AppText, Button, Card, GradeButtons, ScreenShell, color, space } from '@/ui';

type Phase = 'active' | 'done';

interface Counts {
  newTotal: number;
  newHits: number;
  reviewTotal: number;
  reviewHits: number;
}

const EMPTY_COUNTS: Counts = { newTotal: 0, newHits: 0, reviewTotal: 0, reviewHits: 0 };

const MODULE_LABEL: Record<string, string> = { pao: 'PAO', memory: 'Memory palace' };

/**
 * Daily review — the cross-module SRS queue (db/queries/due.ts), distinct from
 * the module-specific drills that author fresh material. Every due card gets
 * one active-recall attempt: the answer is hidden until requested, then a
 * self-grade reschedules the card via recordReview -> engine/fsrs.ts. New and
 * review cards are tracked and reported separately in the session summary.
 */
export function ReviewScreen() {
  const db = useDb();
  const router = useRouter();
  const [queue] = useState<DueCard[]>(() => listDueCards(db));
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<Phase>('active');
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);

  if (queue.length === 0) {
    return (
      <ScreenShell kicker="Daily review" taskName="Review">
        <View style={{ gap: space.sp3, paddingTop: space.sp6, alignItems: 'center' }}>
          <AppText variant="heading">Nothing due right now</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ textAlign: 'center' }}>
            Every card is scheduled for later. Check back when one comes due.
          </AppText>
          <View style={{ paddingTop: space.sp3, alignSelf: 'stretch' }}>
            <Button label="Back" onPress={() => router.back()} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (phase === 'done') {
    const total = counts.newTotal + counts.reviewTotal;
    const hits = counts.newHits + counts.reviewHits;
    return (
      <ScreenShell kicker="Daily review" taskName="Review">
        <View style={{ gap: space.sp3, paddingTop: space.sp6, alignItems: 'center' }}>
          <AppText variant="heading">Session complete</AppText>
          <AppText variant="stimulus" color="accent">
            {hits}/{total}
          </AppText>
          <View style={{ gap: space.sp1, alignItems: 'center' }}>
            <AppText variant="secondary" color="textSecondary">
              Review: {counts.reviewHits}/{counts.reviewTotal}
            </AppText>
            <AppText variant="secondary" color="textSecondary">
              New: {counts.newHits}/{counts.newTotal}
            </AppText>
          </View>
          <View style={{ paddingTop: space.sp3, alignSelf: 'stretch' }}>
            <Button label="Done" onPress={() => router.back()} />
          </View>
          <View style={{ height: 1, backgroundColor: color.line, alignSelf: 'stretch' }} />
        </View>
      </ScreenShell>
    );
  }

  const current = queue[idx]!;
  const isNew = current.phase === 'new';

  const grade = (rating: ReviewRating) => {
    recordReview(db, { cardId: current.cardId, module: current.module, rating });
    const hit = rating !== 'again';
    setCounts((c) =>
      isNew
        ? { ...c, newTotal: c.newTotal + 1, newHits: c.newHits + (hit ? 1 : 0) }
        : { ...c, reviewTotal: c.reviewTotal + 1, reviewHits: c.reviewHits + (hit ? 1 : 0) },
    );
    setRevealed(false);
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else setPhase('done');
  };

  return (
    <ScreenShell
      kicker={`${isNew ? 'New' : 'Review'} · ${idx + 1} of ${queue.length}`}
      taskName="Review"
    >
      <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
        <Card>
          <AppText variant="caption" color="textSecondary">
            {MODULE_LABEL[current.module] ?? current.module}
          </AppText>
          <AppText variant="heading" style={{ paddingTop: space.sp2 }}>
            {current.front}
          </AppText>
          {revealed ? (
            <AppText variant="display" color="accent" style={{ paddingTop: space.sp4 }}>
              {current.back}
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
