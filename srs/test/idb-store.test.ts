import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbStore } from '../src/idb-store.js';
import { MemoryStore } from '../src/store.js';
import { createCard, reviewCard } from '../src/scheduler.js';
import { Rating } from '../src/types.js';

// Fresh IndexedDB per test so object stores don't leak between cases.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDbStore', () => {
  it('round-trips cards and logs through the browser storage path', async () => {
    const store = await IndexedDbStore.open('test-db');
    const card = createCard({ cue: 'q', answer: 'a', topic: 'macro', now: Date.UTC(2026, 0, 1) });
    await store.putCard(card);

    const { card: reviewed, log } = reviewCard(card, Rating.Good, { now: card.created_at });
    await store.putCard(reviewed);
    await store.addLog(log);

    expect(await store.getCard(card.id)).toEqual(reviewed);
    expect(await store.logsForCard(card.id)).toEqual([log]);
    expect((await store.allCards()).length).toBe(1);
    expect((await store.allLogs()).length).toBe(1);
    store.close();
  });

  it('produces the same due queue as the in-memory store', async () => {
    const now = Date.UTC(2026, 0, 2);
    const cards = [
      createCard({ cue: 'm0', answer: 'a', topic: 'macro', now: Date.UTC(2026, 0, 1) }),
      createCard({ cue: 'c0', answer: 'a', topic: 'calc', now: Date.UTC(2026, 0, 1) }),
      createCard({ cue: 'm1', answer: 'a', topic: 'macro', now: Date.UTC(2026, 0, 1) }),
    ];

    const mem = new MemoryStore();
    const idb = await IndexedDbStore.open('queue-db');
    for (const c of cards) {
      await mem.putCard(c);
      await idb.putCard(c);
    }

    const memQueue = (await mem.dueQueue(10, now)).map((c) => c.id);
    const idbQueue = (await idb.dueQueue(10, now)).map((c) => c.id);
    expect(idbQueue).toEqual(memQueue);
    expect(idbQueue.length).toBe(3);
    idb.close();
  });
});
