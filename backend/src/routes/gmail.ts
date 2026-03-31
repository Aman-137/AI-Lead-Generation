import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { getAuthUrl, handleOAuthCallback, isGmailConnected } from "../services/gmail";

const router = Router();

// GET /api/gmail/auth-url — Get the Gmail OAuth consent URL
router.get("/auth-url", authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const url = getAuthUrl();
    res.json({ url });
  } catch {
    res.status(500).json({ error: "Failed to generate Gmail auth URL" });
  }
});

// GET /api/gmail/callback — Handle OAuth2 callback redirect from Google
router.get("/callback", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const code = req.query.code as string;

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    const result = await handleOAuthCallback(code, req.userId!);
    res.json({
      message: "Gmail connected successfully",
      email: result.email,
    });
  } catch {
    res.status(500).json({ error: "Failed to connect Gmail" });
  }
});

// POST /api/gmail/callback — Handle OAuth2 code sent from frontend
router.post("/callback", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    const result = await handleOAuthCallback(code, req.userId!);
    res.json({
      message: "Gmail connected successfully",
      email: result.email,
    });
  } catch {
    res.status(500).json({ error: "Failed to connect Gmail" });
  }
});

// GET /api/gmail/status — Check if Gmail is connected
router.get("/status", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const status = await isGmailConnected(req.userId!);
    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to check Gmail status" });
  }
});

export default router;
