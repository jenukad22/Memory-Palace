import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { getAbility, upsertAbility } from './ability';
import { insertAssessment } from './assessments';
import { createCard, getFsrsState, softDeleteCard } from './cards';
import { addLocus, createPalace, listLoci, reorderLoci } from './palaces';
import { recordReview } from './reviews';
import { endSession, startSession } from './sessions';
import {
  applyPullPayload,
  checkSyncedUser,
  collectPushPayload,
  countPending,
  emptyPayload,
  getDeviceId,
  getPullCursor,
  markPayloadSynced,
  setPullCursor,
  setSyncMeta,
  SYNC_META,
  type SyncPayload,
} from './sync';

const DEVICE = 'device-local';
const OTHER = 'device-remote';

describe('device identity and cursor', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('mints a device id once and keeps it', () => {
    const first = getDeviceId(db);
    expect(first).toMatch(/[0-9a-f-]{36}/);
    expect(getDeviceId(db)).toBe(first);
  });

  it('starts with a zero cursor and round-trips a new one', () => {
    expect(getPullCursor(db)).toBe('0');
    setPullCursor(db, '2026-08-01T00:00:00Z');
    expect(getPullCursor(db)).toBe('2026-08-01T00:00:00Z');
  });

  it('refuses a second account rather than merging two people’s data', () => {
    expect(checkSyncedUser(db, 'user-a')).toBe('first-sync');
    setSyncMeta(db, SYNC_META.syncedUserId, 'user-a');
    expect(checkSyncedUser(db, 'user-a')).toBe('ok');
    expect(checkSyncedUser(db, 'user-b')).toBe('different-user');
  });
});

describe('dirty-marking triggers', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('marks a card dirty on any content update, including paths that know nothing about sync', () => {
    const card = createCard(db, { module: 'memory', front: 'f', back: 'b' });
    const payload = collectPushPayload(db, DEVICE);
    markPayloadSynced(db, payload);
    expect(collectPushPayload(db, DEVICE).cards).toHaveLength(0);

    softDeleteCard(db, card.id);
    const after = collectPushPayload(db, DEVICE).cards;
    expect(after).toHaveLength(1);
    expect(after[0]!.is_deleted).toBe(true);
  });

  it('stamps updated_at forward on every update', () => {
    const card = createCard(db, {
      module: 'memory',
      front: 'f',
      back: 'b',
      now: new Date('2020-01-01T00:00:00Z'),
    });
    const before = collectPushPayload(db, DEVICE).cards[0]!.updated_at;
    expect(before).toBe(new Date('2020-01-01T00:00:00Z').getTime());
    softDeleteCard(db, card.id);
    const after = collectPushPayload(db, DEVICE).cards[0]!.updated_at;
    expect(after).toBeGreaterThan(before);
  });

  it('dirties the PARENT PALACE when a locus changes, not the locus', () => {
    const palace = createPalace(db, { name: 'Home' });
    markPayloadSynced(db, collectPushPayload(db, DEVICE));
    expect(collectPushPayload(db, DEVICE).palaces).toHaveLength(0);

    addLocus(db, { palaceId: palace.id, label: 'Door' });
    const dirty = collectPushPayload(db, DEVICE).palaces;
    expect(dirty).toHaveLength(1);
    expect(dirty[0]!.loci.map((l) => l.label)).toEqual(['Door']);
  });

  it('dirties the palace on a reorder too', () => {
    const palace = createPalace(db, { name: 'Home' });
    const a = addLocus(db, { palaceId: palace.id, label: 'A' });
    const b = addLocus(db, { palaceId: palace.id, label: 'B' });
    markPayloadSynced(db, collectPushPayload(db, DEVICE));

    reorderLoci(db, palace.id, [b.id, a.id]);
    const dirty = collectPushPayload(db, DEVICE).palaces;
    expect(dirty).toHaveLength(1);
    expect(dirty[0]!.loci.map((l) => l.label)).toEqual(['B', 'A']);
  });

  it('queues append-only inserts in the outbox, which is_synced could never do', () => {
    const card = createCard(db, { module: 'memory', front: 'f', back: 'b' });
    recordReview(db, { cardId: card.id, module: 'memory', rating: 'good' });
    insertAssessment(db, { instrument: 'vviq', rawScore: 40 });

    const payload = collectPushPayload(db, DEVICE);
    expect(payload.reviewLog).toHaveLength(1);
    expect(payload.assessments).toHaveLength(1);
    expect(payload.abilityLog.length).toBeGreaterThan(0); // recordReview writes one
  });

  it('clears the outbox only after a confirmed push', () => {
    const card = createCard(db, { module: 'memory', front: 'f', back: 'b' });
    recordReview(db, { cardId: card.id, module: 'memory', rating: 'good' });
    const payload = collectPushPayload(db, DEVICE);
    expect(countPending(db)).toBeGreaterThan(0);
    markPayloadSynced(db, payload);
    expect(countPending(db)).toBe(0);
  });

  it('marks a session dirty when it ends', () => {
    const id = startSession(db, 'memory');
    markPayloadSynced(db, collectPushPayload(db, DEVICE));
    endSession(db, id, { items: 5, accuracy: 0.8 });
    expect(collectPushPayload(db, DEVICE).sessions).toHaveLength(1);
  });
});

