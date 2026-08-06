import { Stack } from 'expo-router';
import { stackScreenOptionsWithTitles } from '@/ui';

// The 6-week campaign flow. Headers stay on — unlike the baseline battery,
// these screens are entered and left freely, so the back arrow belongs there.
const TITLES = {
  index: 'Campaign',
  pretest: 'Recall test',
  posttest: 'Recall test',
  results: 'Campaign results',
} as const;

export default function CampaignLayout() {
  return <Stack screenOptions={stackScreenOptionsWithTitles(TITLES)} />;
}
