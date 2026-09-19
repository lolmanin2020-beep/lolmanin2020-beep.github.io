import { Rating, State } from 'ts-fsrs';

export { Rating, State };

/**
 * A grade a human can actually give during review.
 * ts-fsrs also defines Rating.Manual (0) for manual scheduling; it is not a
 * review grade and must never be passed to reviewCard().
 */
export type Grade = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

/**
 * A point-in-time snapshot of a card's FSRS scheduling state.
 * All timestamps are epoch milliseconds (UTC) so the whole model is plain
 * JSON — safe for IndexedDB, structured clone, and network transfer.
 */
export interface FsrsSnapshot {
  /** When the card next becomes due (epoch ms). */
  due: number;
  stability: number;
  difficulty: number;
  /** Days elapsed since last_review at the moment of the last computation. */
  elapsed_days: number;
  /** Interval FSRS scheduled at the last review, in days. */
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  /** Last time the card was reviewed (epoch ms), or undefined if never. */
  last_review?: number;
}

/**
 * A flashcard. Content fields (cue/answer/topic/source_note_id) are authored
 * data; the FSRS fields are the card's *current* scheduling state, denormalized
 * onto the card so getDueQueue can filter without touching the review log.
 */
export interface Card extends FsrsSnapshot {
  id: string;
  /** Front of the card (the prompt). */
  cue: string;
  /** Back of the card (the thing being recalled). */
  answer: string;
  /** Grouping key used for interleaving in the due queue. */
  topic: string;
  /** When the card was authored (epoch ms). */
  created_at: number;
  /** Optional link back to the source note this card was mined from. */
  source_note_id?: string;
}

/**
 * An immutable record of a single review. Never mutated after write; the FSRS
 * state before and after are captured so scheduling can be audited or replayed.
 */
export interface ReviewLog {
  id: string;
  card_id: string;
  rating: Grade;
  /** How long the reviewer took to answer, in ms. */
  response_time_ms: number;
  /** When the review happened (epoch ms). */
  reviewed_at: number;
  state_before: FsrsSnapshot;
  state_after: FsrsSnapshot;
}
