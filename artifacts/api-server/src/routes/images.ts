import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  isOptimizedImageUrl,
  isExternalImageUrl,
  findMissingImageFiles,
  imageValidationMessage,
  listHostedOptimizedImages,
} from "../lib/imageValidation";
import { checkExternalImageUrl } from "@workspace/image-check";

const router: IRouter = Router();

/**
 * Admin-only pre-flight check for an image URL. Mirrors the write-time guard
 * (validateImageUrlReachable) so the admin forms can warn inline, while an admin
 * still types, that an image is not hosted (optimized /regions/, /landmarks/
 * URLs and their responsive variants) or that an external URL does not resolve
 * to a reachable image — before they hit Save and get a 400. The server-side
 * 400 on save remains the authoritative guard.
 *
 * `reachable` is tri-state: true (external URL resolved to an image), false
 * (external URL is genuinely broken), or null (not checked, or only transiently
 * unreachable — transient failures must not block a save).
 */
router.get("/images/validate", requireAdmin, async (req, res): Promise<void> => {
  const raw = req.query.url;
  const url = Array.isArray(raw) ? raw[0] : raw;
  if (typeof url !== "string" || url === "") {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  const optimized = isOptimizedImageUrl(url);
  const missing = optimized ? findMissingImageFiles(url) : [];

  if (missing.length > 0) {
    res.json({
      optimized,
      missing,
      reachable: null,
      message: imageValidationMessage({ kind: "local-missing", url, missing }),
    });
    return;
  }

  // Not a broken local image — check external reachability when applicable.
  let reachable: boolean | null = null;
  let message: string | null = null;
  if (!optimized && isExternalImageUrl(url)) {
    const result = await checkExternalImageUrl(url);
    if (result.status === "ok") {
      reachable = true;
    } else if (result.status === "broken") {
      reachable = false;
      message = imageValidationMessage({
        kind: "external-unreachable",
        url,
        reason: result.reason,
      });
    }
    // "transient" leaves reachable=null / message=null — never block on it.
  }

  res.json({ optimized, missing, reachable, message });
});

/**
 * Admin-only gallery of the locally hosted optimized images (under /regions/
 * and /landmarks/) that have all of their responsive variants on disk. Powers
 * the visual image picker on the admin forms so admins can pick a guaranteed-
 * hosted cover image instead of typing a raw path.
 */
router.get("/images/gallery", requireAdmin, (_req, res): void => {
  res.json({ groups: listHostedOptimizedImages() });
});

export default router;
