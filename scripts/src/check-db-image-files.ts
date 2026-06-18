// Maintenance check: catch broken images referenced by the database.
//
// Two classes of stored image URLs are validated:
//
//   1. Locally hosted images under the optimized prefixes (/regions/,
//      /landmarks/). The filesystem-only test
//      (artifacts/geo-quiz/src/image-variants.test.ts) verifies that every
//      SOURCE image on disk has its pre-generated responsive siblings. It does
//      NOT verify the reverse: that the image URLs actually stored in the
//      database point at files that exist. An admin can save a URL under those
//      prefixes with no underlying source file (or missing responsive
//      variants). Because a <picture> does not fall back to its <img> when a
//      chosen <source> 404s, this renders a broken image with no fallback.
//
//   2. External / CDN image URLs (anything served over http(s) that is not a
//      locally hosted optimized path). Admins can paste any URL through the
//      admin UI; those links are never validated, so a broken external image
//      can render on the public site indefinitely. This script issues a bounded
//      network request and flags URLs that are not reachable as an image.
//
// It is a maintenance/admin script (not a CI test) because the api-server test
// suite runs against a mocked database, so real DB access in CI is impractical.
// Run it against a real database (dev or production) with DATABASE_URL set:
//
//   pnpm --filter @workspace/scripts run check-db-image-files
//
// Exit code is non-zero when any referenced local file is missing or any
// external URL is genuinely broken (e.g. 404 / non-image), so it can also be
// wired into a scheduled job or pre-deploy gate that has DB access. Transient
// network failures (timeouts, DNS errors, 5xx, 429) are reported as warnings
// but do NOT fail the run, so a flaky CDN or network blip cannot block a deploy.
//
// Alerting: a non-zero exit only surfaces in the Replit Deployments pane when
// someone looks. Admins edit image URLs through the live admin UI between
// deploys, so a newly-broken image can sit in production unnoticed. When
// genuinely broken images are found (NOT transient failures), this script
// notifies through two independent, best-effort channels:
//
//   1. A configurable webhook (set BROKEN_IMAGE_ALERT_WEBHOOK_URL). The payload
//      includes a Slack-compatible `text` summary plus a structured `broken`
//      array (source#id -> url + reason).
//   2. A direct email summary, sent through the Replit-managed Gmail
//      integration (the `google-mail` connector). The recipient defaults to
//      worldgeographytrivia@gmail.com and can be overridden with
//      BROKEN_IMAGE_ALERT_EMAIL_TO. Email is sent only when the Gmail
//      integration is connected (credentials available from the Replit
//      connectors proxy); otherwise it is a no-op.
//
// Both channels are best-effort: when unconfigured they are a no-op, and a
// delivery failure is logged but never changes the run's success/exit code.
// Only genuinely broken images notify — transient failures never do.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNotNull } from "drizzle-orm";
import {
  db,
  pool,
  questionsTable,
  categoriesTable,
  coursesTable,
} from "@workspace/db";
import { RESPONSIVE_IMAGE_WIDTHS } from "@workspace/image-config";
import {
  checkExternalImageUrl,
  isExternalImageUrl,
  mapWithConcurrency,
  EXTERNAL_CONCURRENCY,
} from "@workspace/image-check";

// Keep these in sync with ResponsiveImage.tsx / ssr-pages.ts: only locally
// hosted images under these prefixes have pre-generated responsive variants.
const OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];
const OPTIMIZED_FORMATS = ["webp", "avif"] as const;

// Optional webhook to alert when broken images are found. Slack incoming
// webhooks and generic JSON webhooks both work (Slack reads `text`, ignores the
// extra fields). When unset, alerting is a no-op.
const ALERT_WEBHOOK_URL = process.env.BROKEN_IMAGE_ALERT_WEBHOOK_URL?.trim();
const ALERT_TIMEOUT_MS = 10_000;
// Cap the number of rows enumerated in the alert text so a large batch cannot
// produce an oversized payload; the full list is always in the run logs.
const ALERT_MAX_ROWS = 50;

// Email alerting via the Replit-managed Gmail integration (the `google-mail`
// connector). The recipient defaults to the shared inbox noted for contact-form
// delivery and can be overridden per environment.
const GMAIL_CONNECTOR = "google-mail";
const DEFAULT_ALERT_EMAIL = "worldgeographytrivia@gmail.com";
const ALERT_EMAIL_TO =
  process.env.BROKEN_IMAGE_ALERT_EMAIL_TO?.trim() || DEFAULT_ALERT_EMAIL;

// public/ lives in the geo-quiz frontend artifact; that is what the proxy
// serves these URLs from in production.
const PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "artifacts",
  "geo-quiz",
  "public",
);

type ImageRef = {
  source: string; // e.g. "questions" / "categories" / "courses"
  id: number;
  url: string;
};

