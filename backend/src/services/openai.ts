import OpenAI from "openai";
import logger from "../utils/logger";

if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY not set. AI generation will fail.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
});

export default openai;
