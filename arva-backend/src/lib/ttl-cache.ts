// A tiny in-memory cache. Each server instance has its own copy.
export interface TtlCache<T> {
  // Returns the cached value, or loads it. A null result is NOT cached.
  getOrLoad(key: string, load: () => Promise<T | null>): Promise<T | null>;
  clear(): void;
}

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  const entries = new Map<string, { value: T; expiresAt: number }>();

  return {
    async getOrLoad(key, load) {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
      const value = await load();
      if (value !== null) {
        entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}
