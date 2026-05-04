import { Router } from "express";
import crypto from "crypto";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import logger from "../utils/logger";

const router = Router();

// POST /api/audit/generate — Generate an audit report token for a lead
// Requires auth — only the lead owner can generate audit links
router.post("/generate", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      res.status(400).json({ error: "Lead ID is required" });
      return;
    }

    // Fetch lead (must belong to user)
    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, enriched_data")
      .eq("id", leadId)
      .eq("user_id", req.userId)
      .single();

    if (error || !lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    // If lead already has an audit token, return it
    if (lead.enriched_data?.audit_token) {
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.json({
        token: lead.enriched_data.audit_token,
        url: `${baseUrl}/audit/${lead.enriched_data.audit_token}`,
      });
      return;
    }

    // Check lead has enriched data
    if (!lead.enriched_data || (!lead.enriched_data.hasOnlineBooking && lead.enriched_data.hasOnlineBooking !== false)) {
      res.status(400).json({ error: "Lead must be enriched before generating an audit report. Click 'Enrich Leads' first." });
      return;
    }

    // Generate a short, URL-safe token
    const token = crypto.randomBytes(12).toString("base64url"); // 16-char token

    // Store token in enriched_data
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        enriched_data: {
          ...lead.enriched_data,
          audit_token: token,
        },
      })
      .eq("id", leadId)
      .eq("user_id", req.userId);

    if (updateError) {
      logger.error({ updateError }, "Failed to store audit token");
      res.status(500).json({ error: "Failed to generate audit report" });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    res.json({
      token,
      url: `${baseUrl}/audit/${token}`,
    });
  } catch (err) {
    logger.error({ err }, "Audit generate error");
    res.status(500).json({ error: "Failed to generate audit report" });
  }
});

// GET /api/audit/views/recent — Get recent audit views for the current user (dashboard activity feed)
// Requires auth — only the lead owner sees their views
// IMPORTANT: Must be defined BEFORE /:token to avoid route collision
router.get("/views/recent", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: views, error } = await supabase
      .from("audit_views")
      .select("id, lead_id, device, viewed_at")
      .eq("user_id", req.userId)
      .order("viewed_at", { ascending: false })
      .limit(20);

    if (error) {
      res.status(500).json({ error: "Failed to fetch views" });
      return;
    }

    if (!views || views.length === 0) {
      res.json({ views: [], leads: {} });
      return;
    }

    // Fetch lead info for these views
    const leadIds = [...new Set(views.map(v => v.lead_id))];
    const { data: leads } = await supabase
      .from("leads")
      .select("id, company, campaign_id")
      .in("id", leadIds);

    const leadsMap: Record<string, { company: string; campaign_id: string }> = {};
    if (leads) {
      for (const l of leads) {
        leadsMap[l.id] = { company: l.company, campaign_id: l.campaign_id };
      }
    }

    res.json({ views, leads: leadsMap });
  } catch (err) {
    logger.error({ err }, "Audit views recent error");
    res.status(500).json({ error: "Failed to fetch recent views" });
  }
});

// GET /api/audit/views/campaign/:id — Get audit view counts per lead for a campaign
// Requires auth — must be defined BEFORE /:token
router.get("/views/campaign/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id: campaignId } = req.params;

    // Get all leads in this campaign that have audit tokens
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", req.userId)
      .not("enriched_data->>audit_token", "is", null);

    if (leadsError || !leads || leads.length === 0) {
      res.json({ viewData: {} });
      return;
    }

    const leadIds = leads.map(l => l.id);

    // Get all views for these leads
    const { data: views, error: viewsError } = await supabase
      .from("audit_views")
      .select("lead_id, device, viewed_at")
      .in("lead_id", leadIds)
      .order("viewed_at", { ascending: false });

    if (viewsError || !views) {
      res.json({ viewData: {} });
      return;
    }

    // Aggregate per lead: { leadId: { count, lastViewed, device } }
    const viewData: Record<string, { count: number; lastViewed: string; device: string }> = {};
    for (const v of views) {
      if (!viewData[v.lead_id]) {
        viewData[v.lead_id] = { count: 0, lastViewed: v.viewed_at, device: v.device };
      }
      viewData[v.lead_id].count++;
    }

    res.json({ viewData });
  } catch (err) {
    logger.error({ err }, "Audit views campaign error");
    res.status(500).json({ error: "Failed to fetch campaign views" });
  }
});

