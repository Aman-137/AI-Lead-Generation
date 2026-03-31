import "./config";
import express from "express";
import cors from "cors";
import leadsRouter from "./routes/leads";
import campaignsRouter from "./routes/campaigns";
import generateRouter from "./routes/generate";
import sendRouter from "./routes/send";
import gmailRouter from "./routes/gmail";
import statsRouter from "./routes/stats";
import { apiLimiter, sendEmailLimiter, generateLimiter } from "./middleware/rateLimit";
import { sanitizeBody, validateCampaignId } from "./middleware/validate";
import { startEmailQueue } from "./jobs/emailQueue";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(sanitizeBody);
app.use(apiLimiter);

// Routes
app.use("/api/leads", leadsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/generate", generateLimiter, validateCampaignId, generateRouter);
app.use("/api/send", sendEmailLimiter, validateCampaignId, sendRouter);
app.use("/api/gmail", gmailRouter);
app.use("/api/stats", statsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  // Start background email queue processor
  try {
    startEmailQueue();
  } catch (err) {
    console.error("[Server] Failed to start email queue:", err);
  }
});

export default app;
