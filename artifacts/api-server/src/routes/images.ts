import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  isOptimizedImageUrl,
  findMissingImageFiles,
  imageValidationMessage,
} from "../lib/imageValidation";

const router: IRouter = Router();

/**
 * Admin-only pre-flight check for an image URL. Mirrors the write-time guard
 * (validateOptionalImageUrl) so the admin question form can warn inline, while
 * an admin still types, that an optimized image (/regions/, /landmarks/) and
 * its responsive variants are not yet hosted — before they hit Save and get a
 * 400. The server-side 400 remains the authoritative guard.
 */
router.get("/images/validate", requireAdmin, (req, res): void => {
  const raw = req.query.url;
  const url = Array.isArray(raw) ? raw[0] : raw;
  if (typeof url !== "string" || url === "") {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  const optimized = isOptimizedImageUrl(url);
  const missing = optimized ? findMissingImageFiles(url) : [];
  const message =
    missing.length > 0 ? imageValidationMessage({ url, missing }) : null;

  res.json({ optimized, missing, message });
});

export default router;