describe('applyPullPayload — class A union', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  const remoteCard = (id: string, over: Partial<SyncPayload['cards'][0]> = {}) => ({
    id,
    module: 'memory',
    front: 'f',
    back: 'b',
    payload: null,
    created_at: new Date('2026-07-01T00:00:00Z').getTime(),
    updated_at: new Date('2026-07-01T00:00:00Z').getTime(),
    is_deleted: false,
    device_id: OTHER,
    ...over,
  });

  it('inserts unseen log rows and ignores ones already present', () => {
    const payload: SyncPayload = {
      ...emptyPayload(),
      cards: [remoteCard('c1')],
      reviewLog: [
        {
          id: 'r1',
          card_id: 'c1',
          ts: new Date('2026-07-02T00:00:00Z').getTime(),
          rating: 'good',
          elapsed_ms: 100,
          difficulty: 5,
          stability: 1,
          retrievability: 0.9,
        },
      ],
    };
    const first = applyPullPayload(db, payload);
    expect(first.insertedLogRows).toBe(1);

    // Re-applying the same payload is a no-op — sync must be safe to re-run.
    const second = applyPullPayload(db, payload);
    expect(second.insertedLogRows).toBe(0);
  });

  it('does not echo a pulled log row straight back on the next push', () => {
    applyPullPayload(db, {
      ...emptyPayload(),
      cards: [remoteCard('c1')],
      reviewLog: [
        {
          id: 'r1',
          card_id: 'c1',
          ts: Date.now(),
          rating: 'good',
          elapsed_ms: 0,
          difficulty: 5,
          stability: 1,
          retrievability: 0.9,
        },
      ],
    });
    expect(collectPushPayload(db, DEVICE).reviewLog).toHaveLength(0);
  });

  it('skips a review whose card has not arrived yet instead of aborting the merge', () => {
    const result = applyPullPayload(db, {
      ...emptyPayload(),
      reviewLog: [
        {
          id: 'orphan',
          card_id: 'never-seen',
          ts: Date.now(),
          rating: 'good',
          elapsed_ms: 0,
          difficulty: 5,
          stability: 1,
          retrievability: 0.9,
        },
      ],
      assessments: [
        { id: 'a1', instrument: 'vviq', raw_score: 40, normalized: null, payload: null, ts: 1 },
      ],
    });
    expect(result.insertedLogRows).toBe(1); // the assessment landed; the orphan didn't
  });

  it('merges assessments and ability_log by union', () => {
    const payload: SyncPayload = {
      ...emptyPayload(),
      assessments: [
        { id: 'a1', instrument: 'vviq', raw_score: 40, normalized: null, payload: null, ts: 1 },
      ],
      abilityLog: [{ id: 'e1', module: 'memory', elo: 1300, ts: 2 }],
    };
    expect(applyPullPayload(db, payload).insertedLogRows).toBe(2);
    expect(applyPullPayload(db, payload).insertedLogRows).toBe(0);
  });
});

