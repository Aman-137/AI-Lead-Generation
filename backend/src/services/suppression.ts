import supabase from "./supabase";
import logger from "../utils/logger";

// =============================================
// Email suppression list (per-user opt-outs)
// =============================================
// When a recipient unsubscribes, their address is recorded here for that user.
// No email (initial or follow-up) is ever sent to a suppressed address again.
// Emails are matched case-insensitively (addresses are stored lower-cased).

// Is this address suppressed for this user?
export async function isSuppressed(userId: string, email: string): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabase
    .from("email_suppressions")
    .select("id")
    .eq("user_id", userId)
    .eq("email", email.toLowerCase())
    .limit(1);
  return !!(data && data.length > 0);
}

// Bulk lookup: return the set of suppressed (lower-cased) addresses among the given list.
// Used at generation time to skip leads that already opted out.
export async function getSuppressedEmails(userId: string, emails: string[]): Promise<Set<string>> {
  const lowered = [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
  if (lowered.length === 0) return new Set();
  const { data } = await supabase
    .from("email_suppressions")
    .select("email")
    .eq("user_id", userId)
    .in("email", lowered);
  return new Set((data || []).map((r: any) => r.email));
}

// Add an address to the suppression list and cancel any of its pending emails.
// Idempotent (upsert on user_id+email). reason: unsubscribe | bounce | complaint | manual.
export async function addSuppression(
  userId: string,
  email: string,
  reason: string = "unsubscribe",
  leadId?: string | null
): Promise<void> {
  const lower = email.toLowerCase();

  await supabase
    .from("email_suppressions")
    .upsert(
      { user_id: userId, email: lower, reason, lead_id: leadId || null },
      { onConflict: "user_id,email" }
    );

  // Cancel any pending emails queued to this address (initial + follow-ups).
  // Done in app code with case-insensitive matching since to_email may be mixed-case.
  const { data: pending } = await supabase
    .from("emails")
    .select("id, to_email")
    .eq("user_id", userId)
    .eq("status", "pending");

  const ids = (pending || [])
    .filter((e: any) => (e.to_email || "").toLowerCase() === lower)
    .map((e: any) => e.id);

  if (ids.length > 0) {
    await supabase
      .from("emails")
      .update({ status: "cancelled", error_log: `Cancelled: recipient unsubscribed (${reason})` })
      .in("id", ids);
    logger.info({ userId, email: lower, cancelled: ids.length }, "Unsubscribe: cancelled pending emails");
  }
}
