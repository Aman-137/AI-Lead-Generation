import { Router } from "express";
import { verifyUnsubToken } from "../utils/unsubscribe";
import { addSuppression } from "../services/suppression";
import logger from "../utils/logger";

// =============================================
// Public unsubscribe endpoint (no auth / no CORS)
// =============================================
// Two entry points share the same logic:
//   GET  /api/unsubscribe/:token  → a human clicks the footer link; returns an HTML page.
//   POST /api/unsubscribe/:token  → a mailbox provider's one-click button (RFC 8058);
//                                    returns 200 with no body.
// Both add the recipient to the per-user suppression list and cancel their pending emails.

const router = Router();

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function confirmationPage(ok: boolean, email?: string): string {
  const title = ok ? "You've been unsubscribed" : "Link not valid";
  const message = ok
    ? `${email ? `<strong>${escapeHtml(email)}</strong>` : "This address"} has been removed. You won't receive any more emails from this sender.`
    : "This unsubscribe link is invalid or has expired. If you keep receiving emails, reply to ask the sender to remove you.";
  const icon = ok ? "✓" : "!";
  const accent = ok ? "#10b981" : "#f87171";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         background: linear-gradient(135deg, #0d0a25 0%, #1a1540 50%, #0d0a25 100%);
         color: #fff; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; padding: 24px; position: relative; overflow: hidden; }
  .orb { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
  .orb1 { top: -120px; left: -120px; width: 360px; height: 360px; background: rgba(105,98,196,0.18); }
  .orb2 { bottom: -100px; right: -80px; width: 320px; height: 320px; background: rgba(61,53,128,0.15); }
  .card { position: relative; background: rgba(20,16,48,0.72); backdrop-filter: blur(12px);
          border: 1px solid rgba(105,98,196,0.25); border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45); max-width: 440px; width: 100%;
          padding: 44px 34px; text-align: center; }
  .badge { width: 68px; height: 68px; border-radius: 50%; background: ${accent}26; color: ${accent};
           font-size: 34px; line-height: 68px; margin: 0 auto 22px; font-weight: 700;
           border: 1px solid ${accent}40; }
  h1 { font-size: 21px; font-weight: 700; margin-bottom: 12px; color: #fff; }
  p { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.6); }
  p strong { color: #a78bfa; font-weight: 600; }
</style>
</head>
<body>
  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="card">
    <div class="badge">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

// One-click unsubscribe (mailbox provider button) — RFC 8058
router.post("/:token", async (req, res) => {
  const decoded = verifyUnsubToken(req.params.token);
  if (decoded) {
    try {
      await addSuppression(decoded.userId, decoded.email, "unsubscribe");
    } catch (err) {
      logger.error({ err }, "Unsubscribe (POST) failed");
    }
  }
  // Always 200 — providers only care that the request succeeded.
  res.status(200).json({ ok: true });
});

// Human clicks the footer link
router.get("/:token", async (req, res) => {
  const decoded = verifyUnsubToken(req.params.token);
  let ok = false;
  if (decoded) {
    try {
      await addSuppression(decoded.userId, decoded.email, "unsubscribe");
      ok = true;
    } catch (err) {
      logger.error({ err }, "Unsubscribe (GET) failed");
    }
  }
  res.status(200).type("html").send(confirmationPage(ok, decoded?.email));
});

export default router;
