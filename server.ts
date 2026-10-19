import express, { Request, Response } from "express";
import cors from "cors";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ApifyClient } from "apify-client";
import * as cheerio from "cheerio";
import { z } from "zod";
import dotenv from "dotenv";
import { renderLanding } from "./Landing.ts";

dotenv.config();

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

// ============================================================================
// 1. ENVIRONMENT VARIABLES & TIER LIMITS
// ============================================================================
const PORT = process.env.PORT || 3000;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Groq models (verified on console.groq.com/docs/model/qwen/qwen3.8-27b). Override via env if Groq renames them.
const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";
// "none" = instruct mode (no thinking tokens). Falls back to "low" automatically if Groq rejects it.
const GROQ_REASONING_EFFORT = process.env.GROQ_REASONING_EFFORT || "none";
const VISION_MAX_TOKENS = 350;
const EST_VISION_TOKENS = 1600; // ~1,150 image + ~100 prompt + output, used for the tokens/min budget

// Groq account capacity. Defaults = Groq FREE plan. Raise these after moving to the paid Developer plan.
const GROQ_VISION_RPM = Number(process.env.GROQ_VISION_RPM || 28);
const GROQ_VISION_TPM = Number(process.env.GROQ_VISION_TPM || 7500);
const GROQ_VISION_RPD = Number(process.env.GROQ_VISION_RPD || 950);
const GROQ_VISION_TPD = Number(process.env.GROQ_VISION_TPD || 190000);
const GROQ_WHISPER_RPM = Number(process.env.GROQ_WHISPER_RPM || 18);
const GROQ_WHISPER_RPD = Number(process.env.GROQ_WHISPER_RPD || 1900);
const GROQ_WHISPER_SECS_PER_DAY = Number(process.env.GROQ_WHISPER_SECS_PER_DAY || 27000);
const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // Groq free file limit is 25 MB

// Abuse protection
const FREE_SCANS_PER_KEY = 2; // lifetime free scans per client key
const FREE_GLOBAL_DAILY_SCANS = Number(process.env.FREE_GLOBAL_DAILY_SCANS || 40);
const CALLS_PER_MINUTE = Number(process.env.CALLS_PER_MINUTE || 20);
const SEARCH_TTL_MS = 60 * 60 * 1000;

// Reviewer bypass. Set REVIEWER_KEY in Render and rotate it after review.
const REVIEWER_KEY = process.env.REVIEWER_KEY || "XAI_REVIEWER_PRO";

// Optional: Discord/Slack-compatible webhook that pings YOU when a server limit is hit.
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";

// Dodo Payments
const DODO_GROWTH_PRODUCT_ID = process.env.DODO_GROWTH_PRODUCT_ID || "";
const DODO_PRO_PRODUCT_ID = process.env.DODO_PRO_PRODUCT_ID || "";
const DODO_AGENCY_PRODUCT_ID = process.env.DODO_AGENCY_PRODUCT_ID || "";
const CHECKOUT_GROWTH_URL = process.env.CHECKOUT_GROWTH_URL || "#pricing";
const CHECKOUT_PRO_URL = process.env.CHECKOUT_PRO_URL || "#pricing";
const CHECKOUT_AGENCY_URL = process.env.CHECKOUT_AGENCY_URL || "#pricing";

type TierLevel = "FREE" | "GROWTH" | "PRO" | "AGENCY";

interface TierConfig {
  tier: TierLevel;
  rawScanLimit: number; // ads shown in the pick-list per scan (billed by Apify)
  maxAnalysesPerScan: number; // ads the user may deep-analyze (audio + thumbnail) per scan
  scansPerDay: number; // 0 = free tier (lifetime limit instead)
  fullFunnelAccess: boolean;
}

const TIER_SPECS: Record<TierLevel, TierConfig> = {
  FREE: { tier: "FREE", rawScanLimit: 10, maxAnalysesPerScan: 1, scansPerDay: 0, fullFunnelAccess: false },
  GROWTH: { tier: "GROWTH", rawScanLimit: 12, maxAnalysesPerScan: 2, scansPerDay: 8, fullFunnelAccess: true },
  PRO: { tier: "PRO", rawScanLimit: 20, maxAnalysesPerScan: 3, scansPerDay: 10, fullFunnelAccess: true },
  AGENCY: { tier: "AGENCY", rawScanLimit: 30, maxAnalysesPerScan: 3, scansPerDay: 18, fullFunnelAccess: true },
};

