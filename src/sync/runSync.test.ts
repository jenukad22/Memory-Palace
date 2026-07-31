import { beforeEach, describe, expect, it } from 'vitest';
import { createCard, getFsrsState, softDeleteCard } from '@/db/queries/cards';
import { addLocus, createPalace, listLoci, reorderLoci } from '@/db/queries/palaces';
import { recordReview } from '@/db/queries/reviews';
import {
  applyPullPayload,
  countPending,
  emptyPayload,
  setSyncMeta,
  SYNC_META,
  type SyncPayload,
} from '@/db/queries/sync';
import { cards } from '@/db/schema';
import { createTestDb } from '@/db/testing';
import type { Db } from '@/db/types';
import { runSync } from './runSync';
import { DifferentUserError, type PullResult, type SyncTransport } from './transport';

/**
 * An in-memory stand-in for the server: stores rows by primary key, hands back
 * everything newer than a cursor. Enough to exercise the ordering rules and a
 * genuine two-device round trip without a network.
 */
class FakeServer implements SyncTransport {
  private store: SyncPayload = emptyPayload();
  private version = 0;
  private versions = new Map<string, number>();
  /** Set to make the next push reject, simulating a dropped connection. */
  failNextPush = false;
  pushCount = 0;

  async pull(cursor: string): Promise<PullResult> {
    const since = Number(cursor) || 0;
    const keep = <T extends { id: string }>(rows: T[], table: string) =>
      rows.filter((r) => (this.versions.get(`${table}:${r.id}`) ?? 0) > since);
    return {
      payload: {
        cards: keep(this.store.cards, 'cards'),
        palaces: keep(this.store.palaces, 'palaces'),
        sessions: keep(this.store.sessions, 'sessions'),
        reviewLog: keep(this.store.reviewLog, 'review_log'),
        abilityLog: keep(this.store.abilityLog, 'ability_log'),
        assessments: keep(this.store.assessments, 'assessments'),
      },
      cursor: String(this.version),
    };
  }

  async push(payload: SyncPayload): Promise<void> {
    this.pushCount += 1;
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('network down');
    }
    this.version += 1;
    const upsert = <T extends { id: string }>(into: T[], rows: T[], table: string) => {
      for (const row of rows) {
        const i = into.findIndex((r) => r.id === row.id);
        if (i === -1) into.push(row);
        else into[i] = row;
        this.versions.set(`${table}:${row.id}`, this.version);
      }
    };
    upsert(this.store.cards, payload.cards, 'cards');
    upsert(this.store.palaces, payload.palaces, 'palaces');
    upsert(this.store.sessions, payload.sessions, 'sessions');
    upsert(this.store.reviewLog, payload.reviewLog, 'review_log');
    upsert(this.store.abilityLog, payload.abilityLog, 'ability_log');
    upsert(this.store.assessments, payload.assessments, 'assessments');
  }
}

const USER = 'user-1';

