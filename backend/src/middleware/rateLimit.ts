import rateLimit from "express-rate-limit";

// General API rate limiter: 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for email sending: 10 requests per hour per IP
export const sendEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Email sending rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for AI generation: 20 requests per hour per IP
export const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Generation rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter: 20 requests per 15 minutes per IP (for login/signup abuse)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for lead finding: 5 requests per hour per IP (resource-intensive)
export const autoFindLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: "Lead finding rate limit exceeded. Maximum 5 searches per hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
