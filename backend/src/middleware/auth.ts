import { Request, Response, NextFunction } from "express";
import supabase from "../services/supabase";
import { auditLog } from "../utils/auditLog";

// Maximum session age: 7 days (in seconds)
const MAX_SESSION_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    auditLog({ action: "auth.failed", req, metadata: { reason: "missing_header" } });
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      auditLog({ action: "auth.failed", req, metadata: { reason: "invalid_token" } });
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Enforce session timeout — reject tokens older than MAX_SESSION_AGE_SECONDS
    // Decode JWT payload to get iat (issued at) without verifying (already verified above)
    const payloadB64 = token.split(".")[1];
    if (payloadB64) {
      try {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        if (payload.iat) {
          const tokenAge = Math.floor(Date.now() / 1000) - payload.iat;
          if (tokenAge > MAX_SESSION_AGE_SECONDS) {
            auditLog({ action: "auth.failed", req, userId: data.user.id, metadata: { reason: "session_expired", tokenAge } });
            res.status(401).json({ error: "Session expired. Please log in again." });
            return;
          }
        }
      } catch {
        // If JWT decoding fails, the token was already verified by Supabase — continue
      }
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    next();
  } catch {
    auditLog({ action: "auth.failed", req, metadata: { reason: "exception" } });
    res.status(401).json({ error: "Authentication failed" });
  }
}
