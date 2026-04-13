import { Request, Response, NextFunction } from "express";

// Fields that need long content — exempt from truncation
const LONG_FIELDS = new Set([
  "body",           // AI-generated email body
  "code",           // OAuth authorization code
  "password",       // SMTP password
  "subject",        // Email subject (can be long with personalization)
  "enriched_data",  // JSON enrichment data
]);

// Sanitize string input — trim and limit length
function sanitize(value: string, maxLength: number = 500): string {
  return String(value).trim().slice(0, maxLength);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate UUID format
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Middleware: sanitize request body strings
// Long fields are trimmed only; short fields are trimmed + truncated to 500 chars
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        if (LONG_FIELDS.has(key)) {
          req.body[key] = String(req.body[key]).trim();
        } else {
          req.body[key] = sanitize(req.body[key]);
        }
      }
    }
  }
  next();
}

// Middleware: validate campaignId parameter
export function validateCampaignId(req: Request, res: Response, next: NextFunction) {
  const campaignId = req.body.campaignId || req.params.id;
  if (campaignId && !isValidUUID(campaignId)) {
    res.status(400).json({ error: "Invalid campaign ID format" });
    return;
  }
  next();
}
