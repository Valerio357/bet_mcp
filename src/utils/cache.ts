export class MemoryCache<T> {
  private store = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlSeconds: number) {}

  public get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  public set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
  }
}
