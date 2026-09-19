import { createEmptyCard, fsrs, FSRS, type Card as FsrsCard } from 'ts-fsrs';
import type { Card, FsrsSnapshot, Grade, ReviewLog } from './types.js';

/** Generate a unique id, preferring the platform's crypto.randomUUID. */
function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for exotic environments without WebCrypto.
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Pull the FSRS scheduling fields off a card into a bare snapshot. */
export function snapshotOf(card: Card): FsrsSnapshot {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review,
  };
}

/** Build a ts-fsrs card (Date-based) from our epoch-ms snapshot. */
function toFsrsCard(s: FsrsSnapshot): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review !== undefined ? new Date(s.last_review) : undefined,
  };
}

/** Convert a ts-fsrs card back into our epoch-ms snapshot. */
function fromFsrsCard(c: FsrsCard): FsrsSnapshot {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : undefined,
  };
}

export interface CreateCardInput {
  cue: string;
  answer: string;
  topic: string;
  source_note_id?: string;
  /** Override the generated id (mainly for tests / imports). */
  id?: string;
  /** Creation time, epoch ms. Defaults to Date.now(). */
  now?: number;
}

/** Create a brand-new card in the FSRS "New" state, due immediately. */
export function createCard(input: CreateCardInput): Card {
  const now = input.now ?? Date.now();
  const snapshot = fromFsrsCard(createEmptyCard(new Date(now)));
  return {
    id: input.id ?? newId(),
    cue: input.cue,
    answer: input.answer,
    topic: input.topic,
    created_at: now,
    source_note_id: input.source_note_id,
    ...snapshot,
  };
}

export interface ReviewOptions {
  /** Review time, epoch ms. Defaults to Date.now(). */
  now?: number;
  /** How long the reviewer took, ms. Defaults to 0. */
  response_time_ms?: number;
  /** Reuse a scheduler instance (avoids re-parsing params per review). */
  scheduler?: FSRS;
}

/**
 * Apply a review grade to a card. Returns the updated card and an immutable
 * ReviewLog. Pure: it does not mutate the input card and does no I/O.
 */
export function reviewCard(
  card: Card,
  rating: Grade,
  opts: ReviewOptions = {},
): { card: Card; log: ReviewLog } {
  const now = opts.now ?? Date.now();
  const f = opts.scheduler ?? fsrs();

  const state_before = snapshotOf(card);
  const record = f.repeat(toFsrsCard(state_before), new Date(now));
  const state_after = fromFsrsCard(record[rating].card);

  const updated: Card = {
    ...card,
    ...state_after,
  };

  const log: ReviewLog = {
    id: newId(),
    card_id: card.id,
    rating,
    response_time_ms: opts.response_time_ms ?? 0,
    reviewed_at: now,
    state_before,
    state_after,
  };

  return { card: updated, log };
}
