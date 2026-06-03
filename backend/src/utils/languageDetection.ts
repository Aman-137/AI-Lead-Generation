import logger from "./logger";

/**
 * ISO 639-3 to human-readable language name mapping
 * Covers the most common languages for B2B websites
 */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  fra: "French",
  deu: "German",
  spa: "Spanish",
  ita: "Italian",
  por: "Portuguese",
  nld: "Dutch",
  pol: "Polish",
  swe: "Swedish",
  nor: "Norwegian",
  dan: "Danish",
  fin: "Finnish",
  ces: "Czech",
  ron: "Romanian",
  hun: "Hungarian",
  tur: "Turkish",
  ell: "Greek",
  rus: "Russian",
  ukr: "Ukrainian",
  jpn: "Japanese",
  kor: "Korean",
  cmn: "Chinese",
  arb: "Arabic",
  hin: "Hindi",
  tha: "Thai",
  vie: "Vietnamese",
  ind: "Indonesian",
  msa: "Malay",
  cat: "Catalan",
  hrv: "Croatian",
  srp: "Serbian",
  slk: "Slovak",
  slv: "Slovenian",
  bul: "Bulgarian",
  lit: "Lithuanian",
  lav: "Latvian",
  est: "Estonian",
};

// Default language when detection fails or confidence is low
const DEFAULT_LANGUAGE = "eng";

// Minimum text length required for reliable detection
const MIN_TEXT_LENGTH = 50;

/**
 * Detect the dominant language of website text content.
 * Returns the ISO 639-3 language code (e.g., "eng", "fra", "deu").
 * Defaults to "eng" if detection fails or confidence is too low.
 */
export async function detectLanguage(text: string): Promise<string> {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) {
    return DEFAULT_LANGUAGE;
  }

  try {
    // Dynamic import for ESM-only franc package
    const { franc } = await import("franc");

    // Clean the text: remove URLs, emails, code snippets, excessive whitespace
    const cleanedText = text
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\{[^}]+\}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanedText.length < MIN_TEXT_LENGTH) {
      return DEFAULT_LANGUAGE;
    }

    // Use first 2000 chars for detection (more text = better accuracy, but diminishing returns)
    const sample = cleanedText.slice(0, 2000);

    const detectedCode = franc(sample);

    // franc returns "und" (undetermined) when it can't detect
    if (detectedCode === "und") {
      return DEFAULT_LANGUAGE;
    }

    // Only return known languages — if franc detects something obscure, default to English
    if (!LANGUAGE_NAMES[detectedCode]) {
      return DEFAULT_LANGUAGE;
    }

    return detectedCode;
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : err }, "Language detection failed — defaulting to English");
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Get the human-readable language name from an ISO 639-3 code.
 * Falls back to "English" for unknown codes.
 */
export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || "English";
}
