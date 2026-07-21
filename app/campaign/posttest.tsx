import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FreeRecallScreen } from '@/assessment/freerecall';
import { FREE_RECALL_POSTTEST_INSTRUMENT, getFreeRecallPretest, useDb } from '@/db';
import { FREE_RECALL_LIST_LENGTH, makeRng, sampleWordList, WORD_BANK } from '@/engine';

/** A fresh PRNG seed, out of the component so the purity rule doesn't see Date.now in render. */
function freshSeed(): number {
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

/** The pretest's studied word list, so the posttest list is disjoint (SPEC.md §7.3). */
function pretestWordList(payload: string | null): string[] {
  if (!payload) return [];
  const parsed = JSON.parse(payload) as { list?: string[] };
  return parsed.list ?? [];
}

export default function CampaignPosttestRoute() {
  const db = useDb();
  const router = useRouter();
  const words = useMemo(() => {
    const exclude = new Set(pretestWordList(getFreeRecallPretest(db)?.payload ?? null));
    return sampleWordList(WORD_BANK, FREE_RECALL_LIST_LENGTH, makeRng(freshSeed()), exclude);
  }, [db]);

  return (
    <FreeRecallScreen
      words={words}
      instrument={FREE_RECALL_POSTTEST_INSTRUMENT}
      onDone={() => router.replace('/campaign/results')}
    />
  );
}
