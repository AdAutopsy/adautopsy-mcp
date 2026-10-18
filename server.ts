import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ApifyClient } from "apify-client";
import * as cheerio from "cheerio";
import { z } from "zod";
import dotenv from "dotenv";
import { renderLanding } from "./landing.js";

dotenv.config();

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

// ============================================================================
// 1. ENVIRONMENT VARIABLES & IN-MEMORY STATE
// ============================================================================
const PORT = process.env.PORT || 3000;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || "";

// Dodo Payments Product IDs & Checkout Links (Can be added after initial deploy)
const DODO_GROWTH_PRODUCT_ID = process.env.DODO_GROWTH_PRODUCT_ID || "";
const DODO_PRO_PRODUCT_ID = process.env.DODO_PRO_PRODUCT_ID || "";
const DODO_AGENCY_PRODUCT_ID = process.env.DODO_AGENCY_PRODUCT_ID || "";

const CHECKOUT_GROWTH_URL = process.env.CHECKOUT_GROWTH_URL || "#pricing";
const CHECKOUT_PRO_URL = process.env.CHECKOUT_PRO_URL || "#pricing";
const CHECKOUT_AGENCY_URL = process.env.CHECKOUT_AGENCY_URL || "#pricing";

// Stateless In-Memory Free Preview Limiter (2 scans per IP/User)
const freeTrialUsage = new Map<string, number>();

type TierLevel = "FREE" | "GROWTH" | "PRO" | "AGENCY";

interface TierConfig {
  tier: TierLevel;
  rawScanLimit: number;
  topWinnersReturned: number;
  fullFunnelAccess: boolean;
}

const TIER_SPECS: Record<TierLevel, TierConfig> = {
  FREE: { tier: "FREE", rawScanLimit: 5, topWinnersReturned: 1, fullFunnelAccess: false },
  GROWTH: { tier: "GROWTH", rawScanLimit: 15, topWinnersReturned: 2, fullFunnelAccess: true },
  PRO: { tier: "PRO", rawScanLimit: 30, topWinnersReturned: 5, fullFunnelAccess: true },
  AGENCY: { tier: "AGENCY", rawScanLimit: 50, topWinnersReturned: 10, fullFunnelAccess: true },
};

// ============================================================================
// 2. DODO PAYMENTS LICENSE VALIDATOR + XAI REVIEWER BYPASS
// ============================================================================
async function resolveUserTier(licenseKey?: string): Promise<{
  config: TierConfig;
  error?: string;
}> {
  const cleanKey = licenseKey?.trim();

  if (!cleanKey) {
    return { config: TIER_SPECS.FREE };
  }

  // Hardcoded xAI QA Reviewer Bypass -> Grants automatic AGENCY tier
  if (cleanKey === "XAI_REVIEWER_PRO") {
    return { config: TIER_SPECS.AGENCY };
  }

  try {
    const response = await fetch("https://live.dodopayments.com/licenses/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: cleanKey }),
    });

    if (!response.ok) {
      return {
        config: TIER_SPECS.FREE,
        error: `Invalid or expired license key ("${cleanKey}"). Falling back to Free Preview Tier.`,
      };
    }

    const data: any = await response.json();
    const isValid = data.valid === true || data.status === "active" || data.is_valid === true;

    if (!isValid) {
      return {
        config: TIER_SPECS.FREE,
        error: `License key "${cleanKey}" is inactive. Falling back to Free Preview Tier.`,
      };
    }

    const productId = data.product_id || data.product?.id || "";

    if (productId === DODO_AGENCY_PRODUCT_ID) {
      return { config: TIER_SPECS.AGENCY };
    } else if (productId === DODO_PRO_PRODUCT_ID) {
      return { config: TIER_SPECS.PRO };
    } else if (productId === DODO_GROWTH_PRODUCT_ID) {
      return { config: TIER_SPECS.GROWTH };
    }

    return { config: TIER_SPECS.GROWTH };
  } catch (err: any) {
    console.error("Dodo validation error:", err.message);
    return {
      config: TIER_SPECS.FREE,
      error: "Could not reach license server. Falling back to Free Preview Tier.",
    };
  }
}

function getUpgradeCallout(): string {
  return `
---
🚀 **UPGRADE AdAutopsy FOR FULL ACCESS**
Unlock deeper Meta Ad Library scrapes, more winning video scripts, and complete landing page funnel clone specs:
• **Growth ($14.99/mo)**: Scans 15 ads, returns Top 2 Winners + Full Landing Page Deconstructor -> ${CHECKOUT_GROWTH_URL}
• **Pro ($29.99/mo)**: Scans 30 ads, returns Top 5 Winners + Full Landing Page Deconstructor -> ${CHECKOUT_PRO_URL}
• **Agency ($69.99/mo)**: Scans 50 ads, returns Top 10 Winners + 5 Team Activations -> ${CHECKOUT_AGENCY_URL}
*(After checkout, pass your Dodo License Key in your prompt to unlock instantly!)*`;
}

