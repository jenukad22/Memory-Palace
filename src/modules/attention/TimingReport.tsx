import { View } from 'react-native';
import type { TimingProfile } from '@/engine';
import { AppText, Card, space } from '@/ui';
import { DRIFT_EXPLANATION, TIMING_DISCLOSURE, formatMs, timingQualityCopy } from './copy';

export interface TimingReportProps {
  profile: TimingProfile;
}

/**
 * How well this run's stimuli were actually presented (SPEC.md §3.2-3.3), shown
 * with every result. Two things belong on screen and not only in a payload
 * column: the part we measured (onset delay, and the band it implies), and the
 * part we cannot measure at all (the device's input delay).
 */
export function TimingReport({ profile }: TimingReportProps) {
  return (
    <Card>
      <AppText variant="overline" color="textSecondary">
        Timing of this run
      </AppText>

      <AppText variant="bodyStrong" style={{ paddingTop: space.sp2 }}>
        ± {formatMs(profile.rtUncertaintyMs)} on each reaction time
      </AppText>
      <AppText variant="secondary" color="textSecondary" style={{ paddingTop: space.sp1 }}>
        {timingQualityCopy(profile.quality)}
      </AppText>

      <View style={{ paddingTop: space.sp3, gap: space.sp1 }}>
        <Row label="Stimulus onsets measured" value={`${profile.samples}`} />
        <Row label="Median onset delay" value={formatMs(profile.medianDriftMs)} />
        <Row label="95th percentile" value={formatMs(profile.p95DriftMs)} />
        <Row label="Worst onset delay" value={formatMs(profile.maxDriftMs)} />
        <Row label="Onsets past one frame" value={`${profile.lateOnsets} of ${profile.samples}`} />
        <Row
          label="Clock"
          value={profile.highResolutionClock ? 'High-resolution' : 'Millisecond'}
        />
      </View>

      <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp3 }}>
        {DRIFT_EXPLANATION}
      </AppText>
      <AppText variant="caption" color="textMuted" style={{ paddingTop: space.sp2 }}>
        {TIMING_DISCLOSURE}
      </AppText>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <AppText variant="secondary" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="secondary" tabular>
        {value}
      </AppText>
    </View>
  );
}
