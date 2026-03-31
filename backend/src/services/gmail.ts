import { google } from "googleapis";
import supabase from "./supabase";
import { setGmailConnectedAt } from "./planLimits";

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

// Generate the OAuth2 consent URL
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

// Exchange authorization code for tokens and store them
export async function handleOAuthCallback(
  code: string,
  userId: string
): Promise<{ success: boolean; email?: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to get tokens from Google");
  }

  oauth2Client.setCredentials(tokens);

  // Get the user's Gmail email address
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const gmailEmail = userInfo.data.email || "";

  // Store tokens securely in DB (upsert)
  const { error } = await supabase
    .from("gmail_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
        gmail_email: gmailEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error("Failed to store Gmail tokens");
  }

  // Start warmup clock for this user's plan (only sets once)
  await setGmailConnectedAt(userId);

  return { success: true, email: gmailEmail };
}

// Get a valid access token (refreshes if expired)
async function getValidAccessToken(userId: string): Promise<string> {
  const { data: tokenData, error } = await supabase
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    throw new Error("Gmail not connected. Please connect your Gmail account first.");
  }

  const now = new Date();
  const expiry = new Date(tokenData.token_expiry);

  // If token is still valid (with 5min buffer), return it
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenData.access_token;
  }

  // Token expired — refresh it
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: tokenData.refresh_token });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Gmail access token");
  }

  // Update stored token
  await supabase
    .from("gmail_tokens")
    .update({
      access_token: credentials.access_token,
      token_expiry: new Date(credentials.expiry_date || Date.now() + 3600000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return credentials.access_token;
}

// Send an email via Gmail API
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string }> {
  const accessToken = await getValidAccessToken(userId);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Sanitize inputs to prevent email header injection
  const safeTo = to.replace(/[\r\n]/g, "");
  const safeSubject = subject.replace(/[\r\n]/g, "");

  // Build RFC 2822 email
  const rawEmail = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
  ].join("\n");

  const encodedEmail = Buffer.from(rawEmail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedEmail,
    },
  });

  return {
    success: true,
    messageId: result.data.id || undefined,
  };
}

// Check if user has Gmail connected
export async function isGmailConnected(userId: string): Promise<{ connected: boolean; email?: string }> {
  const { data, error } = await supabase
    .from("gmail_tokens")
    .select("gmail_email")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { connected: false };
  }

  return { connected: true, email: data.gmail_email };
}
