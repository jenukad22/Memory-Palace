/**
 * Signal-detection scoring shared by the attention tasks
 * (modules/attention/SPEC.md §4.2). The CPT uses it today; the deferred N-back
 * (assessment/SPEC.md §6) specifies the same loglinear-corrected d′, which is
 * why this is its own module rather than living inside cpt.ts.
 *
 * d′ separates "noticed the difference" from "pressed a lot": a run that
 * responds to everything has a high hit rate and an equally high false-alarm
 * rate, and lands at d′ ≈ 0.
 */

export interface SdtCounts {
  /** Responses on signal trials. */
  hits: number;
  /** Signal trials presented. */
  signals: number;
  /** Responses on noise trials. */
  falseAlarms: number;
  /** Noise trials presented. */
  noise: number;
}

export interface SdtRates {
  hitRate: number;
  falseAlarmRate: number;
}

/**
 * Hautus (1995) loglinear correction: add 0.5 to each count and 1 to each
 * total. Applied unconditionally (not only at the edges) so the correction is
 * one fixed rule rather than a branch that changes what d′ means, and so a
 * perfect or a floor run still yields a finite d′ instead of ±Infinity.
 *
 * **Known residual at unequal trial counts.** The correction is exactly
 * unbiased only when signals and noise are equally frequent; with the CPT's
 * 90 go / 30 no-go split it nudges the two rates by different amounts, so a
 * responder with no sensitivity at all does not land at exactly 0:
 *
 *   presses at everything -> d′ = +0.40    presses at nothing -> d′ = −0.40
 *   50/50 coin flip on both -> d′ = 0 exactly
 *
 * That is 8.6 % of this structure's d′ ceiling (4.68) and it points in the
 * direction of the response bias, which `criterion` reports alongside it. It is
 * a property of the estimator, documented rather than papered over; the floor
 * for "did this run discriminate anything" is |d′| ≈ 0.4, not 0.
 */
export function loglinearRates(counts: SdtCounts): SdtRates {
  return {
    hitRate: (counts.hits + 0.5) / (counts.signals + 1),
    falseAlarmRate: (counts.falseAlarms + 0.5) / (counts.noise + 1),
  };
}

// Acklam's rational approximation of the inverse standard normal CDF
// (relative error < 1.15e-9 over the whole open interval).
const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
] as const;
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
] as const;
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
] as const;
const D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
] as const;

const P_LOW = 0.02425;
const P_HIGH = 1 - P_LOW;

/** Inverse standard normal CDF: the z with Φ(z) = p, for p strictly inside (0, 1). */
export function probit(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new RangeError(`probit expects p strictly inside (0, 1), got ${p}`);
  }
  if (p < P_LOW || p > P_HIGH) {
    const tail = p < P_LOW ? p : 1 - p;
    const q = Math.sqrt(-2 * Math.log(tail));
    const x =
      (((((C[0]! * q + C[1]!) * q + C[2]!) * q + C[3]!) * q + C[4]!) * q + C[5]!) /
      ((((D[0]! * q + D[1]!) * q + D[2]!) * q + D[3]!) * q + 1);
    return p < P_LOW ? x : -x;
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((A[0]! * r + A[1]!) * r + A[2]!) * r + A[3]!) * r + A[4]!) * r + A[5]!) * q) /
    (((((B[0]! * r + B[1]!) * r + B[2]!) * r + B[3]!) * r + B[4]!) * r + 1)
  );
}

/** Sensitivity: z(hit rate) − z(false-alarm rate), on loglinear-corrected rates. */
export function dPrime(counts: SdtCounts): number {
  const { hitRate, falseAlarmRate } = loglinearRates(counts);
  return probit(hitRate) - probit(falseAlarmRate);
}

/**
 * Response bias: −0.5·(z(H) + z(F)). Negative = liberal (presses readily),
 * positive = conservative (withholds readily). Reported next to d′ because the
 * same commission count means different things at different biases.
 */
export function criterion(counts: SdtCounts): number {
  const { hitRate, falseAlarmRate } = loglinearRates(counts);
  return -0.5 * (probit(hitRate) + probit(falseAlarmRate));
}

/** The highest d′ this trial structure can produce — a flawless run. */
export function maxDPrime(signals: number, noise: number): number {
  return dPrime({ hits: signals, signals, falseAlarms: 0, noise });
}
