export interface DifficultyConfig {
  /** Lower edge of the target success band (inclusive). */
  targetLow?: number;
  /** Upper edge of the target success band (inclusive). */
  targetHigh?: number;
  /** Multiplier applied to the distance from the band midpoint. */
  gain?: number;
  /** Minimum difficulty the controller may output. */
  min?: number;
  /** Maximum difficulty the controller may output. */
  max?: number;
}

export const DEFAULT_TARGET_LOW = 0.8;
export const DEFAULT_TARGET_HIGH = 0.9;
export const DEFAULT_GAIN = 0.5;

export function nextDifficulty(
  current: number,
  rollingAccuracy: number,
  config?: DifficultyConfig,
): number {
  const targetLow = config?.targetLow ?? DEFAULT_TARGET_LOW;
  const targetHigh = config?.targetHigh ?? DEFAULT_TARGET_HIGH;
  const gain = config?.gain ?? DEFAULT_GAIN;
  const min = config?.min ?? 0;
  const max = config?.max ?? 1;

  if (!Number.isFinite(rollingAccuracy) || rollingAccuracy < 0 || rollingAccuracy > 1) {
    throw new RangeError(`rollingAccuracy must be in [0, 1], got ${rollingAccuracy}`);
  }

  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  if (rollingAccuracy >= targetLow && rollingAccuracy <= targetHigh) {
    return clamp(current);
  }

  const midpoint = (targetLow + targetHigh) / 2;
  return clamp(current + gain * (rollingAccuracy - midpoint));
}
