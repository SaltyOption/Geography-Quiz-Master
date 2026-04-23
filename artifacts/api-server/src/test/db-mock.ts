export const dbResultQueue: unknown[] = [];

export function pushDbResult(...values: unknown[]): void {
  dbResultQueue.push(...values);
}

export function resetDbQueue(): void {
  dbResultQueue.length = 0;
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
    "set",
    "values",
    "returning",
    "onConflictDoNothing",
    "onConflictDoUpdate",
    "having",
  ];
  for (const m of passthroughMethods) {
    chain[m] = noop;
  }
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
  insert: (..._args: unknown[]) => makeChain(),
  update: (..._args: unknown[]) => makeChain(),
  delete: (..._args: unknown[]) => makeChain(),
};
