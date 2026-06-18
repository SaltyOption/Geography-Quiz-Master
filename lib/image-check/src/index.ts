// Shared image-reachability logic.
//
// A stored image URL can be one of two kinds:
//
//   1. A locally hosted optimized path (/regions/, /landmarks/) whose
//      responsive variants are pre-generated on disk. File-existence is checked
//      separately by whoever has access to the public/ directory (the
//      maintenance script and the api-server's write-time guard).
//
//   2. An external / CDN URL served over http(s). The only way to know it
//      resolves to an image is to issue a bounded network request. This module
//      owns that check so the maintenance script
//      (scripts/src/check-db-image-files.ts) and the api-server's write-time
//      validation share one implementation and classify failures identically.
//
// Failures are classified into:
//   - "ok":        2xx with an image (or unknown) content-type.
//   - "broken":    a genuine 4xx (404/410/etc.) or a 2xx whose body is clearly
//                  not an image. Callers should reject/flag these.
//   - "transient": timeouts, DNS/network errors, 429, and 5xx. Callers must NOT
//                  hard-fail on these — a flaky CDN or blip should never block a
//                  save or a deploy.

export const EXTERNAL_TIMEOUT_MS = 10_000;
export const EXTERNAL_CONCURRENCY = 8;
export const EXTERNAL_USER_AGENT =
  "geo-quiz-image-check/1.0 (+broken-image reachability check)";

export type ExternalImageResult =
  | { status: "ok" }
  | { status: "broken"; reason: string }
  | { status: "transient"; reason: string };

/** True when the URL is an absolute http(s) URL we can reach over the network. */
export function isExternalImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function fetchWithTimeout(
  url: string,
  method: "HEAD" | "GET",
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": EXTERNAL_USER_AGENT,
        accept: "image/*,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function classifyResponse(
  res: Response,
  method: "HEAD" | "GET",
): ExternalImageResult | "retry" {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  if (res.ok) {
    // Many servers omit content-type on HEAD; treat a missing type as OK and
    // only flag a 2xx whose type is explicitly non-image.
    if (!contentType || contentType.startsWith("image/")) {
      return { status: "ok" };
    }
    // A 2xx with a non-image type (often a soft-404 HTML page). Double-check
    // with GET before deciding it is broken.
    if (method === "HEAD") return "retry";
    return {
      status: "broken",
      reason: `returned ${res.status} with non-image content-type "${contentType}"`,
    };
  }

  // Rate limiting and server errors are transient — do not fail callers.
  if (res.status === 429 || res.status >= 500) {
    return { status: "transient", reason: `returned ${res.status}` };
  }

  // Some servers reject HEAD (405/403/501); retry those with GET before
  // concluding anything.
  if (
    method === "HEAD" &&
    (res.status === 403 || res.status === 405 || res.status === 501)
  ) {
    return "retry";
  }

  // Any remaining 4xx is a genuine broken link (404/410/403/etc.).
  if (res.status >= 400 && res.status < 500) {
    return { status: "broken", reason: `returned ${res.status}` };
  }

  return { status: "transient", reason: `returned ${res.status}` };
}

/**
 * Issue a bounded network request to determine whether an external URL resolves
 * to a reachable image. Tries HEAD first, falling back to GET when a server
 * rejects HEAD or returns an ambiguous response. Never throws — network-level
 * failures are reported as "transient".
 */
export async function checkExternalImageUrl(
  url: string,
): Promise<ExternalImageResult> {
  for (const method of ["HEAD", "GET"] as const) {
    let res: Response;
    try {
      res = await fetchWithTimeout(url, method);
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? `timed out after ${EXTERNAL_TIMEOUT_MS}ms`
          : err instanceof Error
            ? err.message
            : String(err);
      // A network-level failure is transient; if HEAD failed this way, still
      // give GET a chance before giving up.
      if (method === "GET") return { status: "transient", reason };
      continue;
    }

    // Drain/cancel the body so sockets are released promptly.
    try {
      await res.body?.cancel();
    } catch {
      // ignore
    }

    const verdict = classifyResponse(res, method);
    if (verdict !== "retry") return verdict;
    // else fall through to GET
  }

  return { status: "transient", reason: "request failed" };
}

/**
 * Run an async mapper over items with a bounded number of concurrent workers,
 * preserving input order in the result array.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
