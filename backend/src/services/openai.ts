import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[OpenAI] Warning: OPENAI_API_KEY not set. AI generation will fail.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
});

export default openai;
