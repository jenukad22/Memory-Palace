/** Local calendar-day helpers, shared by the campaign day/week math and the
 * streak/consistency engine — both need the same "what day is this?" answer. */

/** Local midnight for the given instant — the calendar-day boundary this app uses throughout. */
export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whether two instants fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime();
}