describe('applyPullPayload — class C conflict resolution', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('takes a remote card the device has never seen', () => {
    const result = applyPullPayload(db, {
      ...emptyPayload(),
      cards: [
        {
          id: 'c1',
          module: 'memory',
          front: 'remote',
          back: 'b',
          payload: null,
          created_at: 1,
          updated_at: 1,
          is_deleted: false,
          device_id: OTHER,
        },
      ],
    });
    expect(result.applied).toBe(1);
    // A pulled card must arrive with its 1:1 FSRS row or every later read breaks.
    expect(getFsrsState(db, 'c1')).toBeDefined();
  });

  it('keeps a newer local edit over an older remote one', () => {
    const card = createCard(db, { module: 'memory', front: 'local', back: 'b' });
    const result = applyPullPayload(db, {
      ...emptyPayload(),
      cards: [
        {
          id: card.id,
          module: 'memory',
          front: 'remote',
          back: 'b',
          payload: null,
          created_at: 1,
          updated_at: 1, // far older than the local row
          is_deleted: false,
          device_id: OTHER,
        },
      ],
    });
    expect(result.keptLocal).toBe(1);
    expect(collectPushPayload(db, DEVICE).cards[0]!.front).toBe('local');
  });

  it('lets a remote tombstone beat a newer local edit', () => {
    const card = createCard(db, { module: 'memory', front: 'local', back: 'b' });
    applyPullPayload(db, {
      ...emptyPayload(),
      cards: [
        {
          id: card.id,
          module: 'memory',
          front: 'local',
          back: 'b',
          payload: null,
          created_at: 1,
          updated_at: 1,
          is_deleted: true, // older, but a delete
          device_id: OTHER,
        },
      ],
    });
    const pending = collectPushPayload(db, DEVICE).cards;
    expect(pending).toHaveLength(0); // accepted and settled clean
  });

  it('does NOT re-dirty a row it just accepted — the two-step write', () => {
    // The whole point of the two-statement apply: a naive single UPDATE would
    // trip the dirty trigger and make this device push the row straight back.
    const card = createCard(db, { module: 'memory', front: 'local', back: 'b' });
    markPayloadSynced(db, collectPushPayload(db, DEVICE));
    expect(countPending(db)).toBe(0);

    applyPullPayload(db, {
      ...emptyPayload(),
      cards: [
        {
          id: card.id,
          module: 'memory',
          front: 'remote-wins',
          back: 'b',
          payload: null,
          created_at: card.createdAt.getTime(),
          updated_at: Date.now() + 60_000,
          is_deleted: false,
          device_id: OTHER,
        },
      ],
    });
    expect(countPending(db)).toBe(0);
    expect(collectPushPayload(db, DEVICE).cards).toHaveLength(0);
  });
});

