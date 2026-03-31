export interface LeadScoringData {
  website?: string;
  enriched_data?: {
    hasOnlineBooking?: boolean;
    hasContactForm?: boolean;
    technologies?: string[];
    hasAds?: boolean;
  };
  company?: string;
}

/**
 * Score a lead based on multiple factors
 * Higher score = better lead quality
 * Range: 0-100
 */
export function scoreLead(data: LeadScoringData): number {
  let score = 0;

  // Has website: +20 points
  if (data.website && data.website.startsWith("http")) {
    score += 20;
  }

  // Website appears outdated (old tech stack): +30 points
  if (data.enriched_data?.technologies) {
    const oldTechs = ["WordPress", "Wix"];
    if (
      oldTechs.some((tech) =>
        data.enriched_data?.technologies?.includes(tech)
      )
    ) {
      score += 30;
    }
  }

  // No ads detected (implies not spending on digital marketing): +30 points
  // This is inferred from: not having modern tools, slow adoption of digital
  if (data.enriched_data) {
    const hasModernTools =
      data.enriched_data.hasOnlineBooking ||
      data.enriched_data.hasContactForm;
    if (
      !hasModernTools &&
      data.enriched_data.technologies &&
      data.enriched_data.technologies.length === 0
    ) {
      score += 30;
    }
  }

  // Small business indicator (from company name, no website, basic presence): +20 points
  // Assumption: small businesses without sophisticated online presence
  if (
    data.company &&
    (!data.website || !data.enriched_data?.hasContactForm)
  ) {
    score += 20;
  }

  // Bonus for having enriched data indicating engagement potential
  if (
    data.enriched_data?.hasOnlineBooking ||
    (data.enriched_data?.technologies &&
      data.enriched_data.technologies.length > 0)
  ) {
    score = Math.min(score + 10, 100); // Cap at 100
  }

  return Math.max(0, Math.min(score, 100)); // Ensure score is between 0-100
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
