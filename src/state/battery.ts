import { create } from 'zustand';

/**
 * In-memory bookkeeping for the battery's sessions row. The battery's
 * done-state itself derives from assessments rows (src/assessment/battery.ts);
 * this store only carries the open session id across screens. Lost on app
 * restart by design — a resumed battery segment opens a new sessions row.
 */
export interface BatterySessionState {
  sessionId: string | null;
  itemsDone: number;
  begin: (sessionId: string) => void;
  recordItem: () => void;
  reset: () => void;
}

export const useBatterySession = create<BatterySessionState>((set) => ({
  sessionId: null,
  itemsDone: 0,
  begin: (sessionId) => set({ sessionId, itemsDone: 0 }),
  recordItem: () => set((s) => ({ itemsDone: s.itemsDone + 1 })),
  reset: () => set({ sessionId: null, itemsDone: 0 }),
}));
