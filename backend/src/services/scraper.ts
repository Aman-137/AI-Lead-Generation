import axios from "axios";
import * as cheerio from "cheerio";

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

    const response = await axios.get(websiteUrl, {
      timeout: 5000,
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
    console.error(
      `[Scraper] Error scraping ${websiteUrl}:`,
      error instanceof Error ? error.message : error
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
