import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AppText } from './AppText';
import { linePath, makeChartScale, type ChartPoint } from './chartGeometry';
import { color } from './tokens';

export interface LineChartProps {
  /** Data-space points; caller decides what x/y mean (a timestamp, a day offset, …). */
  points: ChartPoint[];
  height: number;
  /** Defaults to the data's own min/max, padded slightly so a flat line doesn't hug an edge. */
  yDomain?: [number, number];
  /** Axis-label formatting, e.g. Math.round for an Elo rating, a percent formatter for retrievability. */
  yFormat?: (v: number) => string;
  /** Sparkline mode: no gridlines or axis labels — for BaselineTrendCard. */
  compact?: boolean;
  /** Shown centered when there are no points yet. */
  emptyLabel?: string;
}

function paddedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) || 1) * 0.1;
  return [min - pad, max + pad];
}

/**
 * One generic line chart, reused for both the Elo-over-time chart and the
 * retention curve (and, in compact mode, baseline-instrument sparklines) —
 * not near-duplicate components. Single-series only (accent stroke); no new
 * color tokens needed.
 */
export function LineChart({
  points,
  height,
  yDomain,
  yFormat = (v) => String(Math.round(v)),
  compact = false,
  emptyLabel = 'Not enough data yet',
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length === 0) {
    return (
      <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="secondary" color="textMuted">
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const yRange = yDomain ?? paddedDomain(ys);
  const labelGutter = compact ? 0 : 36;

  const scale =
    width > 0
      ? makeChartScale({
          width: width - labelGutter,
          height,
          paddingX: compact ? 0 : 4,
          paddingY: compact ? 2 : 8,
          xDomain: [Math.min(...xs), Math.max(...xs)],
          yDomain: yRange,
        })
      : null;

  const scaledPoints = scale ? points.map((p) => ({ x: scale.x(p.x), y: scale.y(p.y) })) : [];
  const last = scaledPoints.at(-1);

  return (
    <View onLayout={onLayout} style={{ height, flexDirection: 'row' }}>
      {!compact ? (
        <View style={{ width: labelGutter, justifyContent: 'space-between', paddingVertical: 4 }}>
          <AppText variant="caption" color="textMuted">
            {yFormat(yRange[1])}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {yFormat(yRange[0])}
          </AppText>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {width > 0 && scale ? (
          <Svg width={width - labelGutter} height={height}>
            {!compact ? (
              <>
                <Line
                  x1={0}
                  y1={scale.y(yRange[1])}
                  x2={width - labelGutter}
                  y2={scale.y(yRange[1])}
                  stroke={color.line}
                  strokeWidth={1}
                />
                <Line
                  x1={0}
                  y1={scale.y(yRange[0])}
                  x2={width - labelGutter}
                  y2={scale.y(yRange[0])}
                  stroke={color.line}
                  strokeWidth={1}
                />
              </>
            ) : null}
            <Path d={linePath(scaledPoints)} stroke={color.accent} strokeWidth={2} fill="none" />
            {last ? <Circle cx={last.x} cy={last.y} r={3} fill={color.accent} /> : null}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}
