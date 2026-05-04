export interface LeadScoringData {
  website?: string;
  enriched_data?: {
    hasOnlineBooking?: boolean;
    hasContactForm?: boolean;
    technologies?: string[];
    hasAds?: boolean;
    socialLinks?: string[];
    headings?: string[];
    title?: string;
    description?: string;
    industry?: string;
    // New signals
    isMobileFriendly?: boolean;
    hasSSL?: boolean;
    hasMetaDescription?: boolean;
    pageLoadTimeMs?: number;
    copyrightYear?: number | null;
    isSPA?: boolean;
    isParkedDomain?: boolean;
    _siteDown?: boolean;
    // PageSpeed Insights
    pageSpeed?: {
      mobile?: { performanceScore: number } | null;
      desktop?: { performanceScore: number } | null;
    } | null;
    // Ad & analytics signals
    hasGoogleAds?: boolean;
    hasFacebookPixel?: boolean;
    hasAnalytics?: boolean;
    // Google Maps data
    googleRating?: number;
    googleReviewCount?: number;
  };
  company?: string;
  industry?: string;
}

/**
 * Score a lead based on multiple factors
 * Higher score = better opportunity (the business needs digital help)
 * Lower score = business is already digitally mature (poor lead)
 * Range: 0-100
 */
export function scoreLead(data: LeadScoringData): number {
  let score = 0;

  // --- POSITIVE signals (business needs help) ---

  // No website at all: +30 points (highest opportunity — business has zero digital presence)
  // Has a basic website: +15 points
  const hasWebsite = data.website && data.website.startsWith("http");
  if (!hasWebsite) {
    score += 30;
  } else {
    score += 15;
  }

  // If no enriched data available, score conservatively based on what we know
  if (!data.enriched_data) {
    if (!hasWebsite) {
      // No website AND no enriched data = business has zero digital presence = high opportunity
      score += 25; // no booking
      score += 15; // no contact form
      score += 10; // no social media
      return Math.max(0, Math.min(score, 100)); // 80 total
    }
    // Has website but scrape failed (timeout, blocked, etc.) — we don't know their digital state
    // Score conservatively in the middle — don't assume good or bad
    return 40;
  }

  // Site is completely unreachable (DNS failure, connection refused, 5xx)
  if (data.enriched_data?._siteDown) {
    score += 20; // no working site
    score += 25; // no booking (site is down)
    score += 15; // no contact form (site is down)
    score += 10; // assume no social
    return Math.max(0, Math.min(score, 100)); // 85 total (15 base + 70)
  }

  // Parked domain — nearly as bad as no website
  if (data.enriched_data?.isParkedDomain) {
    score += 20; // domain parked, no real site
    score += 25; // no booking
    score += 15; // no contact form
    score += 10; // no social
    return Math.max(0, Math.min(score, 100)); // 85 total
  }

  // For SPA sites, only use signals we can reliably detect (SSL, mobile, speed)
  // Don't penalize for missing booking/forms/social since we can't see JS-rendered content
  const isSPA = data.enriched_data?.isSPA || false;

  // Uses legacy tech (WordPress): +20 points
  if (data.enriched_data.technologies) {
    const legacyTechs = ["WordPress", "Joomla", "Drupal"];
    if (legacyTechs.some(tech => data.enriched_data?.technologies?.includes(tech))) {
      score += 20;
    }
  }

  // No online booking system: +25 points (major opportunity for service businesses)
  // Skip for SPA sites — we can't reliably detect JS-rendered booking
  if (!isSPA && data.enriched_data && !data.enriched_data.hasOnlineBooking) {
    score += 25;
  }

  // No contact form: +15 points
  if (!isSPA && data.enriched_data && !data.enriched_data.hasContactForm) {
    score += 15;
  }

  // No or minimal social media presence: +10 points
  if (!data.enriched_data?.socialLinks || data.enriched_data.socialLinks.length <= 1) {
    score += 10;
  }

  // No detectable tech platform (basic HTML or unknown): +10 points
  if (data.enriched_data && (!data.enriched_data.technologies || data.enriched_data.technologies.length === 0)) {
    score += 10;
  }

  // --- NEW POSITIVE SIGNALS ---

  // No SSL: +10 points (browser shows "Not Secure" — trust killer)
  if (data.enriched_data?.hasSSL === false) {
    score += 10;
  }

  // Not mobile-friendly: +10 points (broken on phones = losing customers)
  if (!isSPA && data.enriched_data?.isMobileFriendly === false) {
    score += 10;
  }

  // Slow page (>3s) or poor Google PageSpeed score: +5 points
  // Prefer PageSpeed score if available (more authoritative)
  const mobileScore = data.enriched_data?.pageSpeed?.mobile?.performanceScore;
  if (mobileScore !== undefined && mobileScore !== null) {
    // Google considers <50 as poor performance
    if (mobileScore < 50) {
      score += 5;
    }
  } else if (data.enriched_data?.pageLoadTimeMs && data.enriched_data.pageLoadTimeMs > 3000) {
    score += 5;
  }

  // No meta description: +5 points (poor SEO)
  if (data.enriched_data?.hasMetaDescription === false) {
    score += 5;
  }

  // Outdated copyright: +5 points (site looks abandoned)
  const currentYear = new Date().getFullYear();
  if (data.enriched_data?.copyrightYear && data.enriched_data.copyrightYear < currentYear - 1) {
    score += 5;
  }

  // No Google Ads: +5 points (not running paid advertising)
  if (data.enriched_data?.hasGoogleAds === false) {
    score += 5;
  }

  // No Facebook Pixel: +5 points (not running social ads)
  if (data.enriched_data?.hasFacebookPixel === false) {
    score += 5;
  }

  // No analytics at all: +5 points (flying blind — not tracking visitors)
  if (data.enriched_data?.hasAnalytics === false) {
    score += 5;
  }

  // Low Google rating (<4.0) or very few reviews: +5 points (reputation problem = opportunity)
  if (data.enriched_data?.googleRating !== undefined && data.enriched_data.googleRating < 4.0) {
    score += 5;
  }
  if (data.enriched_data?.googleReviewCount !== undefined && data.enriched_data.googleReviewCount < 10) {
    score += 5;
  }

  // --- NEGATIVE signals (business is digitally mature — bad lead) ---

  // Has both booking AND contact form: -20 (they have their digital presence together)
  if (data.enriched_data?.hasOnlineBooking && data.enriched_data?.hasContactForm) {
    score -= 20;
  }

  // Uses modern platforms (Wix, Shopify, Webflow, Squarespace, Duda): -15 (already invested in digital)
  if (data.enriched_data?.technologies) {
    const modernPlatforms = ["Shopify", "Webflow", "Wix", "Squarespace", "Duda"];
    if (modernPlatforms.some(tech => data.enriched_data?.technologies?.includes(tech))) {
      score -= 15;
    }
  }

  // Business is a digital/marketing/agency competitor: -30
  // These businesses provide digital services — they don't need yours
  const companyLower = (data.company || "").toLowerCase();
  const titleLower = (data.enriched_data?.title || "").toLowerCase();
  const descLower = (data.enriched_data?.description || "").toLowerCase();
  const combinedText = `${companyLower} ${titleLower} ${descLower}`;
  const competitorSignals = [
    /\bseo\s+(agency|company|firm|service|expert)/i,
    /\bweb\s+(design|development|developer)\s+(agency|company|firm|studio)/i,
    /\bdigital\s+(marketing|agency)/i,
    /\bmarketing\s+(agency|company|firm)/i,
    /\bbranding\s+agency/i,
    /\bsoftware\s+(development|company)/i,
    /\b(we\s+help|we\s+build|we\s+design|we\s+develop)\b/i,
  ];
  if (competitorSignals.some(regex => regex.test(combinedText))) {
    score -= 30;
  }

  // Strong social media presence (3+ platforms): -10
  if (data.enriched_data?.socialLinks && data.enriched_data.socialLinks.length >= 3) {
    score -= 10;
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Get lead quality tier based on score
 */
export function getLeadQualityTier(
  score: number
): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Filter leads by quality threshold
 */
export function filterLeadsByScore(
  leads: Array<any>,
  minScore: number = 40
): Array<any> {
  return leads.filter((lead) => {
    const score = lead.score || 0;
    return score >= minScore;
  });
}
