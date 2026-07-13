import { rateLimit, resetRateLimitState, securityHeaders } from "./http-security";

function response() {
  const headers: Record<string, unknown> = {};
  return {
    headers,
    statusCode: 200,
    body: undefined as unknown,
    setHeader: jest.fn((name: string, value: unknown) => { headers[name] = value; }),
    status: jest.fn(function (this: any, code: number) { this.statusCode = code; return this; }),
    json: jest.fn(function (this: any, body: unknown) { this.body = body; return this; }),
  };
}

describe("HTTP security middleware", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    resetRateLimitState();
  });

  it("sets defensive API response headers", () => {
    const res = response();
    const next = jest.fn();
    securityHeaders({} as any, res as any, next);
    expect(res.headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 429 after the configured per-IP allowance", () => {
    process.env.RATE_LIMIT_MAX = "2";
    const req = { path: "/expenses", ip: "127.0.0.1", socket: {} };
    const first = response();
    const second = response();
    const third = response();
    rateLimit(req as any, first as any, jest.fn());
    rateLimit(req as any, second as any, jest.fn());
    rateLimit(req as any, third as any, jest.fn());
    expect(third.statusCode).toBe(429);
    expect(third.body).toEqual({ statusCode: 429, message: "Too many requests" });
  });

  it("does not rate-limit health probes", () => {
    process.env.RATE_LIMIT_MAX = "1";
    const req = { path: "/health/ready", ip: "127.0.0.1", socket: {} };
    const next = jest.fn();
    rateLimit(req as any, response() as any, next);
    rateLimit(req as any, response() as any, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
