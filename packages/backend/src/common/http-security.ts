import type { NextFunction, Request, Response } from "express";

type RateBucket = { count: number; resetAt: number };
const buckets = new Map<string, RateBucket>();

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/health" || req.path.startsWith("/health/")) return next();

  const now = Date.now();
  const windowMs = positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const maxRequests = positiveInt(process.env.RATE_LIMIT_MAX, 120);
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  res.setHeader("RateLimit-Limit", maxRequests);
  res.setHeader("RateLimit-Remaining", Math.max(0, maxRequests - bucket.count));
  res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

  if (bucket.count > maxRequests) {
    res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ statusCode: 429, message: "Too many requests" });
    return;
  }
  next();
}

export function resetRateLimitState() {
  buckets.clear();
}
