import type { Card, ReviewLog } from './types.js';
import { getDueQueue } from './queue.js';

/**
 * Persistence boundary for the SRS core. Everything is async so the same
 * interface covers an in-memory Map (tests, Node) and IndexedDB (browser).
 */
export interface Store {
  putCard(card: Card): Promise<void>;
  getCard(id: string): Promise<Card | undefined>;
  allCards(): Promise<Card[]>;
  deleteCard(id: string): Promise<void>;

  addLog(log: ReviewLog): Promise<void>;
  logsForCard(cardId: string): Promise<ReviewLog[]>;
  allLogs(): Promise<ReviewLog[]>;

  /** Convenience: due queue built from all stored cards. */
  dueQueue(limit: number, now?: number): Promise<Card[]>;
}

/** In-memory Store. Data lives only for the process lifetime. */
export class MemoryStore implements Store {
  private cards = new Map<string, Card>();
  private logs: ReviewLog[] = [];

  async putCard(card: Card): Promise<void> {
    // Clone so external mutation of the passed object can't corrupt the store.
    this.cards.set(card.id, { ...card });
  }

  async getCard(id: string): Promise<Card | undefined> {
    const c = this.cards.get(id);
    return c ? { ...c } : undefined;
  }

  async allCards(): Promise<Card[]> {
    return [...this.cards.values()].map((c) => ({ ...c }));
  }

  async deleteCard(id: string): Promise<void> {
    this.cards.delete(id);
  }

  async addLog(log: ReviewLog): Promise<void> {
    this.logs.push({ ...log });
  }

  async logsForCard(cardId: string): Promise<ReviewLog[]> {
    return this.logs.filter((l) => l.card_id === cardId).map((l) => ({ ...l }));
  }

  async allLogs(): Promise<ReviewLog[]> {
    return this.logs.map((l) => ({ ...l }));
  }

  async dueQueue(limit: number, now?: number): Promise<Card[]> {
    return getDueQueue(await this.allCards(), limit, now);
  }
}