function normalizePath(url: string): string {
  // Strip query string and fragment, then drop the leading slash so the path
  // can be resolved relative to PUBLIC_DIR.
  const withoutQuery = url.split(/[?#]/, 1)[0];
  return withoutQuery.replace(/^\/+/, "");
}

function expectedVariants(relPath: string): string[] {
  const dot = relPath.lastIndexOf(".");
  const stem = dot === -1 ? relPath : relPath.slice(0, dot);
  const variants: string[] = [];
  for (const w of RESPONSIVE_IMAGE_WIDTHS) {
    for (const fmt of OPTIMIZED_FORMATS) {
      variants.push(`${stem}-${w}.${fmt}`);
    }
  }
  return variants;
}

function missingFilesFor(url: string): string[] {
  const relPath = normalizePath(url);
  const candidates = [relPath, ...expectedVariants(relPath)];
  return candidates.filter((rel) => !existsSync(path.join(PUBLIC_DIR, rel)));
}

function isOptimizedLocalUrl(url: string): boolean {
  return OPTIMIZED_PREFIXES.some((p) => url.startsWith(p));
}

async function collectImageRefs(): Promise<ImageRef[]> {
  const [questions, categories, courses] = await Promise.all([
    db
      .select({ id: questionsTable.id, url: questionsTable.imageUrl })
      .from(questionsTable)
      .where(isNotNull(questionsTable.imageUrl)),
    db
      .select({ id: categoriesTable.id, url: categoriesTable.imageUrl })
      .from(categoriesTable)
      .where(isNotNull(categoriesTable.imageUrl)),
    db
      .select({ id: coursesTable.id, url: coursesTable.imageUrl })
      .from(coursesTable)
      .where(isNotNull(coursesTable.imageUrl)),
  ]);

  const refs: ImageRef[] = [];
  for (const row of questions)
    refs.push({ source: "questions", id: row.id, url: row.url as string });
  for (const row of categories)
    refs.push({ source: "categories", id: row.id, url: row.url as string });
  for (const row of courses)
    refs.push({ source: "courses", id: row.id, url: row.url as string });
  return refs;
}

type BrokenItem = { source: string; id: number; url: string; reason: string };

function describeError(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError")
    return `timed out after ${ALERT_TIMEOUT_MS}ms`;
  if (err instanceof Error) return err.message;
  return String(err);
}

// Build the per-row summary lines shared by every alert channel, capped at
// ALERT_MAX_ROWS so a large batch cannot produce an oversized notification (the
// full list is always in the run logs).
function buildBrokenLines(broken: BrokenItem[]): string[] {
  const shown = broken.slice(0, ALERT_MAX_ROWS);
  const lines = shown.map((b) => `${b.source}#${b.id} -> ${b.url} (${b.reason})`);
  if (broken.length > shown.length) {
    lines.push(`…and ${broken.length - shown.length} more (see run logs).`);
  }
  return lines;
}

async function sendBrokenImageAlert(broken: BrokenItem[]): Promise<void> {
  if (broken.length === 0) return;

  if (!ALERT_WEBHOOK_URL) {
    console.log(
      "\nWebhook alerting skipped: set BROKEN_IMAGE_ALERT_WEBHOOK_URL to receive a notification when broken images are found.",
    );
    return;
  }

  const lines = buildBrokenLines(broken).map((line) => `• ${line}`);
  const text = [
    `:warning: World Geography Trivia — ${broken.length} broken image URL(s) detected.`,
    ...lines,
  ].join("\n");

  const payload = { text, count: broken.length, broken };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  try {
    const res = await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(
        `Failed to deliver broken-image alert: webhook returned ${res.status}.`,
      );
    } else {
      console.log(
        `\nSent broken-image alert for ${broken.length} URL(s) to the configured webhook.`,
      );
    }
    try {
      await res.body?.cancel();
    } catch {
      // ignore
    }
  } catch (err) {
    // Best-effort: a delivery failure must not change the run outcome.
    console.error(`Failed to deliver broken-image alert: ${describeError(err)}.`);
  } finally {
    clearTimeout(timer);
  }
}

// Fetch a Gmail access token from the Replit connectors proxy. Returns null
// (treated as "unconfigured", a no-op) when the integration is not connected or
// the proxy environment is unavailable. This mirrors the secure connectors
// pattern: no raw SMTP/OAuth credentials live in code, and the token is fetched
// fresh on every run rather than cached.
async function getGmailAccessToken(): Promise<string | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!hostname || !xReplitToken) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${GMAIL_CONNECTOR}`,
      {
        headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{
        settings?: {
          access_token?: string;
          oauth?: { credentials?: { access_token?: string } };
        };
      }>;
    };
    const settings = data.items?.[0]?.settings;
    return (
      settings?.access_token ??
      settings?.oauth?.credentials?.access_token ??
      null
    );
  } finally {
    clearTimeout(timer);
  }
}

async function sendBrokenImageEmailAlert(broken: BrokenItem[]): Promise<void> {
  if (broken.length === 0) return;

  let token: string | null = null;
  try {
    token = await getGmailAccessToken();
  } catch (err) {
    // Best-effort: a credential lookup failure must not change the run outcome.
    console.error(
      `Failed to read Gmail connection for email alert: ${describeError(err)}.`,
    );
    return;
  }

  if (!token) {
    console.log(
      "\nEmail alerting skipped: connect the Gmail integration to email broken-image alerts.",
    );
    return;
  }

  const subject = `World Geography Trivia — ${broken.length} broken image URL(s) detected`;
  const body = [
    `${broken.length} broken image URL(s) were detected in the production database.`,
    "",
    ...buildBrokenLines(broken),
  ].join("\n");

  // RFC 2822 message, base64url-encoded for the Gmail send API.
  const mime = [
    `To: ${ALERT_EMAIL_TO}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  const raw = Buffer.from(mime, "utf-8").toString("base64url");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  try {
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      console.error(
        `Failed to deliver broken-image email alert: Gmail API returned ${res.status}.`,
      );
    } else {
      console.log(
        `\nSent broken-image email alert for ${broken.length} URL(s) to ${ALERT_EMAIL_TO}.`,
      );
    }
    try {
      await res.body?.cancel();
    } catch {
      // ignore
    }
  } catch (err) {
    // Best-effort: a delivery failure must not change the run outcome.
    console.error(
      `Failed to deliver broken-image email alert: ${describeError(err)}.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const refs = await collectImageRefs();

  // URLs under the optimized prefixes are expected to be locally hosted with
  // responsive variants; verify the source file and every variant on disk.
  const localRefs = refs.filter((ref) => isOptimizedLocalUrl(ref.url));
  // External/CDN URLs render a plain <img>; verify they are reachable.
  const externalRefs = refs.filter(
    (ref) => !isOptimizedLocalUrl(ref.url) && isExternalImageUrl(ref.url),
  );

  const brokenLocal: Array<ImageRef & { missing: string[] }> = [];
  for (const ref of localRefs) {
    const missing = missingFilesFor(ref.url);
    if (missing.length > 0) brokenLocal.push({ ...ref, missing });
  }

  const externalChecked = await mapWithConcurrency(
    externalRefs,
    EXTERNAL_CONCURRENCY,
    async (ref) => ({ ref, result: await checkExternalImageUrl(ref.url) }),
  );
  const brokenExternal = externalChecked.filter(
    (e) => e.result.status === "broken",
  );
  const transientExternal = externalChecked.filter(
    (e) => e.result.status === "transient",
  );

  console.log(
    `Checked ${localRefs.length} local DB image URL(s) under ${OPTIMIZED_PREFIXES.join(
      ", ",
    )} and ${externalRefs.length} external DB image URL(s) (out of ${refs.length} total non-null image URL(s)).`,
  );

  if (brokenLocal.length > 0) {
    console.error(
      `\nFOUND ${brokenLocal.length} local DB image URL(s) pointing at files we don't host:`,
    );
    for (const ref of brokenLocal) {
      console.error(`\n  ${ref.source}#${ref.id} -> ${ref.url}`);
      for (const rel of ref.missing) {
        console.error(`    missing: public/${rel}`);
      }
    }
    console.error(
      "\nFix by uploading the source image and running `pnpm --filter @workspace/geo-quiz run optimize-images`, " +
        "or by correcting the stored image URL.",
    );
  }

  if (brokenExternal.length > 0) {
    console.error(
      `\nFOUND ${brokenExternal.length} external DB image URL(s) that are not reachable as an image:`,
    );
    for (const { ref, result } of brokenExternal) {
      const reason = result.status === "broken" ? result.reason : "";
      console.error(`\n  ${ref.source}#${ref.id} -> ${ref.url}`);
      console.error(`    unreachable: ${reason}`);
    }
    console.error(
      "\nFix by correcting the stored image URL or hosting the image locally.",
    );
  }

  if (transientExternal.length > 0) {
    console.warn(
      `\nWARNING: ${transientExternal.length} external DB image URL(s) could not be verified (transient failures — not failing the run):`,
    );
    for (const { ref, result } of transientExternal) {
      const reason = result.status === "transient" ? result.reason : "";
      console.warn(`  ${ref.source}#${ref.id} -> ${ref.url} (${reason})`);
    }
  }

  if (brokenLocal.length === 0 && brokenExternal.length === 0) {
    console.log(
      "\nOK: every local source file and responsive variant exists, and every external image URL is reachable.",
    );
    return;
  }

  // Actively notify (best-effort) so a newly-broken image surfaces without
  // someone watching the Deployments pane. Only genuinely broken images are
  // included — transient failures are intentionally excluded.
  const brokenItems: BrokenItem[] = [
    ...brokenLocal.map((ref) => ({
      source: ref.source,
      id: ref.id,
      url: ref.url,
      reason: `missing ${ref.missing.length} local file(s): ${ref.missing
        .map((rel) => `public/${rel}`)
        .join(", ")}`,
    })),
    ...brokenExternal.map(({ ref, result }) => ({
      source: ref.source,
      id: ref.id,
      url: ref.url,
      reason: result.status === "broken" ? result.reason : "unreachable",
    })),
  ];
  await sendBrokenImageAlert(brokenItems);
  await sendBrokenImageEmailAlert(brokenItems);

  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("check-db-image-files failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
