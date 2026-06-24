export const dbResultQueue: unknown[] = [];

// Payloads captured from chained `.values(...)` / `.set(...)` calls so tests can
// assert what would be written (e.g. the course cover imageUrl), independent of
// the queued read results.
export const recordedInserts: unknown[] = [];
export const recordedUpdates: unknown[] = [];
// Tables passed to `db.delete(...)` so tests can assert which rows a flow
// removes (delete has no payload to record, only the target table + a where).
export const recordedDeletes: unknown[] = [];

export function pushDbResult(...values: unknown[]): void {
  dbResultQueue.push(...values);
}

export function resetDbQueue(): void {
  dbResultQueue.length = 0;
  recordedInserts.length = 0;
  recordedUpdates.length = 0;
  recordedDeletes.length = 0;
}

function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const noop = (..._args: unknown[]): unknown => chain;
  const passthroughMethods = [
    "from",
    "where",
    "orderBy",
    "groupBy",
    "innerJoin",
    "leftJoin",
    "rightJoin",
    "fullJoin",
    "limit",
    "offset",
    "returning",
    "onConflictDoNothing",
    "onConflictDoUpdate",
    "having",
  ];
  for (const m of passthroughMethods) {
    chain[m] = noop;
  }
  chain.values = (payload: unknown): unknown => {
    recordedInserts.push(payload);
    return chain;
  };
  chain.set = (payload: unknown): unknown => {
    recordedUpdates.push(payload);
    return chain;
  };
  chain.then = (
    onF: (value: unknown) => unknown,
    onR?: (reason: unknown) => unknown,
  ): Promise<unknown> => {
    const value = dbResultQueue.length > 0 ? dbResultQueue.shift() : [];
    return Promise.resolve(value).then(onF, onR);
  };
  return chain;
}

export const dbMock = {
  select: (..._args: unknown[]) => makeChain(),
  selectDistinct: (..._args: unknown[]) => makeChain(),
  insert: (..._args: unknown[]) => makeChain(),
  update: (..._args: unknown[]) => makeChain(),
  delete: (table: unknown, ..._args: unknown[]) => {
    recordedDeletes.push(table);
    return makeChain();
  },
  transaction: async <T>(fn: (tx: typeof dbMock) => Promise<T>): Promise<T> => fn(dbMock),
};
