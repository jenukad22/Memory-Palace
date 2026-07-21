import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  bestPalaceForCampaign,
  canFinishToday,
  finishCampaignDay,
  getCampaignStatus,
  getFreeRecallPosttest,
  getFreeRecallPretest,
  hasCampaignSessionToday,
  isSetupReady,
  todaysPalaceReviewStats,
  useDb,
  type Db,
} from '@/db';
import { MIN_LOCI_TO_START, MIN_REVIEWS_PER_CAMPAIGN_DAY, type CampaignStatus } from '@/engine';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

interface HubData {
  setupReady: boolean;
  palaceId: string | null;
  status: CampaignStatus;
  pretestDone: boolean;
  posttestDone: boolean;
  sessionToday: boolean;
  todayCount: number;
  finishable: boolean;
}

function loadHubData(db: Db): HubData {
  const best = bestPalaceForCampaign(db);
  return {
    setupReady: isSetupReady(db),
    palaceId: best?.palace.id ?? null,
    status: getCampaignStatus(db),
    pretestDone: getFreeRecallPretest(db) !== undefined,
    posttestDone: getFreeRecallPosttest(db) !== undefined,
    sessionToday: hasCampaignSessionToday(db),
    todayCount: todaysPalaceReviewStats(db).count,
    finishable: canFinishToday(db),
  };
}

/**
 * Six-week campaign hub (SPEC.md §7): setup gate -> pretest -> 42 daily
 * palace-training days -> posttest -> results. Day-completion is derived from
 * real review_log activity, never a fabricated timer (SPEC.md §7.4).
 */
export function CampaignScreen() {
  const db = useDb();
  const router = useRouter();
  const [data, setData] = useState<HubData | null>(null);

  useFocusEffect(
    useCallback(() => {
      setData(loadHubData(db));
    }, [db]),
  );

  if (!data) return null;

  const finishDay = () => {
    finishCampaignDay(db);
    setData(loadHubData(db));
  };

  if (!data.setupReady) {
    return (
      <ScreenShell kicker="6-week campaign" taskName="Method of loci">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Build your route first</AppText>
          <AppText variant="secondary" color="textSecondary">
            This program trains one route with daily practice for six weeks. Build a palace with at
            least {MIN_LOCI_TO_START} stops before you begin.
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button
              label="Open palace builder"
              onPress={() => router.push('/modules/memory/palace-builder')}
            />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (!data.pretestDone) {
    return (
      <ScreenShell kicker="6-week campaign" taskName="Method of loci">
        <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
          <AppText variant="heading">Before you start: a baseline</AppText>
          <AppText variant="secondary" color="textSecondary">
            A 72-word recall test, taken once now and once again after six weeks, so you can see
            your own before/after change on this exact task.
          </AppText>
          <View style={{ paddingTop: space.sp3 }}>
            <Button label="Take the pre-test" onPress={() => router.push('/campaign/pretest')} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (data.status.isProgramComplete && !data.posttestDone) {
    return (
      <ScreenShell kicker="6-week campaign" taskName="Method of loci">
        <View style={{ gap: space.sp3, paddingTop: space.sp5, alignItems: 'center' }}>
          <AppText variant="heading">Six weeks done</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ textAlign: 'center' }}>
            Take the same 72-word test once more to see your before/after change.
          </AppText>
          <View style={{ paddingTop: space.sp3, alignSelf: 'stretch' }}>
            <Button label="Take the post-test" onPress={() => router.push('/campaign/posttest')} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  if (data.pretestDone && data.posttestDone) {
    return (
      <ScreenShell kicker="6-week campaign" taskName="Method of loci">
        <View style={{ gap: space.sp3, paddingTop: space.sp5, alignItems: 'center' }}>
          <AppText variant="heading">Program complete</AppText>
          <View style={{ paddingTop: space.sp3, alignSelf: 'stretch' }}>
            <Button label="See your results" onPress={() => router.push('/campaign/results')} />
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      kicker={`Week ${data.status.week} · Day ${data.status.day} of 42`}
      taskName="Method of loci"
    >
      <View style={{ gap: space.sp4, paddingTop: space.sp4 }}>
        <Card>
          <AppText variant="caption" color="textSecondary">
            Today
          </AppText>
          {data.sessionToday ? (
            <AppText variant="body" style={{ paddingTop: space.sp2 }}>
              Today’s session is done — come back tomorrow for day {data.status.day + 1}.
            </AppText>
          ) : (
            <>
              <AppText variant="body" style={{ paddingTop: space.sp2 }}>
                {data.todayCount} of {MIN_REVIEWS_PER_CAMPAIGN_DAY} reviews logged today.
              </AppText>
              <View style={{ paddingTop: space.sp3, gap: space.sp2 }}>
                <Button
                  label="Continue palace training"
                  onPress={() =>
                    router.push(`/modules/memory/palace-training?palaceId=${data.palaceId!}`)
                  }
                />
                <Button
                  kind="secondary"
                  label="Finish today's session"
                  onPress={finishDay}
                  disabled={!data.finishable}
                />
              </View>
            </>
          )}
        </Card>
        <AppText variant="secondary" color="textSecondary">
          {data.status.daysCompleted} of 42 days complete · {data.status.daysRemaining} to go.
        </AppText>
      </View>
    </ScreenShell>
  );
}