describe('runSync — a single device', () => {
  let db: Db;
  let server: FakeServer;
  beforeEach(async () => {
    ({ db } = await createTestDb());
    server = new FakeServer();
  });

  it('pushes local work and ends with nothing pending', async () => {
    createCard(db, { module: 'memory', front: 'f', back: 'b' });
    const out = await runSync({ db, transport: server, userId: USER });
    expect(out.pushed).toBeGreaterThan(0);
    expect(out.pending).toBe(0);
  });

  it('is a no-op the second time — nothing new to push or pull', async () => {
    createCard(db, { module: 'memory', front: 'f', back: 'b' });
    await runSync({ db, transport: server, userId: USER });
    const second = await runSync({ db, transport: server, userId: USER });
    expect(second.pushed).toBe(0);
    expect(second.applied).toBe(0);
    expect(second.pending).toBe(0);
  });

  it('records the account on first sync and refuses a different one after', async () => {
    await runSync({ db, transport: server, userId: USER });
    await expect(runSync({ db, transport: server, userId: 'someone-else' })).rejects.toBeInstanceOf(
      DifferentUserError,
    );
  });

  it('leaves work pending when the push fails, and re-sends it next cycle', async () => {
    createCard(db, { module: 'memory', front: 'f', back: 'b' });
    server.failNextPush = true;
    await expect(runSync({ db, transport: server, userId: USER })).rejects.toThrow('network down');

    // Nothing was marked clean, so the work is still queued.
    expect(countPending(db)).toBeGreaterThan(0);

    const retry = await runSync({ db, transport: server, userId: USER });
    expect(retry.pushed).toBeGreaterThan(0);
    expect(retry.pending).toBe(0);
  });

  it('does not advance the cursor when the cycle fails', async () => {
    createCard(db, { module: 'memory', front: 'f', back: 'b' });
    server.failNextPush = true;
    await expect(runSync({ db, transport: server, userId: USER })).rejects.toThrow();
    const after = await runSync({ db, transport: server, userId: USER });
    expect(after.pending).toBe(0);
  });

  it('never sends a payload it has already had confirmed', async () => {
    createCard(db, { module: 'memory', front: 'f', back: 'b' });
    await runSync({ db, transport: server, userId: USER });
    const pushesAfterFirst = server.pushCount;
    await runSync({ db, transport: server, userId: USER });
    expect(server.pushCount).toBe(pushesAfterFirst); // no empty push at all
  });
});

