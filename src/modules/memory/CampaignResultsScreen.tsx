import { View } from 'react-native';
import { getFreeRecallPosttest, getFreeRecallPretest, useDb } from '@/db';
import { FREE_RECALL_LIST_LENGTH } from '@/engine';
import { AppText, ScreenShell, space } from '@/ui';

/**
 * Before/after delta (SPEC.md §7.5): the same free-recall task, same units,
 * both sides — "words recalled went from X to Y." Task-specific only (CLAUDE.md);
 * a flat or negative delta is reported exactly as measured, never spun.
 */
export function CampaignResultsScreen() {
  const db = useDb();
  const pretest = getFreeRecallPretest(db);
  const posttest = getFreeRecallPosttest(db);

  if (!pretest || !posttest) {
    return (
      <ScreenShell kicker="6-week campaign" taskName="Results">
        <View style={{ paddingTop: space.sp5 }}>
          <AppText variant="secondary" color="textSecondary">
            Results appear once both the pre-test and post-test are complete.
          </AppText>
        </View>
      </ScreenShell>
    );
  }

  const before = pretest.rawScore;
  const after = posttest.rawScore;
  const delta = after - before;
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <ScreenShell kicker="6-week campaign" taskName="Results">
      <View style={{ gap: space.sp4, paddingTop: space.sp5, alignItems: 'center' }}>
        <AppText variant="heading">Your words recalled</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sp3 }}>
          <AppText variant="display" color="textSecondary">
            {before}
          </AppText>
          <AppText variant="heading" color="textSecondary">
            →
          </AppText>
          <AppText variant="display" color="accent">
            {after}
          </AppText>
        </View>
        <AppText variant="secondary" color="textSecondary" style={{ textAlign: 'center' }}>
          Words recalled went from {before} to {after} ({deltaLabel} out of{' '}
          {FREE_RECALL_LIST_LENGTH}), on the same free-recall task before and after six weeks of
          practice.
        </AppText>
      </View>
    </ScreenShell>
  );
}
