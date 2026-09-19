import type { Card, ReviewLog } from './types.js';
import { getDueQueue } from './queue.js';
import type { Store } from './store.js';

const CARDS = 'cards';
const LOGS = 'logs';
const LOG_CARD_INDEX = 'by_card_id';

/** Wrap an IDBRequest as a promise. */
function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB-backed Store for the browser. Two object stores: `cards` keyed by
 * id, and `logs` keyed by id with an index on card_id. Open with
 * `IndexedDbStore.open(name)`.
 */
export class IndexedDbStore implements Store {
  private constructor(private db: IDBDatabase) {}

  static open(name = 'srs', indexedDB: IDBFactory = globalThis.indexedDB): Promise<IndexedDbStore> {
    if (!indexedDB) {
      throw new Error('IndexedDB is not available in this environment');
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CARDS)) {
          db.createObjectStore(CARDS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(LOGS)) {
          const logs = db.createObjectStore(LOGS, { keyPath: 'id' });
          logs.createIndex(LOG_CARD_INDEX, 'card_id', { unique: false });
        }
      };
      req.onsuccess = () => resolve(new IndexedDbStore(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  private tx(stores: string | string[], mode: IDBTransactionMode): IDBTransaction {
    return this.db.transaction(stores, mode);
  }

  async putCard(card: Card): Promise<void> {
    const tx = this.tx(CARDS, 'readwrite');
    tx.objectStore(CARDS).put(card);
    await txDone(tx);
  }

  async getCard(id: string): Promise<Card | undefined> {
    const tx = this.tx(CARDS, 'readonly');
    const result = await reqPromise<Card | undefined>(tx.objectStore(CARDS).get(id));
    return result ?? undefined;
  }

  async allCards(): Promise<Card[]> {
    const tx = this.tx(CARDS, 'readonly');
    return reqPromise<Card[]>(tx.objectStore(CARDS).getAll());
  }

  async deleteCard(id: string): Promise<void> {
    const tx = this.tx(CARDS, 'readwrite');
    tx.objectStore(CARDS).delete(id);
    await txDone(tx);
  }

  async addLog(log: ReviewLog): Promise<void> {
    const tx = this.tx(LOGS, 'readwrite');
    tx.objectStore(LOGS).put(log);
    await txDone(tx);
  }

  async logsForCard(cardId: string): Promise<ReviewLog[]> {
    const tx = this.tx(LOGS, 'readonly');
    const index = tx.objectStore(LOGS).index(LOG_CARD_INDEX);
    return reqPromise<ReviewLog[]>(index.getAll(cardId));
  }

  async allLogs(): Promise<ReviewLog[]> {
    const tx = this.tx(LOGS, 'readonly');
    return reqPromise<ReviewLog[]>(tx.objectStore(LOGS).getAll());
  }

  async dueQueue(limit: number, now?: number): Promise<Card[]> {
    return getDueQueue(await this.allCards(), limit, now);
  }

  close(): void {
    this.db.close();
  }
}

/** Resolve once a readwrite transaction commits. */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
