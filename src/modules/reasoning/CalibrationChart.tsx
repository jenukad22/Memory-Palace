import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { CalibrationBucket } from '@/engine';
import { AppText, color, makeChartScale } from '@/ui';

export interface CalibrationChartProps {
  buckets: readonly CalibrationBucket[];
  height?: number;
  emptyLabel?: string;
}

const MIN_DOT_RADIUS = 4;
const MAX_DOT_RADIUS = 12;

/**
 * Reliability diagram: stated confidence (x) vs. observed accuracy (y), one
 * dot per confidence level that has trials, sized by trial count, against a
 * diagonal reference line for perfect calibration. A dedicated small chart
 * rather than a reuse of `LineChart` — a scatter with a reference line and
 * variable dot size isn't what that component's single-polyline shape does
 * (same reasoning `CorsiBoard`/`FlickerBoard` are each their own component).
 */
export function CalibrationChart({
  buckets,
  height = 220,
  emptyLabel = 'Rate your confidence on a few questions to see this.',
}: CalibrationChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const gutter = 34;

  if (buckets.length === 0) {
    return (
      <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="secondary" color="textMuted">
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  const scale =
    width > 0
      ? makeChartScale({
          width: width - gutter,
          height: height - gutter,
          paddingX: 10,
          paddingY: 10,
          xDomain: [45, 105],
          yDomain: [0, 100],
        })
      : null;

  // Every bucket has at least one trial (calibrationCurve only creates a
  // bucket when trials exist), so maxTrials is always >= 1 here — no
  // division-by-zero case to guard.
  const maxTrials = Math.max(...buckets.map((b) => b.trials));
  const radiusFor = (trials: number) =>
    MIN_DOT_RADIUS + (trials / maxTrials) * (MAX_DOT_RADIUS - MIN_DOT_RADIUS);

  return (
    <View onLayout={onLayout} style={{ height, flexDirection: 'row' }}>
      <View style={{ width: gutter, justifyContent: 'space-between', paddingVertical: 4 }}>
        <AppText variant="caption" color="textMuted">
          100%
        </AppText>
        <AppText variant="caption" color="textMuted">
          0%
        </AppText>
      </View>
      <View style={{ flex: 1 }}>
        {width > 0 && scale ? (
          <Svg width={width - gutter} height={height - gutter}>
            <Line
              x1={scale.x(50)}
              y1={scale.y(50)}
              x2={scale.x(100)}
              y2={scale.y(100)}
              stroke={color.lineStrong}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            {buckets.map((b) => (
              <Circle
                key={b.confidencePct}
                cx={scale.x(b.confidencePct)}
                cy={scale.y(b.observedAccuracyPct)}
                r={radiusFor(b.trials)}
                fill={color.accentTint}
                stroke={color.accent}
                strokeWidth={1.5}
              />
            ))}
          </Svg>
        ) : null}
        {width > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 2,
            }}
          >
            <AppText variant="caption" color="textMuted">
              50%
            </AppText>
            <AppText variant="caption" color="textMuted">
              confidence
            </AppText>
            <AppText variant="caption" color="textMuted">
              100%
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
