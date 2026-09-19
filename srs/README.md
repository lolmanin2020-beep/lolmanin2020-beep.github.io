# srs-core

Headless spaced-repetition core for the study site. **Stage 1: no UI.** It owns
the card model, the FSRS scheduling, the review log, and the due queue. Storage
is pluggable: an in-memory store for tests/Node and an IndexedDB store for the
browser. Scheduling uses [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs).

This lives under `srs/` and is deliberately isolated from the GitHub Pages site
at the repo root — it does not run on Pages, it is a library the site will
import later.

## Develop

```bash
cd srs
npm install
npm test        # vitest run
npm run typecheck
```

## Files

| File | Purpose |
| --- | --- |
| `src/types.ts` | `Card`, `ReviewLog`, `FsrsSnapshot`, `Grade`; re-exports `Rating`/`State`. |
| `src/scheduler.ts` | `createCard`, `reviewCard` (pure — no I/O), `snapshotOf`. |
| `src/queue.ts` | `getDueQueue(cards, limit, now)`, `interleaveByTopic`. |
| `src/store.ts` | `Store` interface + `MemoryStore`. |
| `src/idb-store.ts` | `IndexedDbStore` (browser). |
| `src/index.ts` | Public barrel export. |
| `test/scheduler.test.ts` | First four reviews, lapse + recovery, purity. |
| `test/queue.test.ts` | Topic interleaving, due filtering, limit. |
| `test/idb-store.test.ts` | IndexedDB round-trip via `fake-indexeddb`. |

## Data model

`Card` carries authored content (`cue`, `answer`, `topic`, `source_note_id`) plus
its **current** FSRS state denormalized onto it (`due`, `stability`, `difficulty`,
`elapsed_days`, `scheduled_days`, `reps`, `lapses`, `state`, `last_review`). All
timestamps are epoch milliseconds so the model is plain JSON.

`ReviewLog` is append-only: one row per review, capturing the FSRS snapshot
`state_before` and `state_after` so scheduling can be audited or replayed.

## Usage sketch

```ts
import { createCard, reviewCard, MemoryStore, Rating } from './src/index.js';

const store = new MemoryStore();
await store.putCard(createCard({ cue: 'multiplier?', answer: '1/(1-MPC)', topic: 'macro' }));

for (const card of await store.dueQueue(20)) {
  const { card: next, log } = reviewCard(card, Rating.Good, { response_time_ms: 1200 });
  await store.putCard(next);
  await store.addLog(log);
}
```

`getDueQueue` returns cards with `due <= now`, ordered by due date (ties broken by
`id` for determinism) and round-robin interleaved across topics so you don't get a
long run of one subject.
