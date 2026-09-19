import { describe, it, expect } from 'vitest';
import { fsrs } from 'ts-fsrs';
import { createCard, reviewCard } from '../src/scheduler.js';
import { Rating, State, type Card } from '../src/types.js';

const DAY = 24 * 60 * 60 * 1000;

/** Deterministic scheduler: fuzz off so intervals are reproducible in tests. */
const scheduler = fsrs({ enable_fuzz: false });

function newCard(overrides: Partial<{ topic: string; now: number }> = {}): Card {
  return createCard({
    cue: 'What is the multiplier?',
    answer: '1 / (1 - MPC)',
    topic: overrides.topic ?? 'macro',
    now: overrides.now ?? Date.UTC(2026, 0, 1),
  });
}

describe('createCard', () => {
  it('starts a card in the New state, due immediately, with zeroed counters', () => {
    const now = Date.UTC(2026, 0, 1);
    const card = newCard({ now });
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.due).toBe(now);
    expect(card.last_review).toBeUndefined();
    expect(card.created_at).toBe(now);
    expect(card.id).toBeTruthy();
  });
});

describe('first four reviews', () => {
  it('advances FSRS state and pushes the due date further out on each Good', () => {
    let card = newCard();
    let now = card.created_at;
    const dues: number[] = [];
    const states: State[] = [];

    for (let i = 0; i < 4; i++) {
      const result = reviewCard(card, Rating.Good, { now, scheduler, response_time_ms: 1500 });
      card = result.card;

      // The review log must bracket this review with before/after snapshots.
      expect(result.log.card_id).toBe(card.id);
      expect(result.log.rating).toBe(Rating.Good);
      expect(result.log.response_time_ms).toBe(1500);
      expect(result.log.reviewed_at).toBe(now);
      expect(result.log.state_after.reps).toBe(i + 1);
      expect(result.log.state_after.due).toBe(card.due);

      dues.push(card.due);
      states.push(card.state);

      // Next review happens when the card comes due.
      now = card.due;
    }

    // reps increments once per review.
    expect(card.reps).toBe(4);
    // Never lapsed, so still zero lapses and stability keeps climbing.
    expect(card.lapses).toBe(0);
    expect(card.stability).toBeGreaterThan(0);
    expect(card.last_review).toBeDefined();

    // A New card graduates to Learning and then to Review under repeated Good.
    expect(states[0]).toBe(State.Learning);
    expect(card.state).toBe(State.Review);

    // Due dates are strictly increasing across the four reviews.
    for (let i = 1; i < dues.length; i++) {
      expect(dues[i]!).toBeGreaterThan(dues[i - 1]!);
    }
  });
});

describe('lapse and recovery', () => {
  it('drops a reviewed card to Relearning on Again, counts the lapse, then recovers to Review', () => {
    // Get the card comfortably into the Review state first.
    let card = newCard();
    let now = card.created_at;
    for (let i = 0; i < 4; i++) {
      const r = reviewCard(card, Rating.Good, { now, scheduler });
      card = r.card;
      now = card.due;
    }
    expect(card.state).toBe(State.Review);
    const lapsesBefore = card.lapses;

    // Fail the card: Again should send it to Relearning and bump the lapse count.
    const failed = reviewCard(card, Rating.Again, { now, scheduler });
    card = failed.card;
    expect(card.state).toBe(State.Relearning);
    expect(card.lapses).toBe(lapsesBefore + 1);
    expect(failed.log.state_before.state).toBe(State.Review);
    expect(failed.log.state_after.state).toBe(State.Relearning);

    // Recover: successive Good grades bring it back to Review.
    now = card.due;
    for (let i = 0; i < 3 && card.state !== State.Review; i++) {
      const r = reviewCard(card, Rating.Good, { now, scheduler });
      card = r.card;
      now = card.due;
    }
    expect(card.state).toBe(State.Review);
    // The lapse is permanent history; recovery does not un-count it.
    expect(card.lapses).toBe(lapsesBefore + 1);
  });
});

describe('reviewCard purity', () => {
  it('does not mutate the input card', () => {
    const card = newCard();
    const snapshot = JSON.stringify(card);
    reviewCard(card, Rating.Good, { now: card.created_at, scheduler });
    expect(JSON.stringify(card)).toBe(snapshot);
  });
});

export { DAY };
