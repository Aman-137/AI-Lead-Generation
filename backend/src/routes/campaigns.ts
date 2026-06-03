import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";
import { isValidUUID } from "../middleware/validate";

const router = Router();

// GET /api/campaigns — List all campaigns for user
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
      return;
    }

    // Compute real lead counts via database aggregation (single query, no row limits)
    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map((c: any) => c.id);
      const { data: counts } = await supabase.rpc("get_campaign_lead_counts", {
        p_user_id: req.userId,
        p_campaign_ids: campaignIds,
      });

      if (counts) {
        const countMap: Record<string, { total: number; queued: number; has_auto_find: boolean; has_csv: boolean }> = {};
        for (const row of counts) {
          countMap[row.campaign_id] = row;
        }
        for (const c of campaigns) {
          const cnt = countMap[c.id] || { total: 0, queued: 0, has_auto_find: false, has_csv: false };
          c.total_leads = cnt.total;
          c.queued_leads = cnt.queued;
          // Derive campaign source
          if (!cnt.has_auto_find && !cnt.has_csv) c.source = "csv";
          else if (cnt.has_auto_find && cnt.has_csv) c.source = "mixed";
          else if (cnt.has_auto_find) c.source = "auto_find";
          else c.source = "csv";
        }
      }
    }

    res.json({ campaigns });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/campaigns/:id — Get a single campaign with its leads
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid campaign ID format" });
      return;
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.userId)
      .single();

    if (campaignError || !campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", id)
      .eq("user_id", req.userId);

    const { data: emails } = await supabase
      .from("emails")
      .select("*, gmail_accounts(email)")
      .eq("campaign_id", id)
      .eq("user_id", req.userId)
      .order("sequence_step", { ascending: true });

    // Auto-cancel pending follow-ups for leads that already have a reply
    const repliedLeadIds = new Set(
      (emails || []).filter((e: any) => e.replied === true).map((e: any) => e.lead_id)
    );
    const staleFollowups = (emails || []).filter(
      (e: any) => e.status === "pending" && e.sequence_step > 1 && repliedLeadIds.has(e.lead_id)
    );
    if (staleFollowups.length > 0) {
      await supabase
        .from("emails")
        .update({ status: "cancelled" })
        .in("id", staleFollowups.map((e: any) => e.id));
      // Update local array
      for (const e of staleFollowups) {
        e.status = "cancelled";
      }
    }

    // Flatten gmail_accounts join into gmail_email field
    const enrichedEmails = (emails || []).map(e => ({
      ...e,
      gmail_email: e.gmail_accounts?.email || null,
      gmail_accounts: undefined,
    }));

    // Use actual leads count instead of potentially stale total_leads column
    campaign.total_leads = (leads || []).length;

    res.json({ campaign, leads: leads || [], emails: enrichedEmails });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/campaigns/:id — Update campaign settings
router.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid campaign ID format" });
      return;
    }
    const { enable_followups, name, status, send_timezone } = req.body;

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.userId)
      .single();

    if (campaignError || !campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Update campaign
    const updateData: any = {};
    if (enable_followups !== undefined) {
      updateData.enable_followups = enable_followups;
    }
    if (name !== undefined) {
      updateData.name = name;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (send_timezone !== undefined) {
      const validTimezones = ["US_EAST", "US_CENTRAL", "US_MOUNTAIN", "US_WEST", "US_ALASKA", "US_HAWAII", "CA_ATLANTIC", "CA_NEWFOUNDLAND", "UK", "EU_CENTRAL", "EU_EAST", "UAE", "ARABIA", "INDIA", "SINGAPORE", "PHILIPPINES", "JAPAN", "AU_WEST", "AU_CENTRAL", "AU_EAST", "NZ", "BRAZIL", "SOUTH_AFRICA"];
      if (validTimezones.includes(send_timezone)) {
        updateData.send_timezone = send_timezone;
        updateData.settings_confirmed = true;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("campaigns")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (updateError) {
      res.status(500).json({ error: "Failed to update campaign" });
      return;
    }

    res.json({
      message: "Campaign updated successfully",
      campaign: updated,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/campaigns/:id — Delete a campaign and its associated leads/emails
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid campaign ID" });
      return;
    }

    // Verify campaign belongs to user
    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.userId)
      .single();

    if (fetchError || !campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Delete campaign (leads and emails cascade via FK)
    const { error: deleteError } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", req.userId);

    if (deleteError) {
      res.status(500).json({ error: "Failed to delete campaign" });
      return;
    }

    res.json({ message: "Campaign deleted successfully" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
