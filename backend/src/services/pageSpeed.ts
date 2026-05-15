import axios from "axios";
import logger from "../utils/logger";

export interface PageSpeedMetrics {
  performanceScore: number;       // 0-100
  accessibilityScore: number;     // 0-100
  bestPracticesScore: number;     // 0-100
  seoScore: number;               // 0-100
  firstContentfulPaint: number;   // ms
  largestContentfulPaint: number; // ms
  totalBlockingTime: number;      // ms
  cumulativeLayoutShift: number;  // score (0-1)
  speedIndex: number;             // ms
}

export interface PageSpeedResult {
  mobile: PageSpeedMetrics | null;
  desktop: PageSpeedMetrics | null;
}

const API_KEY = process.env.PAGESPEED_API_KEY || "";
const API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT = 45000; // 45s — Google needs time for slow sites

/**
 * Single attempt to fetch Lighthouse metrics for a URL + strategy
 */
async function fetchScore(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedMetrics | null> {
  try {
    const response = await axios.get(API_URL, {
      params: {
        url,
        strategy,
        key: API_KEY,
        category: ["performance", "accessibility", "best-practices", "seo"],
      },
      timeout: TIMEOUT,
      paramsSerializer: (p) => {
        const parts: string[] = [];
        for (const [key, val] of Object.entries(p)) {
          if (Array.isArray(val)) {
            for (const v of val) parts.push(`${key}=${encodeURIComponent(v)}`);
          } else {
            parts.push(`${key}=${encodeURIComponent(val as string)}`);
          }
        }
        return parts.join("&");
      },
    });

    const lighthouse = response.data?.lighthouseResult;
    if (!lighthouse) return null;

    const cats = lighthouse.categories || {};
    const perfScore = cats.performance?.score;
    if (perfScore === undefined || perfScore === null) return null;

    const audits = lighthouse.audits || {};

    return {
      performanceScore: Math.round(perfScore * 100),
      accessibilityScore: Math.round((cats.accessibility?.score ?? 0) * 100),
      bestPracticesScore: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      seoScore: Math.round((cats.seo?.score ?? 0) * 100),
      firstContentfulPaint: Math.round(audits["first-contentful-paint"]?.numericValue || 0),
      largestContentfulPaint: Math.round(audits["largest-contentful-paint"]?.numericValue || 0),
      totalBlockingTime: Math.round(audits["total-blocking-time"]?.numericValue || 0),
      cumulativeLayoutShift: parseFloat((audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(3)),
      speedIndex: Math.round(audits["speed-index"]?.numericValue || 0),
    };
  } catch (error) {
    logger.warn(
      { url, strategy, error: error instanceof Error ? error.message : error },
      "PageSpeed API call failed"
    );
    return null;
  }
}

/**
 * Get both mobile and desktop Lighthouse scores for a URL.
 * Runs SEQUENTIALLY (desktop first, then mobile) to avoid Google rate-limiting.
 * Returns null entirely if API key is missing or URL is invalid.
 */
export async function getPageSpeedScores(url: string): Promise<PageSpeedResult | null> {
  if (!API_KEY) return null;

  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return null;
  }

  // Sequential: desktop first (faster, more reliable), then mobile
  const desktop = await fetchScore(url, "desktop");
  const mobile = await fetchScore(url, "mobile");

  if (!mobile && !desktop) return null;

  return { mobile, desktop };
}
