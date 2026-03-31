import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import supabase from "../services/supabase";

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

    res.json({ campaigns });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/campaigns/:id — Get a single campaign with its leads
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

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
      .select("*")
      .eq("campaign_id", id)
      .eq("user_id", req.userId);

    res.json({ campaign, leads: leads || [], emails: emails || [] });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/campaigns/:id — Update campaign settings
router.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
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
      const validTimezones = ["US_EAST", "US_CENTRAL", "US_WEST", "UK", "EU_CENTRAL"];
      if (validTimezones.includes(send_timezone)) {
        updateData.send_timezone = send_timezone;
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

export default router;
