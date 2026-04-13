import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { getAuthUrl, handleOAuthCallback, isGmailConnected, getGmailAccounts, removeGmailAccount, verifyOAuthState, extractOAuthStateUserId } from "../services/gmail";
import { getUserPlan, getMaxInboxes } from "../services/planLimits";
import { isValidUUID } from "../middleware/validate";

const router = Router();

// GET /api/gmail/auth-url — Get the Gmail OAuth consent URL
router.get("/auth-url", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Check inbox limit before starting OAuth flow
    const accounts = await getGmailAccounts(req.userId!);
    const { plan } = await getUserPlan(req.userId!);
    const maxInboxes = getMaxInboxes(plan);

    if (accounts.length >= maxInboxes) {
      res.status(403).json({
        error: `Your ${plan} plan allows up to ${maxInboxes} Gmail account${maxInboxes > 1 ? "s" : ""}. Upgrade your plan to add more.`,
      });
      return;
    }

    const url = getAuthUrl(req.userId!);
    res.json({ url });
  } catch {
    res.status(500).json({ error: "Failed to generate Gmail auth URL" });
  }
});

// GET /api/gmail/callback — Handle OAuth2 callback redirect from Google
// No authMiddleware: Google redirects here without a Bearer token.
// User identity is verified via the signed state parameter instead.
router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    const userId = extractOAuthStateUserId(state);
    if (!userId) {
      res.status(403).json({ error: "Invalid or expired OAuth state. Please start the connection process again." });
      return;
    }

    const result = await handleOAuthCallback(code, userId);
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
    const { code, state } = req.body;

    if (!code) {
      res.status(400).json({ error: "Authorization code is required" });
      return;
    }

    if (!state || !verifyOAuthState(state, req.userId!)) {
      res.status(403).json({ error: "Invalid or expired OAuth state. Please start the connection process again." });
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

// GET /api/gmail/accounts — List all connected Gmail accounts + plan info
router.get("/accounts", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await getGmailAccounts(req.userId!);
    const { plan } = await getUserPlan(req.userId!);
    const maxInboxes = getMaxInboxes(plan);
    res.json({ accounts, maxInboxes, plan });
  } catch {
    res.status(500).json({ error: "Failed to fetch Gmail accounts" });
  }
});

// DELETE /api/gmail/accounts/:id — Remove a non-primary Gmail account
router.delete("/accounts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const accountId = req.params.id;
    if (!isValidUUID(accountId)) {
      res.status(400).json({ error: "Invalid account ID format" });
      return;
    }
    await removeGmailAccount(req.userId!, accountId);
    res.json({ message: "Gmail account removed successfully" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to remove Gmail account";
    res.status(400).json({ error: msg });
  }
});

export default router;
