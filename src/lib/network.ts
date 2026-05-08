// Resilience helpers: online state, retry/backoff, simple in-memory scan queue.

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export interface RetryOpts {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  signal?: AbortSignal;
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseMs ?? 400;
  const max = opts.maxMs ?? 3500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (opts.signal?.aborted) throw e;
      if (opts.shouldRetry && !opts.shouldRetry(e)) throw e;
      // Don't retry rate-limit / payment errors — they need user action.
      const msg = String((e as any)?.message || e);
      if (/rate limit|credits|402|429/i.test(msg)) throw e;
      if (attempt === retries) break;
      const delay = Math.min(max, base * Math.pow(2, attempt)) + Math.random() * 150;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
