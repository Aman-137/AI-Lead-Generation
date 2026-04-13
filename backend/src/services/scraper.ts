import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import dns from "dns/promises";
import logger from "../utils/logger";

export interface WebsiteData {
  title: string;
  description: string;
  headings: string[];
  hasOnlineBooking: boolean;
  hasContactForm: boolean;
  socialLinks: string[];
  technologies: string[];
  industry: string;
  emails: string[];
}

// Block private/internal IPs to prevent SSRF
function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return true; // block anything weird

  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 127.0.0.0/8 (localhost)
  if (parts[0] === 127) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0
  if (parts.every(p => p === 0)) return true;

  return false;
}

async function isUrlSafe(websiteUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(websiteUrl);

    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    // Block localhost hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "0.0.0.0" || hostname.endsWith(".local")) return false;

    // Resolve DNS and check if it points to a private IP
    const addresses = await dns.resolve4(hostname);
    for (const ip of addresses) {
      if (isPrivateIP(ip)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch and parse website content to extract business information
 */
export async function scrapeWebsite(
  websiteUrl: string
): Promise<Partial<WebsiteData> | null> {
  try {
    if (!websiteUrl || !websiteUrl.startsWith("http")) {
      return null;
    }

    // SSRF protection: block internal/private IPs
    const safe = await isUrlSafe(websiteUrl);
    if (!safe) {
      logger.warn({ url: websiteUrl }, "Blocked SSRF attempt — URL resolves to private/internal IP");
      return null;
    }

    const response = await axios.get(websiteUrl, {
      timeout: 5000,
      maxRedirects: 3,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract title and meta description
    const title = $("title").text() || $("h1").first().text() || "";
    const description =
      $('meta[name="description"]').attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      "";

    // Extract main headings
    const headings: string[] = [];
    $("h1, h2, h3")
      .slice(0, 5)
      .each((_i: number, el: any) => {
        const text = $(el).text().trim();
        if (text) headings.push(text);
      });

    // Check for booking/form indicators
    const pageText = $("body").text().toLowerCase();
    const hasOnlineBooking =
      pageText.includes("book") ||
      pageText.includes("appointment") ||
      pageText.includes("schedule");
    const hasContactForm = pageText.includes("contact") || $("form").length > 0;

    // Extract social links
    const socialLinks: string[] = [];
    $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]').each(
      (_i: number, el: any) => {
        const href = $(el).attr("href");
        if (href) socialLinks.push(href);
      }
    );

    // Detect common technology indicators
    const technologies: string[] = [];
    const $html = $.html();
    if ($html.includes("shopify")) technologies.push("Shopify");
    if ($html.includes("wordpress")) technologies.push("WordPress");
    if ($html.includes("webflow")) technologies.push("Webflow");
    if ($html.includes("wix")) technologies.push("Wix");

    // Extract email addresses from page
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const rawEmails = ($html.match(emailRegex) || []);
    // Dedupe and filter out common junk emails
    const junkDomains = ["example.com", "sentry.io", "wixpress.com", "wordpress.org"];
    const emails = [...new Set(rawEmails)]
      .filter(e => !junkDomains.some(d => e.endsWith(d)))
      .slice(0, 5);

    // Detect industry keywords
    let industry = "Unknown";
    const industries: { [key: string]: string[] } = {
      Dental: ["dentist", "dental", "orthodont", "teeth"],
      Legal: ["attorney", "lawyer", "law firm", "legal"],
      Medical: ["doctor", "physician", "clinic", "hospital"],
      "E-commerce": ["shop", "store", "ecommerce", "product"],
      SaaS: ["software", "saas", "platform", "subscription"],
      Agency: ["agency", "digital", "marketing", "design"],
    };

    for (const [ind, keywords] of Object.entries(industries)) {
      if (
        keywords.some((kw) =>
          pageText.includes(kw)
        )
      ) {
        industry = ind;
        break;
      }
    }

    return {
      title: title.slice(0, 200),
      description: description.slice(0, 500),
      headings,
      hasOnlineBooking,
      hasContactForm,
      socialLinks,
      technologies,
      industry,
      emails,
    };
  } catch (error) {
    logger.error(
      { url: websiteUrl, error: error instanceof Error ? error.message : error },
      "Error scraping website"
    );
    return null;
  }
}

/**
 * Generate enriched data summary based on scraped website
 */
export function generateEnrichmentSummary(websiteData: Partial<WebsiteData> | null, company: string): {
  summary: string;
  issues: string[];
  opportunity: string;
} {
  if (!websiteData) {
    return {
      summary: `${company} has a web presence`,
      issues: ["Unable to fully analyze website"],
      opportunity: "Website appears to need modernization",
    };
  }

  const issues: string[] = [];
  let opportunityScore = 0;

  // Analyze issues
  if (!websiteData.hasOnlineBooking) {
    issues.push("No online booking system");
    opportunityScore += 2;
  }
  if (!websiteData.hasContactForm) {
    issues.push("Limited contact options");
    opportunityScore += 1;
  }
  if (!websiteData.socialLinks || websiteData.socialLinks.length === 0) {
    issues.push("Minimal social media presence");
    opportunityScore += 1;
  }
  if (!websiteData.technologies || websiteData.technologies.length === 0) {
    issues.push("Using outdated technology stack");
    opportunityScore += 2;
  }

  // Generate summary
  const summary = `${company} (${websiteData.industry}): ${websiteData.title || "Local business"}. ${websiteData.description?.slice(0, 100) || "Business details available."}`;

  // Generate opportunity
  let opportunity = "Improve online visibility and customer engagement";
  if (opportunityScore >= 3) {
    opportunity =
      "Significant opportunity to modernize digital presence and boost conversions";
  } else if (opportunityScore >= 2) {
    opportunity =
      "Opportunity to enhance customer experience with modern tools";
  }

  return {
    summary: summary.slice(0, 300),
    issues: issues.slice(0, 5),
    opportunity,
  };
}