describe('applyPullPayload — class D whole-list loci', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('replaces a palace’s whole loci list without violating the unique index', () => {
    const palace = createPalace(db, { name: 'Home' });
    addLocus(db, { palaceId: palace.id, label: 'A' });
    addLocus(db, { palaceId: palace.id, label: 'B' });
    addLocus(db, { palaceId: palace.id, label: 'C' });

    // Remote reversed the route and dropped one stop.
    applyPullPayload(db, {
      ...emptyPayload(),
      palaces: [
        {
          id: palace.id,
          name: 'Home',
          created_at: palace.createdAt.getTime(),
          updated_at: Date.now() + 60_000,
          is_deleted: false,
          device_id: OTHER,
          loci: [
            { id: 'l-c', palace_id: palace.id, position: 0, label: 'C', cue: null, created_at: 1 },
            { id: 'l-a', palace_id: palace.id, position: 1, label: 'A', cue: null, created_at: 1 },
          ],
        },
      ],
    });

    const merged = listLoci(db, palace.id);
    expect(merged.map((l) => l.label)).toEqual(['C', 'A']);
    expect(merged.map((l) => l.position)).toEqual([0, 1]);
  });

  it('settles the palace clean after a whole-list replace, despite the loci triggers', () => {
    const palace = createPalace(db, { name: 'Home' });
    addLocus(db, { palaceId: palace.id, label: 'A' });
    markPayloadSynced(db, collectPushPayload(db, DEVICE));

    applyPullPayload(db, {
      ...emptyPayload(),
      palaces: [
        {
          id: palace.id,
          name: 'Home',
          created_at: palace.createdAt.getTime(),
          updated_at: Date.now() + 60_000,
          is_deleted: false,
          device_id: OTHER,
          loci: [
            { id: 'l-x', palace_id: palace.id, position: 0, label: 'X', cue: null, created_at: 1 },
          ],
        },
      ],
    });
    // Deleting + re-inserting loci fires loci_bump_palace_*, which dirties the
    // palace. The apply must settle it clean again or it echoes back forever.
    expect(collectPushPayload(db, DEVICE).palaces).toHaveLength(0);
  });

  it('keeps the local route when the local edit is newer', () => {
    const palace = createPalace(db, { name: 'Home' });
    addLocus(db, { palaceId: palace.id, label: 'LocalStop' });

    applyPullPayload(db, {
      ...emptyPayload(),
      palaces: [
        {
          id: palace.id,
          name: 'Home',
          created_at: palace.createdAt.getTime(),
          updated_at: 1, // ancient
          is_deleted: false,
          device_id: OTHER,
          loci: [],
        },
      ],
    });
    expect(listLoci(db, palace.id).map((l) => l.label)).toEqual(['LocalStop']);
  });
});

describe('derived state is recomputed, not merged', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('replays a merged review history so BOTH devices’ reviews count', () => {
    const card = createCard(db, {
      module: 'memory',
      front: 'f',
      back: 'b',
      now: new Date('2026-07-01T00:00:00Z'),
    });
    // This device reviewed once.
    recordReview(db, {
      cardId: card.id,
      module: 'memory',
      rating: 'good',
      now: new Date('2026-07-02T10:00:00Z'),
    });
    expect(getFsrsState(db, card.id)!.reps).toBe(1);

    // The other device reviewed the same card offline, an hour later.
    applyPullPayload(db, {
      ...emptyPayload(),
      reviewLog: [
        {
          id: 'remote-review',
          card_id: card.id,
          ts: new Date('2026-07-02T11:00:00Z').getTime(),
          rating: 'again',
          elapsed_ms: 0,
          difficulty: 5,
          stability: 1,
          retrievability: 0.9,
        },
      ],
    });

    // Replay counted both, which is exactly what LWW on fsrs_state would miss.
    expect(getFsrsState(db, card.id)!.reps).toBe(2);
  });

  it('refreshes the ability cache from the newest entry in the merged log', () => {
    upsertAbility(db, 'memory', 1200, new Date('2026-07-01T00:00:00Z'));
    applyPullPayload(db, {
      ...emptyPayload(),
      abilityLog: [
        {
          id: 'newer',
          module: 'memory',
          elo: 1450,
          ts: new Date('2026-07-09T00:00:00Z').getTime(),
        },
      ],
    });
    expect(getAbility(db, 'memory')!.elo).toBe(1450);
  });

  it('leaves the ability cache alone when the merged entry is older', () => {
    upsertAbility(db, 'memory', 1200, new Date('2026-07-09T00:00:00Z'));
    applyPullPayload(db, {
      ...emptyPayload(),
      abilityLog: [
        { id: 'older', module: 'memory', elo: 900, ts: new Date('2026-07-01T00:00:00Z').getTime() },
      ],
    });
    expect(getAbility(db, 'memory')!.elo).toBe(1200);
  });
});
