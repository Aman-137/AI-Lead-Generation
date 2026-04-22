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
  phones: string[];
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
    // Check IPv4
    try {
      const addresses = await dns.resolve4(hostname);
      for (const ip of addresses) {
        if (isPrivateIP(ip)) return false;
      }
    } catch {
      // No A record — check if it has only AAAA (IPv6)
      try {
        const ipv6Addresses = await dns.resolve6(hostname);
        // Block loopback (::1) and link-local (fe80::) IPv6 addresses
        for (const ip of ipv6Addresses) {
          const lower = ip.toLowerCase();
          if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc00:") || lower.startsWith("fd")) return false;
        }
      } catch {
        // Cannot resolve at all — block it
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch and parse website content to extract business information
 * Scrapes homepage + attempts to find and scrape the contact page for better data
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

    const fetchPage = async (url: string): Promise<cheerio.CheerioAPI | null> => {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          maxRedirects: 3,
          maxContentLength: 2 * 1024 * 1024, // 2MB max — skip huge pages
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html",
          },
        });
        // Only parse HTML responses — skip PDFs, images, binary files
        const contentType = response.headers["content-type"] || "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
          return null;
        }
        if (typeof response.data !== "string") return null;
        return cheerio.load(response.data);
      } catch {
        return null;
      }
    };

    // Fetch homepage
    const $ = await fetchPage(websiteUrl);
    if (!$) return null;

    // Try to find and fetch the contact page from homepage navigation
    let contactPage$: cheerio.CheerioAPI | null = null;
    const baseUrl = new URL(websiteUrl);

    // Collect internal links from nav and footer (where contact pages are always linked)
    const navFooterLinks: string[] = [];
    $("nav a[href], header a[href], footer a[href]").each((_i: number, el: any) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const resolved = new URL(href, baseUrl);
        // Only same-domain, short internal paths (skip external, anchors, deep paths, assets)
        if (resolved.hostname !== baseUrl.hostname) return;
        const path = resolved.pathname;
        if (path === "/" || path === baseUrl.pathname) return;
        // Skip file extensions (images, PDFs, etc.)
        if (/\.\w{2,4}$/.test(path) && !/\.html?$/.test(path)) return;
        // Only short paths (1-2 segments) — contact pages are top-level, not /blog/some-post
        const segments = path.split("/").filter(Boolean);
        if (segments.length > 2) return;
        if (!navFooterLinks.includes(resolved.toString())) {
          navFooterLinks.push(resolved.toString());
        }
      } catch { /* ignore bad URLs */ }
    });

    // Quick check: "contact" and "kontakt" roots cover ~90% of languages
    // ("contact" matches: English, Spanish contacto, Portuguese contato, Italian contatti, French contactez)
    // ("kontakt" matches: German, Polish, Czech, Swedish, Norwegian, Danish)
    const quickContactMatch = navFooterLinks.find(url => /contact|kontakt/i.test(url));

    if (quickContactMatch) {
      // Fast path: found a likely contact page URL
      const contactSafe = await isUrlSafe(quickContactMatch);
      if (contactSafe) {
        contactPage$ = await fetchPage(quickContactMatch);
      }
    }

    if (!contactPage$) {
      // Structural fallback: fetch up to 3 nav/footer pages, check if any has a form with email+textarea
      // Skip the URL that already failed in fast path
      const candidates = navFooterLinks.filter(url => url !== quickContactMatch).slice(0, 3);
      for (const candidateUrl of candidates) {
        const candidateSafe = await isUrlSafe(candidateUrl);
        if (!candidateSafe) continue;
        const candidate$ = await fetchPage(candidateUrl);
        if (!candidate$) continue;
        // Check if this page has a contact form (email input + textarea) or mailto link
        const hasForm = candidate$("form").toArray().some(form => {
          const html = candidate$(form).html()?.toLowerCase() || "";
          return (html.includes('type="email"') || html.includes('name="email"')) && html.includes("<textarea");
        });
        const hasMailto = candidate$("a[href^='mailto:']").length > 0;
        if (hasForm || hasMailto) {
          contactPage$ = candidate$;
          break;
        }
      }
    }

    // Merge data from homepage + contact page
    const pages = [$];
    if (contactPage$) pages.push(contactPage$);

    // Extract title and meta description (homepage only)
    const title = $("title").text() || $("h1").first().text() || "";
    const description =
      $('meta[name="description"]').attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      "";

    // Extract main headings (homepage only)
    const headings: string[] = [];
    $("h1, h2, h3")
      .slice(0, 5)
      .each((_i: number, el: any) => {
        const text = $(el).text().trim();
        if (text) headings.push(text);
      });

    // Combine HTML and text from all pages for detection
    const allHtml = pages.map(p => p.html().toLowerCase()).join(" ");
    const allPageText = pages.map(p => p("body").text().toLowerCase()).join(" ");

    // Booking detection: check for known booking platform embeds/scripts/links + structural patterns
    const hasOnlineBooking = await (async () => {
      // 1. Known booking platform signatures in HTML (iframes, scripts, links) — works in any language
      const bookingPlatforms = [
        // General scheduling
        "calendly.com", "acuityscheduling.com", "tidycal.com", "cal.com/",
        "youcanbook.me", "zcal.co", "savvycal.com", "doodle.com",
        "picktime.com", "10to8.com", "setmore.com", "appointy.com",
        "simplybook.me", "genbook.com", "schedulicity.com",
        // Square / business
        "squareup.com/appointments", "square.site",
        // Restaurant / food
        "opentable.com", "resy.com", "yelp.com/reservations", "thefork.com",
        // Beauty / salon / spa
        "booksy.com", "fresha.com", "vagaro.com", "styleseat.com",
        "gettimely.com", "phorest.com", "yclients.com", "treatwell.com",
        // Fitness / wellness
        "mindbodyonline.com", "mindbody.io", "classpass.com",
        // Health / medical
        "zocdoc.com", "doctolib.com", "hotdoc.com.au", "practo.com",
        "jane.app", "cliniko.com", "therapynotes.com", "simplepractice.com",
        // CRM / B2B scheduling
        "hubspot.com/meetings", "zoho.com/bookings", "chilipiper.com",
        "nylas.com/scheduler",
        // Microsoft
        "microsoft.com/bookings",
        // Service businesses
        "bookingkoala.com",
      ];
      if (bookingPlatforms.some(p => allHtml.includes(p))) return true;

      // 2. Structural signals: booking/reservation CSS classes BUT only if they contain
      // an interactive element (iframe, form, button, input) — a plain div with "booking" in
      // the class that just says "call us" should NOT count
      for (const p of pages) {
        const bookingElements = p("[class*='booking'], [id*='booking'], [class*='reservat'], [id*='reservat'], [data-booking], [data-reservation]");
        let hasInteractive = false;
        bookingElements.each((_i: number, el: any) => {
          const inner = p(el).html()?.toLowerCase() || "";
          if (inner.includes("<iframe") || inner.includes("<form") || inner.includes("<input") || inner.includes("<select") || inner.includes("<button")) {
            hasInteractive = true;
          }
        });
        if (hasInteractive) return true;
      }

      // 3. Schema.org structured data for reservations
      if (allHtml.includes("reserveaction") || allHtml.includes("bookingaction") || allHtml.includes("scheduleaction")) return true;

      // 4. Links with booking-related URL paths — fetch the actual page and check
      // if it has a real booking system (form, iframe, platform embed), not just a phone number
      for (const p of pages) {
        const bookingLinks: string[] = [];
        p("a[href*='/book'], a[href*='/reserve'], a[href*='/appointment'], a[href*='/schedule'], a[href*='/booking']").each((_i: number, el: any) => {
          const href = p(el).attr("href");
          if (!href) return;
          try {
            const resolved = new URL(href, baseUrl);
            if (resolved.hostname !== baseUrl.hostname) return;
            if (!bookingLinks.includes(resolved.toString())) {
              bookingLinks.push(resolved.toString());
            }
          } catch { /* skip bad URLs */ }
        });

        // Fetch up to 2 booking-path pages and verify they have real booking elements
        for (const bookingUrl of bookingLinks.slice(0, 2)) {
          const urlSafe = await isUrlSafe(bookingUrl);
          if (!urlSafe) continue;
          const bookingPage$ = await fetchPage(bookingUrl);
          if (!bookingPage$) continue;
          const pageHtml = bookingPage$.html().toLowerCase();

          // Check for platform signatures on the booking page
          if (bookingPlatforms.some(bp => pageHtml.includes(bp))) return true;

          // Check for interactive booking elements: forms with date/time inputs, iframes, calendar widgets
          const hasBookingForm = bookingPage$("form").toArray().some(form => {
            const formHtml = bookingPage$(form).html()?.toLowerCase() || "";
            return formHtml.includes('type="date"') || formHtml.includes('type="time"') ||
                   formHtml.includes('type="datetime') || formHtml.includes("calendar") ||
                   formHtml.includes("datepicker") || formHtml.includes("timeslot") ||
                   formHtml.includes("time-slot") || formHtml.includes("availability");
          });
          if (hasBookingForm) return true;

          // Check for booking iframes or calendar widgets on the page
          if (bookingPage$("iframe").length > 0) {
            const iframeSrc = bookingPage$("iframe").toArray().map(el => bookingPage$(el).attr("src") || "").join(" ").toLowerCase();
            if (bookingPlatforms.some(bp => iframeSrc.includes(bp)) || iframeSrc.includes("booking") || iframeSrc.includes("schedule") || iframeSrc.includes("calendar")) {
              return true;
            }
          }

          // Page exists but has no booking system — just phone/text, skip it
        }
      }

      return false;
    })();

    // Contact form detection: structural HTML analysis (language-agnostic, checks all pages)
    const hasContactForm = (() => {
      for (const p of pages) {
        const forms = p("form");
        let hasRealContactForm = false;

        forms.each((_i: number, form: any) => {
          const formHtml = p(form).html()?.toLowerCase() || "";
          const hasEmailField = formHtml.includes('type="email"') || formHtml.includes('name="email"');
          const hasPhoneField = formHtml.includes('type="tel"') || formHtml.includes('name="phone"');
          const hasMessageField = formHtml.includes("<textarea");
          const hasNameField = formHtml.includes('name="name"') || formHtml.includes('name="full') ||
            formHtml.includes('type="text"');
          if ((hasEmailField || hasNameField || hasPhoneField) && hasMessageField) {
            hasRealContactForm = true;
          }
        });
        if (hasRealContactForm) return true;
      }

      // Check for known contact form platform embeds
      const contactPlatforms = [
        "typeform.com", "jotform.com", "wufoo.com", "formspree.io",
        "getform.io", "formsubmit.co", "netlify.com/forms", "hubspot.com/forms",
        "mailchimp.com", "constantcontact.com",
      ];
      if (contactPlatforms.some(p => allHtml.includes(p))) return true;

      // Check for live chat widgets (counts as a contact method)
      const chatPlatforms = [
        "tawk.to", "livechatinc.com", "livechat.com",
        "intercom.io", "intercomcdn.com",
        "drift.com", "driftt.com",
        "zendesk.com/embeddable", "zopim.com",
        "crisp.chat", "tidio.co", "freshchat.com",
        "olark.com", "smartsupp.com", "chatra.io",
        "helpscout.net/beacon", "hubspot.com/conversations",
      ];
      if (chatPlatforms.some(p => allHtml.includes(p))) return true;

      return false;
    })();

    // Extract social links (from all pages, deduplicated by platform profile)
    const rawSocialLinks: string[] = [];
    for (const p of pages) {
      p('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="linkedin.com"], a[href*="instagram.com"], a[href*="youtube.com"], a[href*="tiktok.com"]').each(
        (_i: number, el: any) => {
          const href = p(el).attr("href");
          if (href && !rawSocialLinks.includes(href)) rawSocialLinks.push(href);
        }
      );
    }
    // Filter out individual posts/reels/videos — keep only profile/page links
    // Deduplicate by normalizing to base profile URL
    const socialLinks = [...new Set(
      rawSocialLinks
        .filter(url => {
          // Skip individual posts, reels, stories, status updates
          if (/\/reel\//i.test(url)) return false;
          if (/\/p\//i.test(url)) return false; // instagram posts
          if (/\/status\//i.test(url)) return false; // tweets
          if (/\/posts\//i.test(url)) return false; // facebook posts
          if (/\/watch\?/i.test(url)) return false; // youtube videos
          if (/\/video\//i.test(url)) return false; // tiktok videos
          if (/\/stories\//i.test(url)) return false;
          if (/\/share\//i.test(url)) return false;
          // Skip generic platform links (no profile path)
          if (/^https?:\/\/(www\.)?(facebook|twitter|x|instagram|linkedin|youtube|tiktok)\.com\/?$/i.test(url)) return false;
          return true;
        })
        .map(url => url.replace(/\?.*$/, "").replace(/\/$/, "")) // strip query params and trailing slash
    )].slice(0, 6); // max 6 unique profiles

    // Detect common technology indicators
    const technologies: string[] = [];
    if (allHtml.includes("shopify")) technologies.push("Shopify");
    if (allHtml.includes("wordpress")) technologies.push("WordPress");
    if (allHtml.includes("webflow")) technologies.push("Webflow");
    if (allHtml.includes("wix")) technologies.push("Wix");

    // Extract email addresses from all pages
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const rawEmails = (allHtml.match(emailRegex) || []);

    // Dedupe and filter out junk emails from libraries, frameworks, and code
    const junkDomains = [
      "example.com", "sentry.io", "wixpress.com", "wordpress.org",
      "greensock.com", "broofa.com", "github.com", "npmjs.com",
      "jquery.com", "google.com", "googleapis.com", "gstatic.com",
      "facebook.com", "twitter.com", "cloudflare.com", "jsdelivr.net",
      "w3.org", "schema.org", "mozilla.org", "apache.org",
      "bootstrapcdn.com", "fontawesome.com", "typekit.net",
    ];
    const junkPatterns = [
      /^noreply@/i, /^no-reply@/i, /^support@.*\.(js|css|json)/i,
      /\.png$/i, /\.jpg$/i, /\.gif$/i, /\.svg$/i, /\.webp$/i, /\.ico$/i,
      /\.js$/i, /\.css$/i, /\.json$/i, /\.woff$/i, /\.woff2$/i, /\.ttf$/i,
    ];

    // Valid TLDs — only keep emails with recognized top-level domains
    const validTlds = [
      "com", "net", "org", "io", "co", "us", "uk", "de", "es", "fr", "it", "nl",
      "be", "at", "ch", "pl", "pt", "se", "no", "dk", "fi", "ie", "cz", "ro",
      "hu", "bg", "hr", "sk", "lt", "lv", "ee", "si", "gr", "ru", "au", "nz",
      "ca", "mx", "br", "ar", "cl", "in", "jp", "kr", "cn", "tw", "hk", "sg",
      "za", "info", "biz", "me", "tv", "cc", "eu", "berlin", "london", "nyc",
      "app", "dev", "tech", "store", "shop", "online", "site", "xyz",
    ];

    // Extract website domain for matching
    let siteDomain = "";
    try {
      siteDomain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch { /* ignore */ }

    const uniqueEmails = [...new Set(rawEmails)]
      .filter(e => {
        const lower = e.toLowerCase();
        const [localPart, domain] = lower.split("@");
        if (!localPart || !domain) return false;
        // Filter out junk domains
        if (junkDomains.some(d => lower.endsWith(`@${d}`) || lower.endsWith(`.${d}`))) return false;
        // Filter out junk patterns
        if (junkPatterns.some(p => p.test(lower))) return false;
        // Filter out very long emails (likely encoded data)
        if (e.length > 60) return false;
        // Local part too short (e.g. "a@domain.com") or only digits
        if (localPart.length < 2) return false;
        if (/^\d+$/.test(localPart)) return false;
        // Domain must have a recognized TLD
        const tld = domain.split(".").pop() || "";
        if (!validTlds.includes(tld)) return false;
        // Domain must have at least 2 parts (e.g. "company.com", not just "com")
        if (domain.split(".").length < 2) return false;
        // Reject if domain part before TLD is too short (e.g. "flags@2x.webp")
        const domainName = domain.split(".").slice(0, -1).join(".");
        if (domainName.length < 2) return false;
        return true;
      });

    // Prioritize: 1) emails matching website domain, 2) common business emails, 3) others
    const domainEmails = uniqueEmails.filter(e => {
      if (!siteDomain) return false;
      const emailDomain = e.split("@")[1]?.toLowerCase() || "";
      return emailDomain === siteDomain || siteDomain.includes(emailDomain) || emailDomain.includes(siteDomain);
    });

    const businessPrefixes = ["info", "contact", "hello", "office", "admin", "dr", "doctor", "team"];
    const businessEmails = uniqueEmails.filter(e => {
      const prefix = e.split("@")[0]?.toLowerCase() || "";
      return businessPrefixes.some(p => prefix === p || prefix.startsWith(p));
    });

    // Pick best emails: domain matches first, then business-looking ones, then rest
    const emails = [
      ...domainEmails,
      ...businessEmails.filter(e => !domainEmails.includes(e)),
      ...uniqueEmails.filter(e => !domainEmails.includes(e) && !businessEmails.includes(e)),
    ].slice(0, 5);

    // Extract phone numbers from all pages
    const telLinks: string[] = [];
    const visibleTexts: string[] = [];
    for (const p of pages) {
      p('a[href^="tel:"]').each((_i: number, el: any) => {
        const href = p(el).attr("href")?.replace("tel:", "").replace(/\s+/g, "").trim();
        if (href && !telLinks.includes(href)) telLinks.push(href);
      });
      const $bodyClone = p("body").clone();
      $bodyClone.find("script, style, noscript, svg, code").remove();
      visibleTexts.push($bodyClone.text());
    }
    const visibleText = visibleTexts.join(" ");

    // Priority 2: International format with + prefix (+34 931 87 32 36, +1 212-601-2693, +44 20 7946 0958, +33 1 23 45 67 89)
    const intlPhoneRegex = /\+\d{1,3}[-.\s]?\(?\d{1,5}\)?(?:[-.\s]?\d{1,5}){2,5}/g;
    const intlMatches = (visibleText.match(intlPhoneRegex) || []);

    // Priority 3: US/CA format with required separators: (XXX) XXX-XXXX or XXX-XXX-XXXX
    const usPhoneRegex = /(?:\(\d{3}\)\s?|\b\d{3}[-.])\d{3}[-.\s]?\d{4}\b/g;
    const usMatches = (visibleText.match(usPhoneRegex) || []);

    // Priority 4: European local formats (e.g. 93 387 38 75, 020 7946 0958) — only from visible text
    const euroLocalRegex = /\b0\d{1,4}[-.\s]?\d{2,5}(?:[-.\s]?\d{2,5}){1,3}\b/g;
    const euroMatches = (visibleText.match(euroLocalRegex) || [])
      .filter(p => {
        const digits = p.replace(/\D/g, "");
        return digits.length >= 9 && digits.length <= 13;
      });

    // Combine: tel links first (most reliable), then international, then US, then European local
    const allPhones = [...telLinks, ...intlMatches, ...usMatches, ...euroMatches];
    const phones = [...new Set(
      allPhones
        .map(p => p.replace(/\s+/g, " ").trim())
        .filter(p => {
          const digits = p.replace(/\D/g, "");
          // 7-15 digits (ITU international standard)
          if (digits.length < 7 || digits.length > 15) return false;
          // Reject all-same digits (e.g. 1111111111)
          if (/^(\d)\1+$/.test(digits)) return false;
          return true;
        })
    )].slice(0, 3);

    // Industry is set from the search niche (auto-find) or CSV column — not detected from HTML.
    // Scraper returns "Unknown" and the enrichment route overrides it with lead.industry if available.
    const industry = "Unknown";

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
      phones,
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
    issues.push("No recognizable web platform detected");
    opportunityScore += 1;
  }
  // Flag actually outdated platforms (WordPress is legacy; Wix/Shopify/Webflow are modern)
  if (websiteData.technologies?.includes("WordPress")) {
    issues.push("Using WordPress (legacy platform)");
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
