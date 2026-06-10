import { Router, Request, Response } from "express";
import crypto from "crypto";
import supabaseAdmin from "../services/supabase";
import logger from "../utils/logger";

const router = Router();

// Verify webhook signature from Lemon Squeezy
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Map Lemon Squeezy status to our internal status
function mapStatus(lsStatus: string): string {
  switch (lsStatus) {
    case "active":
      return "active";
    case "on_trial":
      return "trialing";
    case "past_due":
      return "past_due";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "paused":
      return "cancelled"; // Treat paused as cancelled for feature access
    default:
      return "trialing";
  }
}

// Map variant ID back to plan name
function getplanFromVariant(variantId: string): string {
  const map: Record<string, string> = {
    [process.env.LEMONSQUEEZY_STARTER_VARIANT_ID || ""]: "starter",
    [process.env.LEMONSQUEEZY_GROWTH_VARIANT_ID || ""]: "growth",
    [process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || ""]: "agency",
  };
  return map[variantId] || "starter";
}

// POST /api/webhooks/lemonsqueezy
// This route must NOT have auth middleware — Lemon Squeezy calls it directly
router.post("/", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-signature"] as string;
    if (!signature) {
      logger.warn("Webhook received without signature");
      return res.status(401).json({ error: "Missing signature" });
    }

    // req.body is already parsed by express.json(), but we need raw body for signature
    // We'll use the rawBody attached by our middleware
    const rawBody = (req as any).rawBody as string;
    if (!rawBody) {
      logger.error("Raw body not available for webhook verification");
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn("Webhook signature verification failed");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;
    const eventName = event?.meta?.event_name;
    const customData = event?.meta?.custom_data;
    const userId = customData?.user_id;

    if (!userId) {
      logger.warn({ eventName }, "Webhook received without user_id in custom data");
      return res.status(200).json({ received: true }); // Acknowledge but skip
    }

    const attributes = event?.data?.attributes;
    const subscriptionId = String(event?.data?.id || "");
    const customerId = String(attributes?.customer_id || "");
    const variantId = String(attributes?.variant_id || attributes?.first_subscription_item?.variant_id || "");
    const status = attributes?.status || "";
    const currentPeriodEnd = attributes?.renews_at || attributes?.ends_at || null;
    const trialEndsAt = attributes?.trial_ends_at || null;

    logger.info({ eventName, userId, status, subscriptionId }, "Webhook received");

    switch (eventName) {
      case "subscription_created": {
        const plan = getplanFromVariant(variantId);
        const mappedStatus = mapStatus(status);

        // Calculate trial end: use LS trial_ends_at if available, otherwise 7 days from now
        const trialEnd = trialEndsAt
          ? trialEndsAt
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await supabaseAdmin
          .from("user_plans")
          .update({
            plan,
            subscription_status: mappedStatus,
            lemon_squeezy_subscription_id: subscriptionId,
            lemon_squeezy_customer_id: customerId,
            trial_ends_at: trialEnd,
            current_period_end: currentPeriodEnd,
          })
          .eq("user_id", userId);

        logger.info({ userId, plan, status: mappedStatus }, "Subscription created");
        break;
      }

      case "subscription_updated": {
        const plan = getplanFromVariant(variantId);
        const mappedStatus = mapStatus(status);

        await supabaseAdmin
          .from("user_plans")
          .update({
            plan,
            subscription_status: mappedStatus,
            current_period_end: currentPeriodEnd,
          })
          .eq("user_id", userId);

        logger.info({ userId, plan, status: mappedStatus }, "Subscription updated");
        break;
      }

      case "subscription_payment_success": {
        // Payment went through — mark as active
        await supabaseAdmin
          .from("user_plans")
          .update({
            subscription_status: "active",
            current_period_end: currentPeriodEnd,
          })
          .eq("user_id", userId);

        logger.info({ userId }, "Payment successful — subscription active");
        break;
      }

      case "subscription_payment_failed": {
        await supabaseAdmin
          .from("user_plans")
          .update({ subscription_status: "past_due" })
          .eq("user_id", userId);

        logger.info({ userId }, "Payment failed — marked past_due");
        break;
      }

      case "subscription_cancelled": {
        // Lemon Squeezy sends this when cancellation is scheduled
        // User keeps access until current_period_end
        await supabaseAdmin
          .from("user_plans")
          .update({
            subscription_status: "cancelled",
            current_period_end: currentPeriodEnd || attributes?.ends_at,
          })
          .eq("user_id", userId);

        logger.info({ userId }, "Subscription cancelled");
        break;
      }

      case "subscription_expired": {
        await supabaseAdmin
          .from("user_plans")
          .update({ subscription_status: "expired" })
          .eq("user_id", userId);

        logger.info({ userId }, "Subscription expired");
        break;
      }

      case "subscription_resumed": {
        await supabaseAdmin
          .from("user_plans")
          .update({ subscription_status: "active" })
          .eq("user_id", userId);

        logger.info({ userId }, "Subscription resumed");
        break;
      }

      default:
        logger.info({ eventName }, "Unhandled webhook event");
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Webhook processing error");
    // Always return 200 to prevent Lemon Squeezy from retrying
    res.status(200).json({ received: true });
  }
});

export default router;
