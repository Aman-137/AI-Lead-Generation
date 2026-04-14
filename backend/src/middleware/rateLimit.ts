import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";

// NOTE: Uses in-memory store (default). Fine for single-instance deployments.
// For multi-instance scaling, switch to rate-limit-redis:
//   import RedisStore from "rate-limit-redis";
//   store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })

// Extract user ID from auth token for user-based rate limiting
// Falls back to IP (with IPv6 normalization) for unauthenticated routes
function getUserKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    // Decode JWT payload to get stable user ID (sub claim)
    // This is safe — auth middleware verifies the signature later
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString()
      );
      if (payload.sub) return `user_${payload.sub}`;
    } catch {
      // Malformed token — fall through to IP-based limiting
    }
  }
  return ipKeyGenerator(req.ip || "unknown");
}

// General API rate limiter: 100 requests per 15 minutes per user
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: getUserKey,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for email sending: 10 requests per hour per user
export const sendEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: getUserKey,
  message: { error: "Email sending rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for AI generation: 20 requests per hour per user
export const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: getUserKey,
  message: { error: "Generation rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter: 20 requests per 15 minutes per IP (stays IP-based for login/signup)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for lead finding: 5 requests per hour per user (resource-intensive)
export const autoFindLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: getUserKey,
  message: {
    error: "Lead finding rate limit exceeded. Maximum 5 searches per hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for enrichment: 10 requests per hour per user
export const enrichLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: getUserKey,
  message: { error: "Enrichment rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
