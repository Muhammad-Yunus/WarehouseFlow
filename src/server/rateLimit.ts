import type { NextFunction, Request, Response } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  bucketPrefix: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, RateLimitBucket>();

  // Periodically evict expired buckets to keep memory bounded in long-running processes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store.entries()) {
      if (bucket.resetAt <= now) {
        store.delete(key);
      }
    }
  }, Math.max(30_000, Math.min(options.windowMs, 300_000)));
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const customKey = options.keyGenerator ? options.keyGenerator(req) : clientIp;
    const key = `${options.bucketPrefix}:${customKey}`;

    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs,
      };
      store.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(options.maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > options.maxRequests) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({
        error: options.message || 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    next();
  };
}
