export interface EloConfig {
  /** Step size for one update. Larger K moves ratings faster. */
  kFactor?: number;
}

export interface EloUpdate {
  user: number;
  item: number;
}

export const DEFAULT_K_FACTOR = 32;

const RATING_SCALE = 400;

export function expectedScore(userRating: number, itemRating: number): number {
  return 1 / (1 + 10 ** ((itemRating - userRating) / RATING_SCALE));
}

export function update(
  userRating: number,
  itemRating: number,
  correct: boolean,
  config?: EloConfig,
): EloUpdate {
  const kFactor = config?.kFactor ?? DEFAULT_K_FACTOR;
  const outcome = correct ? 1 : 0;
  const delta = kFactor * (outcome - expectedScore(userRating, itemRating));
  return { user: userRating + delta, item: itemRating - delta };
}
