import OpenAI from "openai";
import logger from "../utils/logger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set. AI features require a valid OpenAI API key.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