// GET /api/audit/:token — Public endpoint: fetch audit data by token
// NO AUTH required — this is what the prospect sees
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10 || token.length > 30) {
      res.status(400).json({ error: "Invalid audit token" });
      return;
    }

    // Find lead by audit token in enriched_data JSONB
    const { data: leads, error } = await supabase
      .from("leads")
      .select("company, website, industry, score, enriched_data")
      .eq("enriched_data->>audit_token", token)
      .limit(1);

    if (error || !leads || leads.length === 0) {
      res.status(404).json({ error: "Audit report not found" });
      return;
    }

    const lead = leads[0];
    const ed = lead.enriched_data || {};

    // Return only safe, public-facing data — strip internal fields
    res.json({
      company: lead.company,
      website: lead.website,
      industry: lead.industry || ed.industry || "Local Business",
      score: lead.score,
      summary: ed.summary || null,
      issues: ed.issues || [],
      opportunity: ed.opportunity || null,
      signals: {
        hasOnlineBooking: ed.hasOnlineBooking ?? null,
        hasContactForm: ed.hasContactForm ?? null,
        hasSSL: ed.hasSSL ?? null,
        isMobileFriendly: ed.isMobileFriendly ?? null,
        hasMetaDescription: ed.hasMetaDescription ?? null,
        pageLoadTimeMs: ed.pageLoadTimeMs ?? null,
        pageSizeKB: ed.pageSizeKB ?? null,
        copyrightYear: ed.copyrightYear ?? null,
        socialLinks: ed.socialLinks?.length ?? 0,
        technologies: ed.technologies || [],
        isParkedDomain: ed.isParkedDomain ?? false,
        _siteDown: ed._siteDown ?? false,
        pageSpeed: ed.pageSpeed ?? null,
        hasGoogleAds: ed.hasGoogleAds ?? null,
        hasFacebookPixel: ed.hasFacebookPixel ?? null,
        hasAnalytics: ed.hasAnalytics ?? null,
        googleRating: ed.googleRating ?? null,
        googleReviewCount: ed.googleReviewCount ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, "Audit fetch error");
    res.status(500).json({ error: "Failed to load audit report" });
  }
});

// POST /api/audit/:token/view — Track when a lead views their audit report
// NO AUTH required — this is called from the public audit page
router.post("/:token/view", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10 || token.length > 30) {
      res.status(400).json({ error: "Invalid token" });
      return;
    }

    // Find the lead by audit token
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, user_id")
      .eq("enriched_data->>audit_token", token)
      .limit(1);

    if (error || !leads || leads.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const lead = leads[0];

    // Hash IP for deduplication (don't store raw IP for privacy)
    const rawIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown";
    const ipHash = crypto.createHash("sha256").update(rawIp + token).digest("hex").substring(0, 16);

    // Deduplicate: skip if same IP viewed within 30 minutes
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentView } = await supabase
      .from("audit_views")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("ip_hash", ipHash)
      .gte("viewed_at", thirtyMinAgo)
      .limit(1);

    if (recentView && recentView.length > 0) {
      // Already counted this view recently
      res.json({ ok: true, deduplicated: true });
      return;
    }

    // Detect device from user-agent
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const device = /mobile|android|iphone|ipad/.test(ua) ? "mobile" : "desktop";

    // Insert the view record
    await supabase.from("audit_views").insert({
      lead_id: lead.id,
      user_id: lead.user_id,
      ip_hash: ipHash,
      device,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Audit view tracking error");
    res.status(500).json({ error: "Failed to track view" });
  }
});

export default router;
