const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

interface Attempts {
  failures: number[];
  blockedUntil: number;
}

export function createLoginLimiter(now: () => number) {
  const records = new Map<string, Attempts>();

  function prune(at: number) {
    for (const [key, record] of records) {
      const recent = record.failures.filter((t) => at - t < WINDOW_MS);
      if (recent.length === 0 && record.blockedUntil <= at) records.delete(key);
      else record.failures = recent;
    }
  }

  return {
    isBlocked(key: string): boolean {
      const at = now();
      prune(at);
      return (records.get(key)?.blockedUntil ?? 0) > at;
    },
    recordFailure(key: string): void {
      const at = now();
      const record = records.get(key) ?? { failures: [], blockedUntil: 0 };
      record.failures = record.failures.filter((t) => at - t < WINDOW_MS);
      record.failures.push(at);
      if (record.failures.length >= MAX_FAILURES) record.blockedUntil = at + BLOCK_MS;
      records.set(key, record);
    },
    reset(key: string): void {
      records.delete(key);
    },
  };
}