describe('runSync — two devices reconciling after being offline', () => {
  let deviceA: Db;
  let deviceB: Db;
  let server: FakeServer;

  beforeEach(async () => {
    ({ db: deviceA } = await createTestDb());
    ({ db: deviceB } = await createTestDb());
    server = new FakeServer();
    // Distinct device ids, as two real machines would have.
    setSyncMeta(deviceA, SYNC_META.deviceId, 'device-a');
    setSyncMeta(deviceB, SYNC_META.deviceId, 'device-b');
  });

  const syncA = () => runSync({ db: deviceA, transport: server, userId: USER });
  const syncB = () => runSync({ db: deviceB, transport: server, userId: USER });

  it('carries a card created on A over to B', async () => {
    createCard(deviceA, { id: 'card-1', module: 'memory', front: 'from A', back: 'b' });
    await syncA();
    await syncB();

    const onB = deviceB.select().from(cards).all();
    expect(onB.map((c) => c.front)).toContain('from A');
  });

  it('converges: after both sync twice, neither has anything pending', async () => {
    createCard(deviceA, { id: 'a-card', module: 'memory', front: 'A', back: 'b' });
    createCard(deviceB, { id: 'b-card', module: 'memory', front: 'B', back: 'b' });

    await syncA();
    await syncB();
    await syncA();
    await syncB();

    expect(countPending(deviceA)).toBe(0);
    expect(countPending(deviceB)).toBe(0);
  });

  it('merges reviews made independently on both devices while offline', async () => {
    // Both devices start from the same card.
    createCard(deviceA, {
      id: 'shared',
      module: 'memory',
      front: 'f',
      back: 'b',
      now: new Date('2026-07-01T00:00:00Z'),
    });
    await syncA();
    await syncB();

    // Offline: each reviews the same card once.
    recordReview(deviceA, {
      cardId: 'shared',
      module: 'memory',
      rating: 'good',
      now: new Date('2026-07-02T10:00:00Z'),
    });
    recordReview(deviceB, {
      cardId: 'shared',
      module: 'memory',
      rating: 'again',
      now: new Date('2026-07-02T11:00:00Z'),
    });
    expect(getFsrsState(deviceA, 'shared')!.reps).toBe(1);
    expect(getFsrsState(deviceB, 'shared')!.reps).toBe(1);

    // Back online.
    await syncA();
    await syncB();
    await syncA();

    // Both reviews survive on both devices, and the schedule reflects both.
    expect(getFsrsState(deviceA, 'shared')!.reps).toBe(2);
    expect(getFsrsState(deviceB, 'shared')!.reps).toBe(2);
  });

  it('reaches the same scheduling state on both devices after a merge', async () => {
    createCard(deviceA, {
      id: 'shared',
      module: 'memory',
      front: 'f',
      back: 'b',
      now: new Date('2026-07-01T00:00:00Z'),
    });
    await syncA();
    await syncB();
    recordReview(deviceA, {
      cardId: 'shared',
      module: 'memory',
      rating: 'good',
      now: new Date('2026-07-02T10:00:00Z'),
    });
    recordReview(deviceB, {
      cardId: 'shared',
      module: 'memory',
      rating: 'hard',
      now: new Date('2026-07-03T10:00:00Z'),
    });

    await syncA();
    await syncB();
    await syncA();
    await syncB();

    const a = getFsrsState(deviceA, 'shared')!;
    const b = getFsrsState(deviceB, 'shared')!;
    // Replay is deterministic, so both machines land on the same schedule.
    expect(a.reps).toBe(b.reps);
    expect(a.stability).toBeCloseTo(b.stability, 10);
    expect(a.due.getTime()).toBe(b.due.getTime());
  });

  it('propagates a delete made on one device to the other', async () => {
    createCard(deviceA, { id: 'doomed', module: 'memory', front: 'f', back: 'b' });
    await syncA();
    await syncB();

    softDeleteCard(deviceA, 'doomed');
    await syncA();
    await syncB();

    const onB = deviceB.select().from(cards).all();
    expect(onB.find((c) => c.id === 'doomed')?.isDeleted).toBe(true);
  });

  it('carries a whole route across, positions intact', async () => {
    const palace = createPalace(deviceA, { id: 'p1', name: 'Home' });
    addLocus(deviceA, { palaceId: palace.id, label: 'Door' });
    addLocus(deviceA, { palaceId: palace.id, label: 'Hall' });
    addLocus(deviceA, { palaceId: palace.id, label: 'Kitchen' });

    await syncA();
    await syncB();

    const onB = listLoci(deviceB, 'p1');
    expect(onB.map((l) => l.label)).toEqual(['Door', 'Hall', 'Kitchen']);
    expect(onB.map((l) => l.position)).toEqual([0, 1, 2]);
  });

  it('applies a reorder from the other device without breaking the unique index', async () => {
    const palace = createPalace(deviceA, { id: 'p1', name: 'Home' });
    const a = addLocus(deviceA, { palaceId: palace.id, label: 'A' });
    const b = addLocus(deviceA, { palaceId: palace.id, label: 'B' });
    const c = addLocus(deviceA, { palaceId: palace.id, label: 'C' });
    await syncA();
    await syncB();

    reorderLoci(deviceA, palace.id, [c.id, a.id, b.id]);
    await syncA();
    await syncB();

    expect(listLoci(deviceB, 'p1').map((l) => l.label)).toEqual(['C', 'A', 'B']);
    expect(listLoci(deviceB, 'p1').map((l) => l.position)).toEqual([0, 1, 2]);
  });

  it('does not ping-pong rows back and forth once converged', async () => {
    createCard(deviceA, { module: 'memory', front: 'f', back: 'b' });
    await syncA();
    await syncB();
    await syncA();

    const before = server.pushCount;
    await syncB();
    await syncA();
    await syncB();
    // Converged: no device should still be pushing anything.
    expect(server.pushCount).toBe(before);
  });
});

describe('applyPullPayload is safe to re-run', () => {
  it('re-applying the identical payload changes nothing', async () => {
    const { db } = await createTestDb();
    const payload: SyncPayload = {
      ...emptyPayload(),
      cards: [
        {
          id: 'c1',
          module: 'memory',
          front: 'f',
          back: 'b',
          payload: null,
          created_at: 1,
          updated_at: 1,
          is_deleted: false,
          device_id: 'other',
        },
      ],
    };
    const first = applyPullPayload(db, payload);
    const second = applyPullPayload(db, payload);
    expect(first.applied).toBe(1);
    expect(second.applied).toBe(0);
    expect(countPending(db)).toBe(0);
  });
});