// ============================================================================
// 3. MCP SERVER FACTORY (TOOLS 1 & 2)
// ============================================================================
function createAdAutopsyMcpServer(clientIp: string) {
  const server = new McpServer({
    name: "AdAutopsy",
    version: "1.0.0",
  });

  // --------------------------------------------------------------------------
  // TOOL 1: spy_and_rewrite_winning_ads
  // --------------------------------------------------------------------------
  server.tool(
    "spy_and_rewrite_winning_ads",
    "Scrapes active competitor ads from the Meta Ad Library, filters for the longest-running profitable winners (days_running), extracts 3-second hooks, ad copy, media previews, and destination landing_page_url, and instructs Grok Bot to rewrite hooks and shot-by-shot video scripts natively.",
    {
      search_query_or_url: z
        .string()
        .describe("Brand keyword (e.g., 'AG1', 'Ridge Wallet') OR a full Facebook Ad Library URL"),
      country_code: z
        .string()
        .default("US")
        .describe("2-letter ISO country code (e.g., 'US', 'IN', 'GB', 'ALL')"),
      license_key: z
        .string()
        .optional()
        .describe("Optional Dodo Payments license key (or XAI_REVIEWER_PRO)"),
    },
    async ({ search_query_or_url, country_code, license_key }) => {
      const { config, error: licenseWarning } = await resolveUserTier(license_key);

      if (config.tier === "FREE") {
        const usedScans = freeTrialUsage.get(clientIp) || 0;
        if (usedScans >= 2) {
          return {
            content: [
              {
                type: "text",
                text: `⛔ **Free Preview Limit Reached (2/2 Scans Used)**\nYou have used both of your free AdAutopsy scans on this session/IP.\n${getUpgradeCallout()}`,
              },
            ],
          };
        }
        freeTrialUsage.set(clientIp, usedScans + 1);
      }

      if (!APIFY_API_TOKEN) {
        return {
          content: [
            {
              type: "text",
              text: "Server Configuration Error: APIFY_API_TOKEN is missing inside Render Environment Variables.",
            },
          ],
        };
      }

      const targetAdLibraryUrl = search_query_or_url.startsWith("http")
        ? search_query_or_url
        : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(
            country_code.toUpperCase()
          )}&q=${encodeURIComponent(search_query_or_url)}&search_type=keyword_unordered&media_type=all`;

      try {
        const client = new ApifyClient({ token: APIFY_API_TOKEN });

        const run = await client.actor("curious_coder/facebook-ads-library-scraper").call({
          urls: [{ url: targetAdLibraryUrl }],
          maxItems: config.rawScanLimit,
          count: config.rawScanLimit,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No active Meta ads found for "${search_query_or_url}" in country "${country_code}". Try a broader brand keyword or verify the brand has active campaigns running.`,
              },
            ],
          };
        }

        const nowMs = Date.now();

        const normalizedAds = items.map((ad: any) => {
          const snapshot = ad.snapshot || {};
          const rawStart = ad.startDate || ad.start_date || snapshot.start_date || ad.startDateFormatted;

          let startTimestampMs = nowMs;
          if (typeof rawStart === "number") {
            startTimestampMs = rawStart < 1e12 ? rawStart * 1000 : rawStart;
          } else if (typeof rawStart === "string") {
            const parsed = Date.parse(rawStart);
            if (!isNaN(parsed)) startTimestampMs = parsed;
          }

          const daysRunning = Math.max(1, Math.floor((nowMs - startTimestampMs) / (1000 * 60 * 60 * 24)));

          const bodyText =
            snapshot.body?.text ||
            snapshot.body?.markup?.__html ||
            ad.bodyText ||
            ad.adText ||
            snapshot.cards?.[0]?.body ||
            "No primary ad text found";

          const cleanBody = String(bodyText).replace(/<[^>]*>?/gm, "").trim();

          const firstLines = cleanBody
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

          const openingScrollStopper = firstLines[0] || "Visual/Video Hook";
          const secondLineHook = firstLines[1] || "";
          const headlineHook =
            snapshot.title ||
            snapshot.cards?.[0]?.title ||
            ad.title ||
            "No headline hook";
          const linkDescriptionHook =
            snapshot.link_description ||
            snapshot.cards?.[0]?.link_description ||
            "";

          const landingPageUrl =
            snapshot.link_url ||
            snapshot.cards?.[0]?.link_url ||
            ad.linkUrl ||
            ad.link_url ||
            "No destination URL found";

          const ctaText =
            snapshot.cta_text ||
            snapshot.cards?.[0]?.cta_text ||
            ad.ctaText ||
            "Learn More";

          const videoPreview =
            snapshot.videos?.[0]?.video_hd_url ||
            snapshot.videos?.[0]?.video_sd_url ||
            snapshot.cards?.[0]?.video_hd_url ||
            null;

          const videoThumbnail =
            snapshot.videos?.[0]?.video_preview_image_url ||
            snapshot.cards?.[0]?.video_preview_image_url ||
            null;

          const imagePreview =
            snapshot.images?.[0]?.original_image_url ||
            snapshot.images?.[0]?.resized_image_url ||
            snapshot.cards?.[0]?.original_image_url ||
            null;

          return {
            ad_archive_id: ad.adArchiveID || ad.ad_archive_id || ad.id || "unknown",
            brand_name: ad.pageName || snapshot.page_name || "Competitor",
            days_running: daysRunning,
            start_date_iso: new Date(startTimestampMs).toISOString().split("T")[0],
            extracted_hooks: {
              three_second_opening_line: openingScrollStopper,
              secondary_hook_line: secondLineHook,
              bold_headline_hook: headlineHook,
              sub_headline_angle: linkDescriptionHook,
            },
            full_ad_script_and_copy: cleanBody.slice(0, 1500),
            cta_button_text: ctaText,
            landing_page_url: landingPageUrl,
            media_type: videoPreview ? "VIDEO" : "IMAGE",
            media_preview_url: videoPreview || imagePreview || "No media URL available",
            video_thumbnail_url: videoThumbnail,
          };
        });

        normalizedAds.sort((a, b) => b.days_running - a.days_running);

        const topWinners = normalizedAds.slice(0, config.topWinnersReturned);
        const freeUsed = freeTrialUsage.get(clientIp) || 0;

        const payload = {
          meta: {
            active_tier: config.tier,
            free_scans_used: config.tier === "FREE" ? `${freeUsed}/2` : "Unlimited (Paid Tier)",
            license_notice: licenseWarning || "Active",
            raw_ads_scanned: items.length,
            top_winners_returned: topWinners.length,
          },
          longest_running_winning_ads: topWinners,
          grok_native_execution_instructions: [
            "You MUST now act as an elite Direct-Response Creative Strategist and output the following for the user:",
            "1. WINNING AD SCORECARD: Show each winning ad with its `days_running`, `extracted_hooks` (Opening 3-Second Line + Bold Headline Hook), `media_preview_url`, and `landing_page_url`.",
            "2. HOOK & PSYCHOLOGY DECONSTRUCTION: Analyze the `full_ad_script_and_copy` and explain the exact psychological trigger (e.g., Pattern Interrupt, Us vs. Them, Secret Reveal, Pain Agitation) that kept this ad profitable for `days_running` days.",
            "3. 5 REWRITTEN 3-SECOND VIDEO HOOKS: Write 5 high-converting 3-second hooks (including both Spoken Audio Hook + Visual On-Screen Text Hook) modeled on the #1 winner.",
            "4. DETAILED SHOT-BY-SHOT VIDEO SCRIPT: Convert the #1 winning ad into a ready-to-shoot 30-to-45 second UGC/Direct-Response Video Script broken down by timestamp: [0:00-0:03 Hook], [0:03-0:10 Problem Agitation], [0:10-0:22 Product Mechanism & Demo], [0:22-0:30 Social Proof/Offer], and [0:30-0:35 CTA]. For every timestamp, specify: (a) Visual Camera Shot, (b) Spoken Dialogue Script, and (c) On-Screen Text Overlay.",
            "5. NEXT STEP HANDOFF: Ask the user if they want you to run `deconstruct_competitor_ad_landing_page` on the winner's `landing_page_url` to clone the landing page funnel next.",
          ],
          ...(config.tier === "FREE" ? { upgrade_options: getUpgradeCallout() } : {}),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error scraping Meta Ad Library via Apify: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 2: deconstruct_competitor_ad_landing_page
  // --------------------------------------------------------------------------
  server.tool(
    "deconstruct_competitor_ad_landing_page",
    "Fetches any competitor destination landing_page_url, strips scripts/styles, extracts headlines, H1/H2s, pricing anchors, guarantees, and CTAs, and returns a structured CRO & Funnel Clone Spec ready for Website Ops or Figma plugins.",
    {
      landing_page_url: z
        .string()
        .url()
        .describe("The live destination URL extracted from Tool 1 or provided by the user"),
      license_key: z
        .string()
        .optional()
        .describe("Optional Dodo Payments license key (or XAI_REVIEWER_PRO) for full funnel clone spec"),
    },
    async ({ landing_page_url, license_key }) => {
      const { config, error: licenseWarning } = await resolveUserTier(license_key);

      try {
        const response = await fetch(landing_page_url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to fetch landing page (${response.status} ${response.statusText}): ${landing_page_url}`,
              },
            ],
          };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        $("script, style, noscript, svg, iframe").remove();

        const pageTitle = $("title").first().text().trim();
        const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";

        const h1List = $("h1")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get()
          .filter(Boolean)
          .slice(0, 5);

        if (!config.fullFunnelAccess) {
          const freePreviewPayload = {
            meta: {
              active_tier: "FREE_PREVIEW",
              license_notice: licenseWarning || "Free Preview Mode (Hero Section Only)",
              landing_page_url,
            },
            hero_preview: {
              page_title: pageTitle,
              meta_description: metaDescription,
              primary_h1_hook: h1List[0] || "No H1 tag detected above the fold",
            },
            locked_sections: [
              "🔒 Full H2/H3 Subheadline Persuasion Flow",
              "🔒 Pricing Anchors & Bundle Tiers Extracted",
              "🔒 Risk-Reversal & Money-Back Guarantee Copy",
              "🔒 All CTA Button Triggers & Copy",
              "🔒 Section-by-Section Wireframe Spec for Website Ops / Figma",
            ],
            upgrade_required: getUpgradeCallout(),
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(freePreviewPayload, null, 2),
              },
            ],
          };
        }

        const h2List = $("h2")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get()
          .filter(Boolean)
          .slice(0, 15);

        const h3List = $("h3")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get()
          .filter(Boolean)
          .slice(0, 15);

        const ctaButtons = $("a, button")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get()
          .filter((txt) => txt.length > 2 && txt.length < 45)
          .filter((txt, idx, arr) => arr.indexOf(txt) === idx)
          .slice(0, 15);

        const bodyText = $("body").text().replace(/\s+/g, " ").trim();

        const priceMatches = Array.from(
          new Set(bodyText.match(/(\$\d+(?:\.\d{2})?|₹\d+(?:,\d+)*|\d+%\s*OFF|free shipping)/gi) || [])
        ).slice(0, 12);

        const sentences = bodyText.split(/(?<=[.!?])\s+/);
        const guaranteeSentences = sentences
          .filter((s) => /guarantee|money back|risk-free|refund|trial|warranty/i.test(s) && s.length < 240)
          .slice(0, 6);

        const fullFunnelPayload = {
          meta: {
            active_tier: config.tier,
            landing_page_url,
          },
          above_the_fold_hero: {
            page_title: pageTitle,
            meta_description: metaDescription,
            h1_headlines: h1List,
          },
          persuasion_architecture: {
            h2_section_headers: h2List,
            h3_supporting_points: h3List,
            detected_cta_buttons: ctaButtons,
          },
          offer_and_conversion_triggers: {
            pricing_and_discount_anchors: priceMatches,
            risk_reversal_guarantees: guaranteeSentences,
          },
          grok_native_execution_instructions: [
            "1. Map out the competitor's exact conversion flow from Ad Hook -> Hero H1 -> Social Proof -> Offer Stack -> Guarantee.",
            "2. Write a complete, section-by-section 'Funnel Clone & Improvement Spec' tailored for the user's brand.",
            "3. Format the output with clear wireframe blocks so the user can hand it directly to `Website Ops` or `figma bro` in the Grok Bot Marketplace.",
          ],
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(fullFunnelPayload, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error deconstructing landing page (${landing_page_url}): ${err.message}`,
            },
          ],
        };
      }
    }
  );

  return server;
}

// ============================================================================
// 4. LIVE SAAS PRICING WEBPAGE (FOR DODO VERIFICATION + UPTIMEROBOT) & /mcp
// ============================================================================
   app.get("/", (req: Request, res: Response) => {
     res.status(200).send(
       renderLanding({
         growth: CHECKOUT_GROWTH_URL,
         pro: CHECKOUT_PRO_URL,
         agency: CHECKOUT_AGENCY_URL,
         baseUrl: `${req.protocol}://${req.get("host")}`,
       })
     );
   });

app.get("/health-check", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    plugin: "AdAutopsy",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.all("/mcp", async (req: Request, res: Response) => {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const clientIp =
      (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : req.ip) || "unknown-ip";

    const server = createAdAutopsyMcpServer(clientIp);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("MCP Endpoint Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP Server Error", details: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ AdAutopsy MCP Server live on port ${PORT}`);
});
