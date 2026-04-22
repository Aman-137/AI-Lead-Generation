import axios from "axios";
import logger from "../utils/logger";

export interface LeadFinderParams {
  niche: string;
  location: string;
  limit?: number;
}

export interface FoundLead {
  name: string;
  email?: string;
  company: string;
  website?: string;
  phone?: string;
  industry?: string;
  address?: string;
}

interface SerperPlace {
  title?: string;
  address?: string;
  phone?: string;
  phoneNumber?: string;
  website?: string;
  category?: string;
  rating?: number;
  ratingCount?: number;
}

/**
 * Find leads using Serper.dev Google Maps/Places API
 */
export async function findLeadsByNiche(
  params: LeadFinderParams
): Promise<FoundLead[]> {
  const { niche, location, limit = 50 } = params;

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    logger.error("SERPER_API_KEY not set");
    return [];
  }

  try {
    logger.info({ niche, location, limit }, "Searching for leads");

    const leads: FoundLead[] = [];
    let page = 1;

    // Serper returns ~10 results per page, so paginate until we hit the limit
    while (leads.length < limit) {
      const response = await axios.post(
        "https://google.serper.dev/places",
        {
          q: `${niche} in ${location}`,
          page,
        },
        {
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      const places: SerperPlace[] = response.data?.places || [];

      if (places.length === 0) break;

      for (const place of places) {
        if (leads.length >= limit) break;

        const company = place.title?.trim();
        if (!company) continue;

        // Only include if they have a website or phone (useful leads)
        if (!place.website && !place.phone && !place.phoneNumber) continue;

        leads.push({
          name: company,
          company,
          website: place.website || "",
          phone: place.phone || place.phoneNumber || "",
          industry: place.category || niche,
          address: place.address || "",
        });
      }

      // If we got fewer results than a full page, no more pages
      if (places.length < 10) break;
      page++;

      // Safety cap: don't exceed 5 API calls per search
      if (page > 5) break;
    }

    logger.info({ count: leads.length }, "Leads found");
    return leads;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      "Error finding leads"
    );
    return [];
  }
}

/**
 * Validate and clean lead data
 */
export function validateLead(lead: FoundLead): boolean {
  return (
    !!lead.company &&
    lead.company.trim().length > 0 &&
    !!(lead.email?.includes("@") || lead.website?.startsWith("http") || lead.phone)
  );
}

/**
 * Format leads for database insertion
 */
export function formatLeadsForDB(
  leads: FoundLead[],
  userId: string,
  sourceId: string
): any[] {
  return leads
    .filter(validateLead)
    .map((lead) => {
      const hasEmail = !!lead.email?.includes("@");
      const hasWebsite = !!lead.website?.startsWith("http");
      return {
        user_id: userId,
        source_id: sourceId,
        name: lead.name || lead.company,
        email: lead.email || "",
        company: lead.company,
        website: lead.website || "",
        phone: lead.phone || "",
        industry: lead.industry || "",
        contact_method: hasEmail ? "email" : "call",
        enriched_data: lead.address ? { address: lead.address } : undefined,
      };
    });
}
