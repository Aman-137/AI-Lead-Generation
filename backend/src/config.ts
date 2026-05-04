import dotenv from "dotenv";
import path from "path";

// Load env vars before anything else
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "OPENAI_API_KEY",
  "SERPER_API_KEY",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "FRONTEND_URL",
];

// Optional but recommended
const OPTIONAL_ENV_VARS = [
  "PAGESPEED_API_KEY", // Google PageSpeed Insights — free 25k/day
];

for (const key of OPTIONAL_ENV_VARS) {
  if (!process.env[key]) {
    console.warn(`⚠️  Optional env var missing: ${key} — feature will be disabled`);
  }
}

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables:\n   ${missing.join("\n   ")}\n`);
  process.exit(1);
}
