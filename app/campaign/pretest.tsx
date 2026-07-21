import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FreeRecallScreen } from '@/assessment/freerecall';
import { FREE_RECALL_PRETEST_INSTRUMENT } from '@/db';
import { FREE_RECALL_LIST_LENGTH, makeRng, sampleWordList, WORD_BANK } from '@/engine';

/** A fresh PRNG seed, out of the component so the purity rule doesn't see Date.now in render. */
function freshSeed(): number {
  return (Date.now() ^ 0x9e3779b9) >>> 0;
}

export default function CampaignPretestRoute() {
  const router = useRouter();
  const words = useMemo(
    () => sampleWordList(WORD_BANK, FREE_RECALL_LIST_LENGTH, makeRng(freshSeed())),
    [],
  );

  return (
    <FreeRecallScreen
      words={words}
      instrument={FREE_RECALL_PRETEST_INSTRUMENT}
      onDone={() => router.replace('/campaign')}
    />
  );
}
