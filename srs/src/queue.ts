import type { Card } from './types.js';

/**
 * Interleave cards by topic using round-robin.
 *
 * Cards are first bucketed by topic (preserving their incoming order), then
 * emitted one-per-topic in rounds. Topics appear in the order their first card
 * was seen, so if the input is sorted by due date, the most-overdue topic leads.
 * The result never clusters a topic when another topic still has cards waiting.
 */
export function interleaveByTopic(cards: Card[]): Card[] {
  const buckets = new Map<string, Card[]>();
  const topicOrder: string[] = [];

  for (const card of cards) {
    let bucket = buckets.get(card.topic);
    if (!bucket) {
      bucket = [];
      buckets.set(card.topic, bucket);
      topicOrder.push(card.topic);
    }
    bucket.push(card);
  }

  const result: Card[] = [];
  let remaining = cards.length;
  while (remaining > 0) {
    for (const topic of topicOrder) {
      const bucket = buckets.get(topic)!;
      const next = bucket.shift();
      if (next) {
        result.push(next);
        remaining--;
      }
    }
  }
  return result;
}

/**
 * Build the review queue: cards whose `due` is at or before `now`, ordered by
 * due date, interleaved across topics, then capped at `limit`.
 *
 * @param cards  All candidate cards (typically every card in the store).
 * @param limit  Maximum cards to return. Non-positive returns an empty queue.
 * @param now    Reference time, epoch ms. Defaults to Date.now().
 */
export function getDueQueue(cards: Card[], limit: number, now: number = Date.now()): Card[] {
  if (limit <= 0) return [];

  const due = cards
    .filter((c) => c.due <= now)
    // Order by due date; break ties by id so the queue is deterministic
    // regardless of the storage backend's iteration order.
    .sort((a, b) => a.due - b.due || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return interleaveByTopic(due).slice(0, limit);
}