// ============================================================================
// 2. IN-MEMORY STATE (resets when Render restarts the service)
// ============================================================================
const todayKey = () => new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resetsInText(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.ceil((next - now.getTime()) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m (resets at 00:00 UTC)`;
}

const freeScansByKey = new Map<string, number>();
const freeGlobal = { day: todayKey(), scans: 0 };
const usageByOwner = new Map<string, { day: string; scans: number }>();

function getUsage(owner: string) {
  const d = todayKey();
  let u = usageByOwner.get(owner);
  if (!u || u.day !== d) {
    u = { day: d, scans: 0 };
    usageByOwner.set(owner, u);
  }
  return u;
}

// Sliding-window limiter (supports weights, so it can budget tokens as well as requests)
class SlidingWindow {
  private events: { t: number; w: number }[] = [];
  constructor(private max: number, private windowMs: number) {}
  private prune(now: number) {
    while (this.events.length && now - this.events[0].t >= this.windowMs) this.events.shift();
  }
  waitMs(weight: number, now = Date.now()): number {
    this.prune(now);
    const used = this.events.reduce((s, e) => s + e.w, 0);
    if (used + weight <= this.max) return 0;
    const need = used + weight - this.max;
    let freed = 0;
    for (const e of this.events) {
      freed += e.w;
      if (freed >= need) return e.t + this.windowMs - now;
    }
    return this.windowMs;
  }
  record(weight: number) {
    this.events.push({ t: Date.now(), w: weight });
  }
}

// Waits (up to maxWaitMs) for room in every window. Returns 0 on success, or ms the caller should retry after.
async function acquire(windows: [SlidingWindow, number][], maxWaitMs = 25000): Promise<number> {
  const deadline = Date.now() + maxWaitMs;
  while (true) {
    const wait = Math.max(...windows.map(([w, wt]) => w.waitMs(wt)));
    if (wait === 0) {
      windows.forEach(([w, wt]) => w.record(wt));
      return 0;
    }
    if (Date.now() + wait > deadline) return wait;
    await sleep(wait + 50);
  }
}

const visionRpm = new SlidingWindow(GROQ_VISION_RPM, 60000);
const visionTpm = new SlidingWindow(GROQ_VISION_TPM, 60000);
const whisperRpm = new SlidingWindow(GROQ_WHISPER_RPM, 60000);

const groqDay = { day: todayKey(), visionReq: 0, visionTokens: 0, whisperReq: 0, whisperSecs: 0 };
function rollGroqDay() {
  if (groqDay.day !== todayKey()) {
    Object.assign(groqDay, { day: todayKey(), visionReq: 0, visionTokens: 0, whisperReq: 0, whisperSecs: 0 });
  }
  if (freeGlobal.day !== todayKey()) Object.assign(freeGlobal, { day: todayKey(), scans: 0 });
}
function groqCapacity() {
  rollGroqDay();
  return {
    vision: groqDay.visionReq < GROQ_VISION_RPD && groqDay.visionTokens < GROQ_VISION_TPD,
    whisper: groqDay.whisperReq < GROQ_WHISPER_RPD && groqDay.whisperSecs < GROQ_WHISPER_SECS_PER_DAY,
  };
}

// Per-caller burst limiter
const callWindows = new Map<string, SlidingWindow>();
function burstLimited(key: string): number {
  let w = callWindows.get(key);
  if (!w) {
    w = new SlidingWindow(CALLS_PER_MINUTE, 60000);
    callWindows.set(key, w);
  }
  const wait = w.waitMs(1);
  if (wait > 0) return Math.ceil(wait / 1000);
  w.record(1);
  return 0;
}

// Owner alerts (max one ping per alert type per hour)
const lastAlert = new Map<string, number>();
async function notifyOwner(kind: string, message: string) {
  console.warn(`[ALERT:${kind}] ${message}`);
  if (!ALERT_WEBHOOK_URL) return;
  const last = lastAlert.get(kind) || 0;
  if (Date.now() - last < 60 * 60 * 1000) return;
  lastAlert.set(kind, Date.now());
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `AdAutopsy: ${message}`, text: `AdAutopsy: ${message}` }),
    });
  } catch {}
}

// Search results cached so the user can pick ads from the list
interface NormalizedAd {
  number: number;
  ad_archive_id: string;
  brand_name: string;
  days_running: number;
  start_date_iso: string;
  opening_line: string;
  second_line: string;
  headline: string;
  sub_headline: string;
  full_copy: string;
  cta: string;
  landing_page_url: string;
  media_type: "VIDEO" | "IMAGE";
  media_preview_url: string;
  thumbnail_url: string | null;
  video_audio_url: string | null;
  analysis?: any;
}
interface SearchEntry {
  createdAt: number;
  owner: string;
  config: TierConfig;
  query: string;
  ads: NormalizedAd[];
}
const searches = new Map<string, SearchEntry>();
function pruneSearches() {
  const now = Date.now();
  for (const [id, s] of searches) if (now - s.createdAt > SEARCH_TTL_MS) searches.delete(id);
  while (searches.size > 500) searches.delete(searches.keys().next().value as string);
}

// ============================================================================
// 3. LICENSE VALIDATION
// ============================================================================
async function resolveUserTier(
  licenseKey: string | undefined,
  clientKey: string
): Promise<{ config: TierConfig; owner: string; error?: string }> {
  const cleanKey = licenseKey?.trim();
  const freeOwner = `free:${clientKey}`;

  if (!cleanKey) return { config: TIER_SPECS.FREE, owner: freeOwner };

  if (cleanKey === REVIEWER_KEY) {
    return { config: TIER_SPECS.AGENCY, owner: "lic:reviewer" };
  }

  const owner = "lic:" + crypto.createHash("sha256").update(cleanKey).digest("hex").slice(0, 16);

  try {
    const response = await fetch("https://live.dodopayments.com/licenses/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: cleanKey }),
    });

    if (!response.ok) {
      return { config: TIER_SPECS.FREE, owner: freeOwner, error: "Invalid or expired license key. Falling back to Free Preview Tier." };
    }

    const data: any = await response.json();
    const isValid = data.valid === true || data.status === "active" || data.is_valid === true;
    if (!isValid) {
      return { config: TIER_SPECS.FREE, owner: freeOwner, error: "License key is inactive. Falling back to Free Preview Tier." };
    }

    const productId = data.product_id || data.product?.id || "";
    if (productId && productId === DODO_AGENCY_PRODUCT_ID) return { config: TIER_SPECS.AGENCY, owner };
    if (productId && productId === DODO_PRO_PRODUCT_ID) return { config: TIER_SPECS.PRO, owner };
    return { config: TIER_SPECS.GROWTH, owner };
  } catch (err: any) {
    console.error("Dodo validation error:", err.message);
    return { config: TIER_SPECS.FREE, owner: freeOwner, error: "Could not reach license server. Falling back to Free Preview Tier." };
  }
}

function getUpgradeCallout(): string {
  return `
---
🚀 **UPGRADE AdAutopsy FOR FULL ACCESS**
• **Growth ($14.99/mo)**: 8 scans/day, 12 ads per scan, deep-analyze 2 ads per scan (spoken audio + thumbnail) + Full Landing Page Deconstructor -> ${CHECKOUT_GROWTH_URL}
• **Pro ($29.99/mo)**: 10 scans/day, 20 ads per scan, deep-analyze 3 ads per scan + Full Landing Page Deconstructor -> ${CHECKOUT_PRO_URL}
• **Agency ($69.99/mo)**: 18 scans/day, 30 ads per scan, deep-analyze 3 ads per scan + 5 Team Activations -> ${CHECKOUT_AGENCY_URL}
*(After checkout, pass your Dodo License Key in your prompt to unlock instantly!)*`;
}

// ============================================================================
// 4. SAFE FETCH (blocks requests to private/internal addresses)
// ============================================================================
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") ||
    l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.") || l.startsWith("::ffff:169.254.");
}

async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http/https URLs are allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("URL points to a private or internal address");
}

async function safeFetch(url: string, init: RequestInit = {}, maxRedirects = 3): Promise<globalThis.Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

// ============================================================================
// 5. GROQ: AUDIO TRANSCRIPTION + THUMBNAIL VISION
// ============================================================================
class BusyError extends Error {
  constructor(public retryMs: number) {
    super("busy");
  }
}

async function groqPost(path: string, body: any, json = false): Promise<globalThis.Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(GROQ_BASE + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, ...(json ? { "Content-Type": "application/json" } : {}) },
      body,
      signal: AbortSignal.timeout(60000),
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after") || 5);
      if (attempt === 0 && ra <= 20) {
        await sleep(ra * 1000 + 200);
        continue;
      }
      throw new BusyError(ra * 1000);
    }
    return res;
  }
  throw new BusyError(10000);
}

async function transcribeAd(videoUrl: string) {
  const wait = await acquire([[whisperRpm, 1]]);
  if (wait) throw new BusyError(wait);

  const dl = await safeFetch(videoUrl, {
    headers: { Range: `bytes=0-${MAX_AUDIO_BYTES - 1}` },
    signal: AbortSignal.timeout(30000),
  });
  if (dl.status !== 200 && dl.status !== 206) throw new Error(`video download failed (${dl.status})`);
  const len = Number(dl.headers.get("content-length") || 0);
  if (dl.status === 200 && len > MAX_AUDIO_BYTES * 2) {
    await dl.body?.cancel();
    throw new Error("video too large to transcribe");
  }
  const buf = Buffer.from(await dl.arrayBuffer()).subarray(0, MAX_AUDIO_BYTES);

  const form = new FormData();
  form.append("file", new Blob([buf], { type: "video/mp4" }), "ad.mp4");
  form.append("model", GROQ_WHISPER_MODEL);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");

  const res = await groqPost("/audio/transcriptions", form);
  if (!res.ok) throw new Error(`Groq whisper error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();

  rollGroqDay();
  groqDay.whisperReq++;
  groqDay.whisperSecs += Number(data.duration || 30);

  const text = String(data.text || "").trim();
  const segs: any[] = Array.isArray(data.segments) ? data.segments : [];
  const first3 = segs.filter((s) => Number(s.start) < 3).map((s) => String(s.text).trim()).join(" ").trim() ||
    text.split(/\s+/).slice(0, 12).join(" ");

  return {
    full_text: text || "No speech detected (music-only or text-only ad)",
    spoken_hook_first_3_seconds: text ? first3 : "",
    language: data.language || null,
    audio_seconds: Math.round(Number(data.duration || 0)),
  };
}

const VISION_PROMPT =
  "You are analyzing the thumbnail of a Meta (Facebook/Instagram) ad. In under 120 words, give terse labeled lines: " +
  "VISUAL HOOK (what stops the scroll), ON-SCREEN TEXT (verbatim), PEOPLE/PRODUCT, STYLE (UGC, studio, screen recording, etc.), " +
  "EMOTION/TRIGGER, COLOR & COMPOSITION. No preamble.";

async function toDataUrl(url: string): Promise<string> {
  const r = await safeFetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`image download failed (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) throw new Error("image too large");
  return `data:${r.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}`;
}

async function analyzeThumbnail(imageUrl: string): Promise<string> {
  const wait = await acquire([[visionRpm, 1], [visionTpm, EST_VISION_TOKENS]]);
  if (wait) throw new BusyError(wait);

  const build = (img: string, effort?: string) =>
    JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url: img } }] }],
      max_tokens: VISION_MAX_TOKENS,
      temperature: 0.3,
      ...(effort ? { reasoning_effort: effort } : {}),
    });

  let res = await groqPost("/chat/completions", build(imageUrl, GROQ_REASONING_EFFORT), true);
  if (res.status === 400) {
    const t = await res.text();
    if (/reasoning/i.test(t)) {
      res = await groqPost("/chat/completions", build(imageUrl, "low"), true);
    } else if (/image|url/i.test(t)) {
      res = await groqPost("/chat/completions", build(await toDataUrl(imageUrl), GROQ_REASONING_EFFORT), true);
    } else {
      throw new Error(`Groq vision 400: ${t.slice(0, 200)}`);
    }
  }
  if (!res.ok) throw new Error(`Groq vision error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data: any = await res.json();
  rollGroqDay();
  groqDay.visionReq++;
  groqDay.visionTokens += Number(data.usage?.total_tokens || EST_VISION_TOKENS);

  const out = String(data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!out) throw new Error("empty vision response");
  return out;
}

async function analyzeAd(ad: NormalizedAd, caps: { vision: boolean; whisper: boolean }) {
  const notes: string[] = [];
  const noteFor = (label: string, e: any) =>
    notes.push(e instanceof BusyError
      ? `${label} skipped: AI service busy, retry in ~${Math.ceil(e.retryMs / 1000)}s.`
      : `${label} failed: ${e.message}`);

  const visualP =
    ad.thumbnail_url && caps.vision
      ? analyzeThumbnail(ad.thumbnail_url).catch((e) => (noteFor("Thumbnail analysis", e), null))
      : Promise.resolve(null);

  const audioP =
    ad.media_type === "VIDEO" && ad.video_audio_url && caps.whisper
      ? transcribeAd(ad.video_audio_url).catch((e) => (noteFor("Audio transcription", e), null))
      : Promise.resolve(null);

  if (!ad.thumbnail_url) notes.push("No thumbnail available for visual analysis.");
  if (ad.media_type === "IMAGE") notes.push("Image ad: no audio to transcribe.");
  if (!caps.vision && ad.thumbnail_url) notes.push("Thumbnail analysis skipped: daily AI capacity reached.");
  if (!caps.whisper && ad.media_type === "VIDEO") notes.push("Audio transcription skipped: daily AI capacity reached.");

  const [visual, audio] = await Promise.all([visualP, audioP]);
  return { ok: Boolean(visual || audio), result: { visual_analysis: visual, spoken_transcript: audio, analysis_notes: notes } };
}

// ============================================================================
// 6. HELPERS: normalize ads, limit replies
// ============================================================================
function normalizeAd(ad: any, nowMs: number): Omit<NormalizedAd, "number"> {
  const snapshot = ad.snapshot || {};
  const rawStart = ad.startDate || ad.start_date || snapshot.start_date || ad.startDateFormatted;

  let startMs = nowMs;
  if (typeof rawStart === "number") startMs = rawStart < 1e12 ? rawStart * 1000 : rawStart;
  else if (typeof rawStart === "string") {
    const parsed = Date.parse(rawStart);
    if (!isNaN(parsed)) startMs = parsed;
  }

  const bodyText =
    snapshot.body?.text || snapshot.body?.markup?.__html || ad.bodyText || ad.adText || snapshot.cards?.[0]?.body || "No primary ad text found";
  const cleanBody = String(bodyText).replace(/<[^>]*>?/gm, "").trim();
  const lines = cleanBody.split("\n").map((l) => l.trim()).filter(Boolean);

  const sd = snapshot.videos?.[0]?.video_sd_url || null;
  const hd = snapshot.videos?.[0]?.video_hd_url || snapshot.cards?.[0]?.video_hd_url || null;
  const videoPreview = hd || sd;
  const videoThumb = snapshot.videos?.[0]?.video_preview_image_url || snapshot.cards?.[0]?.video_preview_image_url || null;
  const imagePreview =
    snapshot.images?.[0]?.original_image_url || snapshot.images?.[0]?.resized_image_url || snapshot.cards?.[0]?.original_image_url || null;

  return {
    ad_archive_id: String(ad.adArchiveID || ad.ad_archive_id || ad.id || "unknown"),
    brand_name: ad.pageName || snapshot.page_name || "Competitor",
    days_running: Math.max(1, Math.floor((nowMs - startMs) / 86400000)),
    start_date_iso: new Date(startMs).toISOString().split("T")[0],
    opening_line: lines[0] || "Visual/Video Hook",
    second_line: lines[1] || "",
    headline: snapshot.title || snapshot.cards?.[0]?.title || ad.title || "No headline hook",
    sub_headline: snapshot.link_description || snapshot.cards?.[0]?.link_description || "",
    full_copy: cleanBody.slice(0, 1500),
    cta: snapshot.cta_text || snapshot.cards?.[0]?.cta_text || ad.ctaText || "Learn More",
    landing_page_url: snapshot.link_url || snapshot.cards?.[0]?.link_url || ad.linkUrl || ad.link_url || "No destination URL found",
    media_type: videoPreview ? "VIDEO" : "IMAGE",
    media_preview_url: videoPreview || imagePreview || "No media URL available",
    thumbnail_url: videoThumb || imagePreview || null,
    video_audio_url: sd || hd, // SD is smaller, so it stays under the 25 MB audio limit
  };
}

const reply = (text: string) => ({ content: [{ type: "text" as const, text }] });

function rateLimitReply(seconds: number) {
  return reply(
    `⏱️ **Slow down a little**\nToo many AdAutopsy requests in the last minute. Please wait about ${seconds} seconds and try again.`
  );
}

function dailyLimitReply(config: TierConfig) {
  return reply(
    `⛔ **Daily scan limit reached (${config.scansPerDay}/${config.scansPerDay} on ${config.tier})**\n` +
      `Your scans reset in ${resetsInText()}. You can still analyze ads from scans you already ran today by calling analyze_selected_ads with the same search_id.` +
      (config.tier !== "AGENCY" ? `\n${getUpgradeCallout()}` : "")
  );
}

// ============================================================================
// 7. MCP SERVER FACTORY (TOOLS 1, 2 & 3)
// ============================================================================
function createAdAutopsyMcpServer(clientKey: string) {
  const server = new McpServer({ name: "AdAutopsy", version: "2.0.0" });

  // --------------------------------------------------------------------------
  // TOOL 1: find_winning_ads  (scrape + ranked pick-list, no AI cost)
  // --------------------------------------------------------------------------
  server.tool(
    "find_winning_ads",
    "STEP 1. Searches the Meta Ad Library for a brand or keyword and returns a numbered list of the longest-running ads (longest running = most likely profitable), with opening line, headline, thumbnail, media type and landing page. Does NOT analyze anything yet: show the list to the user and let THEM choose which ads to analyze with analyze_selected_ads.",
    {
      search_query_or_url: z.string().describe("Brand keyword (e.g., 'AG1', 'Ridge Wallet') OR a full Facebook Ad Library URL"),
      country_code: z.string().default("US").describe("2-letter ISO country code (e.g., 'US', 'IN', 'GB', 'ALL')"),
      license_key: z.string().optional().describe("Optional Dodo Payments license key"),
    },
    async ({ search_query_or_url, country_code, license_key }) => {
      const { config, owner, error: licenseWarning } = await resolveUserTier(license_key, clientKey);

      const burst = burstLimited(owner);
      if (burst) return rateLimitReply(burst);

      if (!APIFY_API_TOKEN) return reply("Server Configuration Error: APIFY_API_TOKEN is missing inside Render Environment Variables.");

      // Reserve one scan (refunded below if the scrape fails or finds nothing)
      rollGroqDay();
      if (config.tier === "FREE") {
        const used = freeScansByKey.get(clientKey) || 0;
        if (used >= FREE_SCANS_PER_KEY) {
          return reply(
            `⛔ **Free Preview Limit Reached (${FREE_SCANS_PER_KEY}/${FREE_SCANS_PER_KEY} Scans Used)**\nYou have used both free AdAutopsy scans.\n${getUpgradeCallout()}`
          );
        }
        if (freeGlobal.scans >= FREE_GLOBAL_DAILY_SCANS) {
          notifyOwner("free-cap", `Free preview daily cap reached (${FREE_GLOBAL_DAILY_SCANS} scans).`);
          return reply(
            `🚧 **Free previews are full for today**\nAdAutopsy has hit its daily free-preview capacity. Try again in ${resetsInText()}, or unlock instantly with a paid plan.\n${getUpgradeCallout()}`
          );
        }
        freeScansByKey.set(clientKey, used + 1);
        freeGlobal.scans++;
      } else {
        const u = getUsage(owner);
        if (u.scans >= config.scansPerDay) return dailyLimitReply(config);
        u.scans++;
      }
      const refund = () => {
        if (config.tier === "FREE") {
          freeScansByKey.set(clientKey, Math.max(0, (freeScansByKey.get(clientKey) || 1) - 1));
          freeGlobal.scans = Math.max(0, freeGlobal.scans - 1);
        } else {
          const u = getUsage(owner);
          u.scans = Math.max(0, u.scans - 1);
        }
      };

      const targetAdLibraryUrl = search_query_or_url.startsWith("http")
        ? search_query_or_url
        : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(
            country_code.toUpperCase()
          )}&q=${encodeURIComponent(search_query_or_url)}&search_type=keyword_unordered&media_type=all`;

      try {
        const client = new ApifyClient({ token: APIFY_API_TOKEN });
        const run = await client.actor("curious_coder/facebook-ads-library-scraper").call(
          { urls: [{ url: targetAdLibraryUrl }], maxItems: config.rawScanLimit, count: config.rawScanLimit },
          { waitSecs: 100 }
        );

        if (run.status !== "SUCCEEDED") {
          refund();
          return reply(`The ad scrape did not finish in time (status: ${run.status}). Your scan was not counted. Please try again.`);
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        if (!items || items.length === 0) {
          refund();
          return reply(
            `No active Meta ads found for "${search_query_or_url}" in country "${country_code}". Your scan was not counted. Try a broader brand keyword or verify the brand has active campaigns running.`
          );
        }

        const nowMs = Date.now();
        const ads: NormalizedAd[] = items
          .slice(0, config.rawScanLimit)
          .map((ad: any) => normalizeAd(ad, nowMs))
          .sort((a, b) => b.days_running - a.days_running)
          .map((a, i) => ({ ...a, number: i + 1 }));

        pruneSearches();
        const searchId = crypto.randomBytes(5).toString("hex");
        searches.set(searchId, { createdAt: Date.now(), owner, config, query: search_query_or_url, ads });

        const scansLeft =
          config.tier === "FREE"
            ? `${Math.max(0, FREE_SCANS_PER_KEY - (freeScansByKey.get(clientKey) || 0))} free scans left (lifetime)`
            : `${Math.max(0, config.scansPerDay - getUsage(owner).scans)} of ${config.scansPerDay} scans left today (resets in ${resetsInText()})`;

        const payload = {
          meta: {
            search_id: searchId,
            active_tier: config.tier,
            license_notice: licenseWarning || "Active",
            ads_found: ads.length,
            scans_remaining: scansLeft,
            max_ads_you_can_analyze_from_this_list: config.maxAnalysesPerScan,
            list_valid_for: "60 minutes",
          },
          ranked_ads_longest_running_first: ads.map((a) => ({
            number: a.number,
            brand_name: a.brand_name,
            days_running: a.days_running,
            start_date: a.start_date_iso,
            media_type: a.media_type,
            opening_line: a.opening_line,
            headline: a.headline,
            copy_preview: a.full_copy.slice(0, 240),
            cta_button: a.cta,
            landing_page_url: a.landing_page_url,
            thumbnail_url: a.thumbnail_url,
          })),
          grok_native_execution_instructions: [
            "STOP. Do NOT analyze or rewrite anything yet. The user chooses which ads to analyze.",
            "1. Show the ranked list as a clean numbered table: #, brand, days running, media type, opening line, headline, thumbnail_url (as an image if you can).",
            `2. Tell the user they can pick up to ${config.maxAnalysesPerScan} ad(s) from this list for a deep analysis (spoken-audio transcript + thumbnail breakdown). Point out that higher days_running usually means a more profitable ad, but let them decide.`,
            "3. When the user picks, call `analyze_selected_ads` with this search_id and the chosen ad numbers. Never choose for the user unless they explicitly say 'you pick'.",
          ],
          ...(config.tier === "FREE" ? { upgrade_options: getUpgradeCallout() } : {}),
        };

        return reply(JSON.stringify(payload, null, 2));
      } catch (err: any) {
        refund();
        return reply(`Error scraping Meta Ad Library via Apify: ${err.message}. Your scan was not counted.`);
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 2: analyze_selected_ads  (Groq whisper + qwen vision on the user's picks)
  // --------------------------------------------------------------------------
  server.tool(
    "analyze_selected_ads",
    "STEP 2. Deep-analyzes the ads the USER picked from find_winning_ads: transcribes the spoken audio of video ads (what the person actually says in the first 3 seconds and beyond) and analyzes the thumbnail visually. Then use the results to rewrite hooks and write a shot-by-shot video script.",
    {
      search_id: z.string().describe("The search_id returned by find_winning_ads"),
      ad_numbers: z.array(z.number().int().min(1)).min(1).max(10).describe("Ad numbers the user chose from the list, e.g. [1, 4]"),
    },
    async ({ search_id, ad_numbers }) => {
      const entry = searches.get(search_id);
      if (!entry || Date.now() - entry.createdAt > SEARCH_TTL_MS) {
        return reply("That search has expired or doesn't exist. Please run `find_winning_ads` again (this counts as a new scan).");
      }

      const burst = burstLimited(entry.owner);
      if (burst) return rateLimitReply(burst);

      if (!GROQ_API_KEY) return reply("Server Configuration Error: GROQ_API_KEY is missing inside Render Environment Variables.");

      const { config } = entry;
      const picked = [...new Set(ad_numbers)];
      const missing = picked.filter((n) => !entry.ads.some((a) => a.number === n));
      if (missing.length) {
        return reply(`Ad number(s) ${missing.join(", ")} are not in this list. Valid numbers are 1 to ${entry.ads.length}.`);
      }

      const targets = picked.map((n) => entry.ads.find((a) => a.number === n)!);
      const alreadyDone = entry.ads.filter((a) => a.analysis).length;
      const newTargets = targets.filter((a) => !a.analysis);

      if (alreadyDone + newTargets.length > config.maxAnalysesPerScan) {
        const left = Math.max(0, config.maxAnalysesPerScan - alreadyDone);
        return reply(
          `⛔ **Deep-analysis limit for this scan: ${config.maxAnalysesPerScan} ads on ${config.tier}**\n` +
            `You've used ${alreadyDone}, so you can pick ${left} more from this list. Ask the user to narrow their selection, or run a new scan.` +
            (config.tier !== "AGENCY" ? `\n${getUpgradeCallout()}` : "")
        );
      }

      const caps = groqCapacity();
      if (newTargets.length && !caps.vision && !caps.whisper) {
        notifyOwner("groq-cap", "Groq daily capacity reached for BOTH vision and whisper. Deep analysis is paused until 00:00 UTC.");
        return reply(
          `🚧 **AdAutopsy deep analysis is at capacity for today**\nOur AI processing limit has been reached. Your selection was NOT counted against your plan. Try again in ${resetsInText()}.\n` +
            `Meanwhile, you can still rewrite hooks from the text data returned by find_winning_ads.`
        );
      }
      if (newTargets.length && (!caps.vision || !caps.whisper)) {
        notifyOwner("groq-cap-partial", `Groq daily capacity reached for ${!caps.vision ? "VISION" : "WHISPER"}.`);
      }

      const results = await Promise.all(
        newTargets.map(async (ad) => {
          const r = await analyzeAd(ad, caps);
          if (r.ok) ad.analysis = r.result; // only counts toward the limit if something succeeded
          return { ad, r };
        })
      );

      const failedAll = results.filter((x) => !x.r.ok);
      const analyzed = targets.map((ad) => {
        const a = ad.analysis || results.find((x) => x.ad === ad)?.r.result || null;
        return {
          number: ad.number,
          brand_name: ad.brand_name,
          days_running: ad.days_running,
          start_date: ad.start_date_iso,
          media_type: ad.media_type,
          extracted_hooks: {
            three_second_opening_line: ad.opening_line,
            secondary_hook_line: ad.second_line,
            bold_headline_hook: ad.headline,
            sub_headline_angle: ad.sub_headline,
          },
          full_ad_script_and_copy: ad.full_copy,
          cta_button_text: ad.cta,
          landing_page_url: ad.landing_page_url,
          media_preview_url: ad.media_preview_url,
          thumbnail_url: ad.thumbnail_url,
          spoken_transcript: a?.spoken_transcript ?? null,
          visual_analysis: a?.visual_analysis ?? null,
          analysis_notes: a?.analysis_notes ?? [],
        };
      });

      const used = entry.ads.filter((x) => x.analysis).length;
      const payload = {
        meta: {
          search_id,
          active_tier: config.tier,
          deep_analyses_used_for_this_scan: `${used}/${config.maxAnalysesPerScan}`,
          not_counted_because_all_analysis_failed: failedAll.map((x) => x.ad.number),
        },
        analyzed_ads: analyzed,
        grok_native_execution_instructions: [
          "You MUST now act as an elite Direct-Response Creative Strategist. Use `spoken_transcript` (what is actually said) and `visual_analysis` (what is seen) together with the ad copy. If a field is null, check `analysis_notes`, tell the user what was missing and why, and continue with the data you have.",
          "1. WINNING AD SCORECARD: For each analyzed ad show `days_running`, the opening line, the spoken first-3-seconds hook, the bold headline, `media_preview_url`, and `landing_page_url`.",
          "2. HOOK & PSYCHOLOGY DECONSTRUCTION: Explain the exact psychological trigger (e.g., Pattern Interrupt, Us vs. Them, Secret Reveal, Pain Agitation) that kept each ad profitable for `days_running` days, citing the spoken words and the visual hook.",
          "3. 5 REWRITTEN 3-SECOND VIDEO HOOKS: Write 5 high-converting hooks (Spoken Audio Hook + Visual On-Screen Text Hook each), modeled on the longest-running selected ad. If several ads were selected, ask which one to model, or default to the highest `days_running`.",
          "4. DETAILED SHOT-BY-SHOT VIDEO SCRIPT: Turn that ad into a ready-to-shoot 30-to-45 second UGC/Direct-Response script by timestamp: [0:00-0:03 Hook], [0:03-0:10 Problem Agitation], [0:10-0:22 Product Mechanism & Demo], [0:22-0:30 Social Proof/Offer], [0:30-0:35 CTA]. For every timestamp give (a) Visual Camera Shot, (b) Spoken Dialogue Script, (c) On-Screen Text Overlay.",
          "5. NEXT STEP HANDOFF: Ask if they want `deconstruct_competitor_ad_landing_page` run on the winner's `landing_page_url`, or want to analyze another ad from this list.",
        ],
      };

      return reply(JSON.stringify(payload, null, 2));
    }
  );

  // --------------------------------------------------------------------------
  // TOOL 3: deconstruct_competitor_ad_landing_page
  // --------------------------------------------------------------------------
  server.tool(
    "deconstruct_competitor_ad_landing_page",
    "Fetches a competitor destination landing_page_url, strips scripts/styles, extracts headlines, H1/H2s, pricing anchors, guarantees, and CTAs, and returns a structured CRO & Funnel Clone Spec ready for Website Ops or Figma plugins.",
    {
      landing_page_url: z.string().url().describe("The live destination URL from find_winning_ads / analyze_selected_ads, or provided by the user"),
      license_key: z.string().optional().describe("Optional Dodo Payments license key for the full funnel clone spec"),
    },
    async ({ landing_page_url, license_key }) => {
      const { config, owner, error: licenseWarning } = await resolveUserTier(license_key, clientKey);

      const burst = burstLimited(owner);
      if (burst) return rateLimitReply(burst);

      try {
        const response = await safeFetch(landing_page_url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          return reply(`Failed to fetch landing page (${response.status} ${response.statusText}): ${landing_page_url}`);
        }

        const html = (await response.text()).slice(0, 2_000_000);
        const $ = cheerio.load(html);
        $("script, style, noscript, svg, iframe").remove();

        const pageTitle = $("title").first().text().trim();
        const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";
        const clean = (_: number, el: any) => $(el).text().replace(/\s+/g, " ").trim();

        const h1List = $("h1").map(clean).get().filter(Boolean).slice(0, 5);

        if (!config.fullFunnelAccess) {
          return reply(
            JSON.stringify(
              {
                meta: { active_tier: "FREE_PREVIEW", license_notice: licenseWarning || "Free Preview Mode (Hero Section Only)", landing_page_url },
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
              },
              null,
              2
            )
          );
        }

        const h2List = $("h2").map(clean).get().filter(Boolean).slice(0, 15);
        const h3List = $("h3").map(clean).get().filter(Boolean).slice(0, 15);
        const ctaButtons = $("a, button")
          .map(clean)
          .get()
          .filter((txt) => txt.length > 2 && txt.length < 45)
          .filter((txt, idx, arr) => arr.indexOf(txt) === idx)
          .slice(0, 15);

        const bodyText = $("body").text().replace(/\s+/g, " ").trim();
        const priceMatches = Array.from(
          new Set(bodyText.match(/(\$\d+(?:\.\d{2})?|₹\d+(?:,\d+)*|\d+%\s*OFF|free shipping)/gi) || [])
        ).slice(0, 12);
        const guaranteeSentences = bodyText
          .split(/(?<=[.!?])\s+/)
          .filter((s) => /guarantee|money back|risk-free|refund|trial|warranty/i.test(s) && s.length < 240)
          .slice(0, 6);

        return reply(
          JSON.stringify(
            {
              meta: { active_tier: config.tier, landing_page_url },
              above_the_fold_hero: { page_title: pageTitle, meta_description: metaDescription, h1_headlines: h1List },
              persuasion_architecture: { h2_section_headers: h2List, h3_supporting_points: h3List, detected_cta_buttons: ctaButtons },
              offer_and_conversion_triggers: { pricing_and_discount_anchors: priceMatches, risk_reversal_guarantees: guaranteeSentences },
              grok_native_execution_instructions: [
                "1. Map out the competitor's exact conversion flow from Ad Hook -> Hero H1 -> Social Proof -> Offer Stack -> Guarantee.",
                "2. Write a complete, section-by-section 'Funnel Clone & Improvement Spec' tailored for the user's brand.",
                "3. Format the output with clear wireframe blocks so the user can hand it directly to `Website Ops` or `figma bro` in the Grok Bot Marketplace.",
              ],
            },
            null,
            2
          )
        );
      } catch (err: any) {
        return reply(`Error deconstructing landing page (${landing_page_url}): ${err.message}`);
      }
    }
  );

  return server;
}

// ============================================================================
// 8. ROUTES: LANDING PAGE, HEALTH CHECK, /mcp
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
  rollGroqDay();
  res.status(200).json({
    status: "healthy",
    plugin: "AdAutopsy",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    groq_configured: Boolean(GROQ_API_KEY),
    apify_configured: Boolean(APIFY_API_TOKEN),
  });
});

app.all("/mcp", async (req: Request, res: Response) => {
  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : req.ip) || "unknown-ip";
    const sessionId = req.headers["mcp-session-id"];
    const clientKey = typeof sessionId === "string" ? `${ip}:${sessionId}` : ip;

    const server = createAdAutopsyMcpServer(clientKey);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

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
