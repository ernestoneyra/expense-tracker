/**
 * Counts events per key over a sliding window, in memory. That is enough for one server process; with
 * several instances each keeps its own count, so the effective limit is `max` per instance.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly max: number
  private readonly windowMs: number

  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
    setInterval(() => this.sweep(), windowMs).unref()
  }

  private recent(key: string, now: number) {
    const times = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (times.length) this.hits.set(key, times)
    else this.hits.delete(key)
    return times
  }

  /** Seconds until `key` may try again, or 0 if it may now. Doesn't count as an attempt. */
  retryAfter(key: string, now = Date.now()): number {
    const times = this.recent(key, now)
    if (times.length < this.max) return 0
    return Math.max(1, Math.ceil((times[0] + this.windowMs - now) / 1000))
  }

  record(key: string, now = Date.now()) {
    const times = this.recent(key, now)
    times.push(now)
    this.hits.set(key, times)
    // Bound memory against an attacker who varies the key.
    if (this.hits.size > 50_000) this.hits.delete(this.hits.keys().next().value!)
  }

  clear(key: string) {
    this.hits.delete(key)
  }

  private sweep() {
    const now = Date.now()
    for (const key of this.hits.keys()) this.recent(key, now)
  }
}
