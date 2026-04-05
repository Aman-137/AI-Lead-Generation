import { Router } from "express";
import multer from "multer";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { autoFindLimiter } from "../middleware/rateLimit";
import supabase from "../services/supabase";
import { parseCSV } from "../utils/csv";
import { findLeadsByNiche, formatLeadsForDB } from "../services/leadFinder";
import { checkLeadFindLimit, incrementLeadsFound, checkDailyLeadFindLimit } from "../services/planLimits";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/leads/upload — Upload CSV and create leads + campaign
router.post("/upload", authMiddleware, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    const campaignName = req.body.campaignName;

    if (!file || !campaignName) {
      res.status(400).json({ error: "File and campaign name are required" });
      return;
    }

    // Validate file type
    if (!file.originalname.endsWith(".csv")) {
      res.status(400).json({ error: "Only CSV files are allowed" });
      return;
    }

    const text = file.buffer.toString("utf-8");
    const leads = parseCSV(text);

    if (leads.length === 0) {
      res.status(400).json({ error: "No valid leads found in CSV" });
      return;
    }

    // Validate required CSV columns: name, email, company
    const requiredColumns = ["name", "email", "company"];
    const headers = Object.keys(leads[0]);
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      res.status(400).json({
        error: `Missing required CSV columns: ${missingColumns.join(", ")}. Expected: name, email, company (optional: website, industry)`,
      });
      return;
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        user_id: req.userId,
        name: campaignName,
        status: "draft",
        total_leads: leads.length,
      })
      .select()
      .single();

    if (campaignError) {
      res.status(500).json({ error: "Failed to create campaign" });
      return;
    }

    // Insert leads
    const leadsToInsert = leads.map((lead) => ({
      campaign_id: campaign.id,
      user_id: req.userId,
      name: lead.name || "",
      email: lead.email || "",
      company: lead.company || "",
      website: lead.website || "",
      industry: lead.industry || "",
      source_type: "csv",
    }));

    const { error: leadsError } = await supabase
      .from("leads")
      .insert(leadsToInsert);

    if (leadsError) {
      res.status(500).json({ error: "Failed to insert leads" });
      return;
    }

    res.json({
      message: "Leads uploaded successfully",
      count: leads.length,
      campaignId: campaign.id,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leads — List all leads for user
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
      return;
    }

    res.json({ leads });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads/auto-find — Find leads automatically by niche and location
router.post("/auto-find", authMiddleware, autoFindLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { niche, location, limit } = req.body;

    if (!niche || !location) {
      res.status(400).json({ error: "Niche and location are required" });
      return;
    }

    // Check plan-based monthly lead find limit
    const leadFindCheck = await checkLeadFindLimit(req.userId!);
    if (!leadFindCheck.allowed) {
      res.status(403).json({
        error: `Monthly lead find limit reached (${leadFindCheck.used}/${leadFindCheck.limit} on ${leadFindCheck.plan} plan). Upgrade your plan for more leads.`,
        used: leadFindCheck.used,
        limit: leadFindCheck.limit,
        plan: leadFindCheck.plan,
      });
      return;
    }

    // Check plan-based DAILY lead find limit (Starter: 50/day, Growth: 100/day, Agency: 200/day)
    const dailyCheck = await checkDailyLeadFindLimit(req.userId!);
    if (!dailyCheck.allowed) {
      res.status(403).json({
        error: `Daily lead find limit reached (${dailyCheck.usedToday}/${dailyCheck.dailyLimit} on ${dailyCheck.plan} plan). Try again tomorrow.`,
        usedToday: dailyCheck.usedToday,
        dailyLimit: dailyCheck.dailyLimit,
        remaining: 0,
        plan: dailyCheck.plan,
      });
      return;
    }

    // Cap search to remaining daily slots (not more than what's left for today)
    let validatedLimit = dailyCheck.remaining;
    if (limit !== undefined) {
      const parsedLimit = parseInt(String(limit));
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > dailyCheck.remaining) {
        res.status(400).json({
          error: `Lead limit must be between 1 and ${dailyCheck.remaining} (your remaining daily cap). You've found ${dailyCheck.usedToday}/${dailyCheck.dailyLimit} leads today.`,
        });
        return;
      }
      validatedLimit = parsedLimit;
    }

    // Create lead source record
    const { data: source, error: sourceError } = await supabase
      .from("lead_sources")
      .insert({
        user_id: req.userId,
        niche,
        location,
        status: "running",
      })
      .select()
      .single();

    if (sourceError || !source?.id) {
      res.status(500).json({ error: "Failed to create lead source" });
      return;
    }

    // Find leads using the lead finder service
    const foundLeads = await findLeadsByNiche({
      niche,
      location,
      limit: validatedLimit,
    });

    if (foundLeads.length === 0) {
      // Update source status to completed even if no leads found
      await supabase
        .from("lead_sources")
        .update({ status: "completed" })
        .eq("id", source.id);

      res.json({
        message: "No leads found for the given criteria",
        source_id: source.id,
        count: 0,
      });
      return;
    }

    // Create a campaign for the found leads
    const campaignName = `${niche} in ${location}`;
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        user_id: req.userId,
        name: campaignName,
        status: "draft",
        total_leads: foundLeads.length,
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      await supabase
        .from("lead_sources")
        .update({ status: "completed" })
        .eq("id", source.id);
      res.status(500).json({ error: "Failed to create campaign for found leads" });
      return;
    }

    // Format and insert leads with campaign_id
    if (!req.userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }
    const formattedLeads = formatLeadsForDB(foundLeads, req.userId, source.id).map(
      (lead) => ({ ...lead, campaign_id: campaign.id, source_type: "auto_find" })
    );

    // Deduplicate: filter out leads whose website or company+phone already exist for this user
    let leadsToInsert = formattedLeads;
    if (formattedLeads.length > 0) {
      // Get existing websites and company+phone combos for this user
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("website, company, phone")
        .eq("user_id", req.userId);

      if (existingLeads && existingLeads.length > 0) {
        const existingWebsites = new Set(
          existingLeads
            .map((l: any) => l.website?.toLowerCase().replace(/\/+$/, ""))
            .filter(Boolean)
        );
        const existingCompanyPhone = new Set(
          existingLeads
            .map((l: any) => `${l.company?.toLowerCase()}|${l.phone?.toLowerCase()}`)
            .filter((v: string) => v !== "|")
        );

        leadsToInsert = formattedLeads.filter((lead) => {
          // Check website match
          const normalizedWebsite = lead.website?.toLowerCase().replace(/\/+$/, "");
          if (normalizedWebsite && existingWebsites.has(normalizedWebsite)) {
            return false;
          }
          // Check company+phone match (for leads without websites)
          if (lead.company && lead.phone) {
            const key = `${lead.company.toLowerCase()}|${lead.phone.toLowerCase()}`;
            if (existingCompanyPhone.has(key)) {
              return false;
            }
          }
          return true;
        });
      }
    }

    // Re-check daily remaining (in case multiple searches happened close together)
    // and cap leadsToInsert to the actual remaining daily allowance
    const dailyRecheck = await checkDailyLeadFindLimit(req.userId!);
    if (leadsToInsert.length > dailyRecheck.remaining) {
      leadsToInsert = leadsToInsert.slice(0, dailyRecheck.remaining);
    }

    if (leadsToInsert.length === 0) {
      await supabase
        .from("lead_sources")
        .update({ status: "completed" })
        .eq("id", source.id);

      // Update campaign total
      await supabase
        .from("campaigns")
        .update({ total_leads: 0 })
        .eq("id", campaign.id);

      res.json({
        message: "All found leads already exist in your account. Try a different niche or location.",
        source_id: source.id,
        campaign_id: campaign.id,
        campaign_name: campaignName,
        count: 0,
        duplicatesSkipped: formattedLeads.length,
      });
      return;
    }

    const { error: leadsError } = await supabase
      .from("leads")
      .insert(leadsToInsert);

    if (leadsError) {
      await supabase
        .from("lead_sources")
        .update({ status: "completed" })
        .eq("id", source.id);

      res.status(500).json({ error: "Failed to insert found leads" });
      return;
    }

    // Update campaign total to actual inserted count
    await supabase
      .from("campaigns")
      .update({ total_leads: leadsToInsert.length })
      .eq("id", campaign.id);

    // Update source status to completed
    await supabase
      .from("lead_sources")
      .update({ status: "completed" })
      .eq("id", source.id);

    // Track leads found against monthly plan limit
    await incrementLeadsFound(req.userId!, leadsToInsert.length);

    // Get updated daily usage for response
    const dailyFinal = await checkDailyLeadFindLimit(req.userId!);

    res.json({
      message: "Leads found and campaign created successfully",
      source_id: source.id,
      campaign_id: campaign.id,
      campaign_name: campaignName,
      count: leadsToInsert.length,
      duplicatesSkipped: formattedLeads.length - leadsToInsert.length,
      dailyUsed: dailyFinal.usedToday,
      dailyLimit: dailyFinal.dailyLimit,
      dailyRemaining: dailyFinal.remaining,
    });
  } catch (error) {
    console.error("[AutoFind] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads/enrich — Enrich a lead with website data and scoring
router.post("/enrich", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ error: "Lead IDs array is required" });
      return;
    }

    const { scrapeWebsite, generateEnrichmentSummary } = await import("../services/scraper");
    const { scoreLead } = await import("../services/leadScoring");

    // Fetch leads
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", req.userId)
      .in("id", leadIds);

    if (leadsError || !leads || leads.length === 0) {
      res.status(404).json({ error: "No leads found" });
      return;
    }

    // Enrich leads in parallel batches of 5
    const ENRICH_BATCH_SIZE = 5;
    const enrichedLeads: { id: string; score: number; summary: string }[] = [];

    for (let i = 0; i < leads.length; i += ENRICH_BATCH_SIZE) {
      const batch = leads.slice(i, i + ENRICH_BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (lead) => {
        try {
          let websiteData = null;
          if (lead.website) {
            websiteData = await scrapeWebsite(lead.website);
          }

          const enrichmentSummary = generateEnrichmentSummary(
            websiteData,
            lead.company
          );

          const score = scoreLead({
            website: lead.website,
            enriched_data: websiteData as any,
            company: lead.company,
          });

          const updateFields: Record<string, any> = {
            enriched_data: {
              ...websiteData,
              ...enrichmentSummary,
            },
            score,
          };

          if (!lead.email && websiteData?.emails && websiteData.emails.length > 0) {
            updateFields.email = websiteData.emails[0];
          }

          const hasEmailNow = lead.email || (websiteData?.emails && websiteData.emails.length > 0);
          if (!hasEmailNow) {
            updateFields.contact_method = "call";
          } else {
            updateFields.contact_method = "email";
          }

          const { error: updateError } = await supabase
            .from("leads")
            .update(updateFields)
            .eq("id", lead.id);

          if (!updateError) {
            return {
              id: lead.id,
              score,
              summary: enrichmentSummary.summary,
            };
          }
        } catch (error) {
          console.error(`[Enrich] Error enriching lead ${lead.id}:`, error);
        }
        return null;
      }));

      for (const r of batchResults) {
        if (r) enrichedLeads.push(r);
      }
    }

    res.json({
      message: "Leads enriched successfully",
      count: enrichedLeads.length,
      leads: enrichedLeads,
    });
  } catch (error) {
    console.error("[Enrich] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leads/sources — List all lead sources for user (with campaign info)
router.get("/sources", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Fetch all lead sources for this user
    const { data: sources, error: sourcesError } = await supabase
      .from("lead_sources")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (sourcesError) {
      res.status(500).json({ error: "Failed to fetch lead sources" });
      return;
    }

    if (!sources || sources.length === 0) {
      res.json({ sources: [] });
      return;
    }

    // For each source, find the campaign and lead count
    const enrichedSources = await Promise.all(
      sources.map(async (source) => {
        // Find campaign that matches this source's niche+location pattern
        const campaignName = `${source.niche} in ${source.location}`;
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("id, name, total_leads")
          .eq("user_id", req.userId)
          .eq("name", campaignName)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Count leads from this source
        const { count: leadsCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("source_id", source.id);

        return {
          id: source.id,
          niche: source.niche,
          location: source.location,
          status: source.status,
          created_at: source.created_at,
          leadsCount: leadsCount || campaign?.total_leads || 0,
          campaignId: campaign?.id || null,
          campaignName: campaign?.name || null,
        };
      })
    );

    res.json({ sources: enrichedSources });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
