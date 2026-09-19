import { describe, it, expect } from 'vitest';
import { getDueQueue, interleaveByTopic } from '../src/queue.js';
import { createCard } from '../src/scheduler.js';
import type { Card } from '../src/types.js';

const BASE = Date.UTC(2026, 0, 1);
const MIN = 60 * 1000;

/** Make a card due at an explicit offset (ms) from BASE, tagged with a topic. */
function cardDue(topic: string, dueOffset: number, label: string): Card {
  const c = createCard({ cue: label, answer: label, topic, now: BASE });
  return { ...c, due: BASE + dueOffset };
}

/** No two adjacent entries share a topic (given >1 topic is present). */
function hasNoAdjacentDuplicates(cards: Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    if (cards[i]!.topic === cards[i - 1]!.topic) return false;
  }
  return true;
}

describe('interleaveByTopic', () => {
  it('round-robins topics instead of clustering them', () => {
    // Three macro cards then three calc cards, all due.
    const cards: Card[] = [
      cardDue('macro', 0, 'm0'),
      cardDue('macro', 1, 'm1'),
      cardDue('macro', 2, 'm2'),
      cardDue('calc', 3, 'c0'),
      cardDue('calc', 4, 'c1'),
      cardDue('calc', 5, 'c2'),
    ];
    const out = interleaveByTopic(cards);
    expect(out.map((c) => c.topic)).toEqual(['macro', 'calc', 'macro', 'calc', 'macro', 'calc']);
    expect(hasNoAdjacentDuplicates(out)).toBe(true);
    // Same set of cards, just reordered.
    expect(out.length).toBe(cards.length);
  });

  it('drains a longer topic once shorter topics run out', () => {
    const cards: Card[] = [
      cardDue('macro', 0, 'm0'),
      cardDue('macro', 1, 'm1'),
      cardDue('macro', 2, 'm2'),
      cardDue('calc', 3, 'c0'),
    ];
    const out = interleaveByTopic(cards).map((c) => c.topic);
    expect(out).toEqual(['macro', 'calc', 'macro', 'macro']);
  });
});

describe('getDueQueue', () => {
  it('excludes cards that are not yet due', () => {
    const now = BASE + 10 * MIN;
    const cards: Card[] = [
      cardDue('macro', 0, 'due-now'),
      cardDue('macro', 5 * MIN, 'due-earlier'),
      cardDue('calc', 20 * MIN, 'not-yet'), // due after `now`
    ];
    const queue = getDueQueue(cards, 10, now);
    expect(queue.map((c) => c.cue).sort()).toEqual(['due-earlier', 'due-now']);
    expect(queue.every((c) => c.due <= now)).toBe(true);
  });

  it('orders by due date, interleaves topics, and respects the limit', () => {
    const now = BASE + 100 * MIN;
    const cards: Card[] = [
      cardDue('macro', 1 * MIN, 'm0'),
      cardDue('calc', 2 * MIN, 'c0'),
      cardDue('macro', 3 * MIN, 'm1'),
      cardDue('calc', 4 * MIN, 'c1'),
      cardDue('macro', 5 * MIN, 'm2'),
    ];
    const queue = getDueQueue(cards, 3, now);
    expect(queue.length).toBe(3);
    expect(hasNoAdjacentDuplicates(queue)).toBe(true);
    // Most-overdue topic (macro, earliest due) leads.
    expect(queue[0]!.topic).toBe('macro');
  });

  it('returns an empty queue for a non-positive limit', () => {
    const cards = [cardDue('macro', 0, 'm0')];
    expect(getDueQueue(cards, 0, BASE + MIN)).toEqual([]);
    expect(getDueQueue(cards, -3, BASE + MIN)).toEqual([]);
  });
});
